import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const GAMES_DIR = path.join(ROOT_DIR, 'Games');

// Ensure Games directory exists
if (!fs.existsSync(GAMES_DIR)) {
  fs.mkdirSync(GAMES_DIR, { recursive: true });
}

app.use(cors());

// List of folder names or files to ignore when searching for games
const IGNORED_NAMES = new Set([
  'node_modules',
  '.git',
  '.agents',
  '.gemini',
  'public',
  'dist',
  '.DS_Store',
  'package.json',
  'package-lock.json',
  'server.js',
  'README.md',
  'scratch'
]);

// SSE clients for live directory updates
const clients = new Set();

/**
 * Format raw directory name into clean display title
 */
function formatTitle(dirName) {
  return dirName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Infer category and icon from title & description
 */
function inferCategoryAndIcon(title, description = '') {
  const text = (title + ' ' + description).toLowerCase();
  if (text.includes('push-up') || text.includes('bird') || text.includes('arm')) {
    return { category: 'Push-Up & Arms', icon: '🦅', color: 'cyan' };
  } else if (text.includes('jump') || text.includes('rgb') || text.includes('legs') || text.includes('cardio')) {
    return { category: 'Jump & Cardio', icon: '⚡', color: 'magenta' };
  } else if (text.includes('squat') || text.includes('leg')) {
    return { category: 'Squats & Lower Body', icon: '🏋️', color: 'green' };
  } else if (text.includes('yoga') || text.includes('stretch') || text.includes('balance')) {
    return { category: 'Yoga & Balance', icon: '🧘', color: 'amber' };
  }
  return { category: 'AI Camera Fitness', icon: '🎯', color: 'blue' };
}

/**
 * Scan Games directory and discover game folders dynamically
 */
function discoverGames() {
  if (!fs.existsSync(GAMES_DIR)) return [];
  const items = fs.readdirSync(GAMES_DIR, { withFileTypes: true });
  const games = [];

  for (const item of items) {
    if (!item.isDirectory()) continue;
    const folderName = item.name;
    if (IGNORED_NAMES.has(folderName) || folderName.startsWith('.')) continue;

    const gameDirPath = path.join(GAMES_DIR, folderName);

    // Check if valid game directory (has index.html or dist/index.html or package.json)
    let entryPath = '';
    let hasDist = false;

    if (fs.existsSync(path.join(gameDirPath, 'dist', 'index.html'))) {
      entryPath = `/games/${encodeURIComponent(folderName)}/dist/index.html`;
      hasDist = true;
    } else if (fs.existsSync(path.join(gameDirPath, 'index.html'))) {
      entryPath = `/games/${encodeURIComponent(folderName)}/index.html`;
    } else {
      // Not a web game folder
      continue;
    }

    let title = formatTitle(folderName);
    let description = 'Interactive AI Camera Fitness Game. Move your body to play!';
    let version = '1.0.0';
    let instructions = [];
    let customMeta = {};

    // 1. Try reading game.json if present
    const gameJsonPath = path.join(gameDirPath, 'game.json');
    if (fs.existsSync(gameJsonPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(gameJsonPath, 'utf8'));
        if (meta.title) title = meta.title;
        if (meta.description) description = meta.description;
        if (meta.instructions) instructions = meta.instructions;
        customMeta = meta;
      } catch (err) {
        console.warn(`Error parsing game.json in ${folderName}:`, err.message);
      }
    }

    // 2. Try reading package.json if present
    const pkgPath = path.join(gameDirPath, 'package.json');
    if (fs.existsSync(pkgPath) && !customMeta.title) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name && !customMeta.title) title = formatTitle(pkg.name);
        if (pkg.description) description = pkg.description;
        if (pkg.version) version = pkg.version;
      } catch (err) {
        // ignore
      }
    }

    // 3. Try parsing HTML meta description if description is default
    const htmlFileToRead = hasDist
      ? path.join(gameDirPath, 'dist', 'index.html')
      : path.join(gameDirPath, 'index.html');

    if (fs.existsSync(htmlFileToRead)) {
      try {
        const htmlContent = fs.readFileSync(htmlFileToRead, 'utf8');
        const descMatch = htmlContent.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
        if (descMatch && descMatch[1]) {
          description = descMatch[1];
        }
        const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1] && !customMeta.title) {
          title = titleMatch[1].split('-')[0].trim();
        }
      } catch (err) {
        // ignore
      }
    }

    // Check cover image
    let coverUrl = '';
    const possibleCovers = ['cover.jpg', 'cover.png', 'thumbnail.jpg', 'thumbnail.png', 'preview.jpg', 'preview.png', 'public/cover.jpg', 'public/cover.png'];
    for (const coverFile of possibleCovers) {
      if (fs.existsSync(path.join(gameDirPath, coverFile))) {
        coverUrl = `/games/${encodeURIComponent(folderName)}/${coverFile}`;
        break;
      }
    }

    const { category, icon, color } = inferCategoryAndIcon(title, description);

    games.push({
      id: folderName,
      folderName,
      title,
      description,
      version,
      entryUrl: entryPath,
      coverUrl: coverUrl || customMeta.coverUrl || '',
      category: customMeta.category || category,
      icon: customMeta.icon || icon,
      color: customMeta.color || color,
      instructions: instructions.length > 0 ? instructions : [
        'Ensure your webcam is enabled and you have good lighting.',
        'Stand back so your full upper/whole body is visible.',
        'Follow on-screen fitness prompts to score points!'
      ],
      createdTime: fs.statSync(gameDirPath).birthtimeMs || Date.now()
    });
  }

  // Sort newest first or by title
  return games.sort((a, b) => a.title.localeCompare(b.title));
}

// Serve games static files with dynamic base URL support
app.use('/games/:folderName', (req, res, next) => {
  const folderName = req.params.folderName;
  const targetDir = path.join(GAMES_DIR, folderName);

  if (!fs.existsSync(targetDir) || IGNORED_NAMES.has(folderName)) {
    return res.status(404).send('Game not found');
  }

  // If requesting html file directly (e.g. index.html or dist/index.html), inject base tag for relative asset loading
  const reqPath = req.path;
  if (reqPath === '/' || reqPath === '/index.html' || reqPath === '/dist/index.html') {
    let filePath = path.join(targetDir, reqPath === '/' ? 'index.html' : reqPath);
    
    // Check dist/index.html if root index.html doesn't exist
    if (reqPath === '/' && !fs.existsSync(filePath) && fs.existsSync(path.join(targetDir, 'dist', 'index.html'))) {
      filePath = path.join(targetDir, 'dist', 'index.html');
    }

    if (fs.existsSync(filePath)) {
      try {
        let html = fs.readFileSync(filePath, 'utf8');
        // Base path calculation for iframe sub-resource resolution
        const subPath = filePath.includes('/dist/') ? `/games/${encodeURIComponent(folderName)}/dist/` : `/games/${encodeURIComponent(folderName)}/`;
        
        // Inject <base href="..."> into <head> if not already present
        if (!html.includes('<base ')) {
          html = html.replace(/<head>/i, `<head>\n  <base href="${subPath}">`);
        }
        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
      } catch (e) {
        // Fallback to static
      }
    }
  }

  express.static(targetDir)(req, res, next);
});

// Also serve fallback static assets if games request root assets like /assets/... or /favicon.svg
app.use('/assets', (req, res, next) => {
  // Try finding in Games/RGB Jump/dist/assets or Games/Flip_Bird/dist/assets
  const rgbAssets = path.join(GAMES_DIR, 'RGB Jump', 'dist', 'assets', req.path);
  if (fs.existsSync(rgbAssets)) {
    return res.sendFile(rgbAssets);
  }
  const flipAssets = path.join(GAMES_DIR, 'Flip_Bird', 'dist', 'assets', req.path);
  if (fs.existsSync(flipAssets)) {
    return res.sendFile(flipAssets);
  }
  next();
});

app.get('/favicon.svg', (req, res) => {
  const rgbFav = path.join(GAMES_DIR, 'RGB Jump', 'dist', 'favicon.svg');
  if (fs.existsSync(rgbFav)) {
    return res.sendFile(rgbFav);
  }
  res.status(404).end();
});

// REST endpoint to get all games
app.get('/api/games', (req, res) => {
  try {
    const games = discoverGames();
    res.json({ success: true, games, total: games.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// SSE endpoint for live folder watching updates
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  clients.add(res);

  // Send initial connected message
  res.write(`data: ${JSON.stringify({ type: 'connected', time: Date.now() })}\n\n`);

  req.on('close', () => {
    clients.delete(res);
  });
});

function broadcastGamesUpdate() {
  try {
    const games = discoverGames();
    const payload = `data: ${JSON.stringify({ type: 'update', games, total: games.length })}\n\n`;
    for (const client of clients) {
      client.write(payload);
    }
  } catch (err) {
    console.error('Error broadcasting game update:', err);
  }
}

// Watch Games directory for changes (new folders added or removed)
let watchTimeout = null;
fs.watch(GAMES_DIR, { recursive: false }, (eventType, filename) => {
  if (filename && !IGNORED_NAMES.has(filename) && !filename.startsWith('.')) {
    // Debounce watcher notifications
    clearTimeout(watchTimeout);
    watchTimeout = setTimeout(() => {
      console.log(`[Watcher] Games directory change detected: ${filename} (${eventType})`);
      broadcastGamesUpdate();
    }, 500);
  }
});

// Serve main Landing Page Hub frontend from public/
app.use(express.static(path.join(ROOT_DIR, 'public')));

// Fallback to public/index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'public', 'index.html'));
});

const startServer = (port) => {
  const server = app.listen(port, () => {
    console.log(`
  ======================================================
  🚀 FITSTE GAMES HUB IS RUNNING!
  🌐 Hub URL: http://localhost:${port}
  📁 Watching directory: ${GAMES_DIR}
  🎮 Games directory initialized!
  ======================================================
  `);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
};

startServer(PORT);
