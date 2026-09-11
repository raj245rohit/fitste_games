/**
 * FITSTE GAMES HUB - FRONTEND APPLICATION LOGIC
 */

document.addEventListener('DOMContentLoaded', () => {
  // State variables
  let games = [];
  let currentCategory = 'all';
  let searchQuery = '';
  let activeGame = null;
  let audioEnabled = true;
  let layoutView = 'grid';

  // DOM Elements
  const gameCountEl = document.getElementById('game-count');
  const gamesGridEl = document.getElementById('games-grid');
  const loadingStateEl = document.getElementById('loading-state');
  const emptyStateEl = document.getElementById('empty-state');
  const searchInputEl = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search');
  const categoryPillsEl = document.getElementById('category-pills');
  const toastContainerEl = document.getElementById('toast-container');
  const btnResetFilters = document.getElementById('btn-reset-filters');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const viewGridBtn = document.getElementById('view-grid');
  const viewListBtn = document.getElementById('view-list');

  // Spotlight Elements
  const spotlightTitleEl = document.getElementById('spotlight-title');
  const spotlightDescEl = document.getElementById('spotlight-desc');
  const spotlightTagsEl = document.getElementById('spotlight-tags');
  const spotlightImgEl = document.getElementById('spotlight-img');
  const spotlightBgEl = document.getElementById('spotlight-bg');
  const btnSpotlightPlay = document.getElementById('btn-spotlight-play');
  const btnSpotlightInfo = document.getElementById('btn-spotlight-info');

  // Game Player Modal Elements
  const gamePlayerModal = document.getElementById('game-player-modal');
  const gameIframe = document.getElementById('game-iframe');
  const playerGameTitle = document.getElementById('player-game-title');
  const playerGameCategory = document.getElementById('player-game-category');
  const btnClosePlayer = document.getElementById('btn-close-player');
  const btnReloadGame = document.getElementById('btn-reload-game');
  const btnInfoToggle = document.getElementById('btn-info-toggle');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const gameGuideDrawer = document.getElementById('game-guide-drawer');
  const btnCloseGuide = document.getElementById('btn-close-guide');
  const guideDescription = document.getElementById('guide-description');
  const guideInstructionsList = document.getElementById('guide-instructions-list');

  // Audio Synth Context
  let audioCtx = null;

  function playSound(type = 'click') {
    if (!audioEnabled) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;

      if (type === 'click') {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'launch') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'notify') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.1); // A5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {
      // ignore web audio restrictions
    }
  }

  // 1. Initial Fetch of Discovered Games
  async function fetchGames() {
    try {
      const res = await fetch('/api/games');
      const data = await res.json();
      if (data.success) {
        handleGamesData(data.games);
      }
    } catch (err) {
      console.error('Failed to fetch games:', err);
    } finally {
      loadingStateEl.classList.add('hidden');
    }
  }

  function handleGamesData(newGames) {
    const isFirstLoad = games.length === 0;
    
    // Check if new games were added since last check
    if (!isFirstLoad && newGames.length > games.length) {
      const existingIds = new Set(games.map(g => g.id));
      const added = newGames.filter(g => !existingIds.has(g.id));
      for (const game of added) {
        showToast(`🎮 New Game Discovered: <strong>${game.title}</strong>`);
        playSound('notify');
      }
    }

    games = newGames;
    gameCountEl.textContent = games.length;

    updateSpotlight();
    renderGames();
  }

  // 2. Real-Time SSE Stream for Auto-Appending New Game Folders
  function initSSEWatcher() {
    const evtSource = new EventSource('/api/stream');

    evtSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'update' && Array.isArray(data.games)) {
          handleGamesData(data.games);
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };

    evtSource.onerror = () => {
      console.warn('SSE Stream disconnected. Reconnecting in 3s...');
      evtSource.close();
      setTimeout(initSSEWatcher, 3000);
    };
  }

  // 3. Render Spotlight Featured Game
  function updateSpotlight() {
    if (games.length === 0) return;
    
    // Select first game or featured game
    const spotlightGame = games.find(g => g.id === 'RGB Jump') || games[0];
    
    spotlightTitleEl.textContent = spotlightGame.title;
    spotlightDescEl.textContent = spotlightGame.description;
    
    // Cover image fallback
    const coverSrc = spotlightGame.coverUrl || '/games/RGB%20Jump/cover.jpg';
    spotlightImgEl.src = coverSrc;
    spotlightBgEl.style.backgroundImage = `url('${coverSrc}')`;

    // Category tags
    spotlightTagsEl.innerHTML = `
      <span class="tag tag-${spotlightGame.color || 'cyan'}">${spotlightGame.icon || '⚡'} ${spotlightGame.category}</span>
      <span class="tag tag-magenta"><i class="fa-solid fa-camera"></i> AI Pose Tracking</span>
      <span class="tag tag-green"><i class="fa-solid fa-fire"></i> Live Motion</span>
    `;

    btnSpotlightPlay.onclick = () => {
      playSound('launch');
      openGamePlayer(spotlightGame);
    };

    btnSpotlightInfo.onclick = () => {
      playSound('click');
      openGamePlayer(spotlightGame, true);
    };

    document.getElementById('spotlight-play-ring').onclick = () => {
      playSound('launch');
      openGamePlayer(spotlightGame);
    };
  }

  // 4. Render Game Cards Grid
  function renderGames() {
    gamesGridEl.innerHTML = '';

    // Filter games
    const filtered = games.filter(game => {
      const matchesCategory = currentCategory === 'all' || game.category === currentCategory;
      const matchesSearch = searchQuery === '' ||
        game.title.toLowerCase().includes(searchQuery) ||
        game.description.toLowerCase().includes(searchQuery) ||
        game.category.toLowerCase().includes(searchQuery);
      return matchesCategory && matchesSearch;
    });

    if (filtered.length === 0) {
      emptyStateEl.classList.remove('hidden');
      gamesGridEl.classList.add('hidden');
      return;
    } else {
      emptyStateEl.classList.add('hidden');
      gamesGridEl.classList.remove('hidden');
    }

    filtered.forEach(game => {
      const card = document.createElement('div');
      card.className = 'game-card glass-card';
      
      const coverSrc = game.coverUrl || generateFallbackCardImage(game);

      card.innerHTML = `
        <div class="card-media">
          <img src="${coverSrc}" alt="${game.title}" loading="lazy" />
          <div class="card-category-badge">
            <span class="tag tag-${game.color || 'cyan'}">${game.icon || '🎯'} ${game.category}</span>
          </div>
          <div class="play-hover-overlay">
            <div class="play-btn-circle"><i class="fa-solid fa-play"></i></div>
          </div>
        </div>
        <div class="card-body">
          <div class="card-header-row">
            <h3 class="card-title">${game.title}</h3>
          </div>
          <p class="card-desc">${game.description}</p>
          <div class="card-footer">
            <span class="card-version">v${game.version}</span>
            <button class="btn-primary card-play-btn">
              <i class="fa-solid fa-play"></i> PLAY
            </button>
          </div>
        </div>
      `;

      card.onclick = () => {
        playSound('launch');
        openGamePlayer(game);
      };

      gamesGridEl.appendChild(card);
    });
  }

  function generateFallbackCardImage(game) {
    // Return a stylish gradient image fallback
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340" viewBox="0 0 600 340"><rect width="600" height="340" fill="%230b1329"/><circle cx="300" cy="170" r="120" fill="%2300f2fe" opacity="0.15"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="%2300f2fe" font-family="sans-serif" font-weight="bold" font-size="42">${encodeURIComponent(game.title)}</text><text x="50%" y="62%" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-family="sans-serif" font-size="20">AI Motion Fitness</text></svg>`;
  }

  // 5. Open Game Player Overlay with Embedded Iframe
  function openGamePlayer(game, openGuide = false) {
    activeGame = game;
    playerGameTitle.textContent = game.title;
    playerGameCategory.textContent = game.category;

    // Load iframe URL
    gameIframe.src = game.entryUrl;

    // Populate Guide
    guideDescription.textContent = game.description;
    guideInstructionsList.innerHTML = game.instructions
      .map(inst => `<li>${inst}</li>`)
      .join('');

    if (openGuide) {
      gameGuideDrawer.classList.remove('hidden');
    } else {
      gameGuideDrawer.classList.add('hidden');
    }

    gamePlayerModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeGamePlayer() {
    playSound('click');
    gameIframe.src = 'about:blank'; // Stop audio / video webcam feed on exit
    gamePlayerModal.classList.add('hidden');
    document.body.style.overflow = 'auto';
    activeGame = null;
  }

  // 6. Toast Notification Helper
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <i class="fa-solid fa-sparkles toast-icon"></i>
      <div>${message}</div>
    `;
    toastContainerEl.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s reverse ease-in';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  // Event Listeners
  searchInputEl.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    clearSearchBtn.classList.toggle('hidden', searchQuery === '');
    renderGames();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInputEl.value = '';
    searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    renderGames();
  });

  categoryPillsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    playSound('click');

    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentCategory = btn.dataset.category;
    renderGames();
  });

  btnResetFilters.addEventListener('click', () => {
    searchInputEl.value = '';
    searchQuery = '';
    currentCategory = 'all';
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.pill-btn[data-category="all"]').classList.add('active');
    renderGames();
  });

  viewGridBtn.addEventListener('click', () => {
    playSound('click');
    layoutView = 'grid';
    viewGridBtn.classList.add('active');
    viewListBtn.classList.remove('active');
    gamesGridEl.className = 'games-grid grid-layout';
  });

  viewListBtn.addEventListener('click', () => {
    playSound('click');
    layoutView = 'list';
    viewListBtn.classList.add('active');
    viewGridBtn.classList.remove('active');
    gamesGridEl.className = 'games-grid list-layout';
  });

  btnSoundToggle.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    btnSoundToggle.innerHTML = audioEnabled
      ? '<i class="fa-solid fa-volume-high"></i>'
      : '<i class="fa-solid fa-volume-xmark"></i>';
    btnSoundToggle.classList.toggle('active', !audioEnabled);
  });

  // Game Player Controls
  btnClosePlayer.addEventListener('click', closeGamePlayer);

  btnReloadGame.addEventListener('click', () => {
    playSound('click');
    if (activeGame) {
      gameIframe.src = activeGame.entryUrl;
    }
  });

  btnInfoToggle.addEventListener('click', () => {
    playSound('click');
    gameGuideDrawer.classList.toggle('hidden');
  });

  btnCloseGuide.addEventListener('click', () => {
    gameGuideDrawer.classList.add('hidden');
  });

  btnFullscreen.addEventListener('click', () => {
    playSound('click');
    if (!document.fullscreenElement) {
      gamePlayerModal.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen().catch(err => console.error(err));
    }
  });

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!gamePlayerModal.classList.contains('hidden')) {
        closeGamePlayer();
      }
    }
  });

  // Init
  fetchGames();
  initSSEWatcher();
});
