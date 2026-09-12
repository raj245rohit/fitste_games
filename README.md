# ⚡ FITSTE GAMES - AI Motion Fitness Arcade Hub

Welcome to **Fitste Games**, an interactive web-based AI motion fitness arcade! Fitste Games turns exercise into an engaging arcade experience by using your webcam and real-time AI pose tracking.

---

## 🚀 Features

- 🎮 **Arcade Launcher Hub**: A sleek, modern cyberpunk interface to browse, filter, and play interactive fitness games.
- ⚡ **Dynamic Auto-Discovery**: Automatically detects and publishes any game folder added into the `Games/` directory.
- 📷 **In-Browser AI Pose Tracking**: Powered by MediaPipe AI for real-time body tracking without extra hardware.
- 🖼️ **Embedded Game Player**: Play any game directly inside an interactive iframe overlay with controls for full-screen mode, guide tips, and reloading.
- 🔊 **Interactive UI Audio**: Built-in Web Audio API sound effects for interactive user feedback.

---

## 📁 Repository Structure

```text
Fitste Games/
├── Games/                   # Folder containing all individual fitness game projects
│   ├── Flip_Bird/           # Push-Up Interactive Camera Game
│   └── RGB Jump/            # High-Energy Color Zone Jumping Game
├── public/                  # Arcade Hub frontend UI (HTML, CSS, Vanilla JS)
│   ├── index.html           # Main arcade hub page
│   ├── style.css            # Cyberpunk dark fitness design system
│   └── app.js               # Dynamic card rendering & SSE client logic
├── server.js                # Express server with live folder watching & game asset routing
├── package.json             # Root dependencies and scripts
└── README.md                # Project documentation
```

---

## 🕹️ Included Games

| Game | Category | Description | Exercise Type |
| :--- | :--- | :--- | :--- |
| **RGB Jump** | `Jump & Cardio` | Jump into Red, Green, or Blue zones in real time to match on-screen color prompts! | Cardio & Jumping |
| **Flip Bird** | `Push-Up & Arms` | Flap and navigate obstacles by performing real-time body push-ups in front of your camera. | Push-Ups & Chest |

---

## 🛠️ Quick Start

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **Webcam**: Enabled for camera pose tracking games

### 2. Installation
Clone the repository and install root dependencies:
```bash
git clone https://github.com/raj245rohit/fitste_games.git
cd fitste_games
npm install
```

### 3. Running the Server
Start the Fitste Games Hub server:
```bash
npm start
```

Open your browser and navigate to:
```text
http://localhost:3000
```
*(If port 3000 is in use, the server automatically connects to port 3001).*

---

## 📱 Mobile Camera Access & HTTPS Requirements

> [!IMPORTANT]
> **HTTPS is Required for Webcams on Mobile Devices!**  
> Modern mobile browsers (**iOS Safari**, **Android Chrome**, and Firefox Mobile) **STRICTLY DISABLE camera permissions (`getUserMedia`) over plain `http://`** when accessed from external IP addresses or VPS domains.

If you deploy this server on a VPS and access it on a phone:
- **Over `http://your-vps-ip:3000`**: Mobile browsers block camera permissions and disable `navigator.mediaDevices`.
- **Over `https://`**: Mobile browsers prompt for camera permissions, enabling full mobile gameplay!

### 🔒 Quick Ways to Enable HTTPS / SSL on your VPS:

#### Option A: Free Instant HTTPS Tunnel (No Setup Required)
Run this command on your VPS while the server is running:
```bash
npx localtunnel --port 3001
```
It gives you a secure `https://xxxx.loca.lt` URL that you can immediately open on your phone!

#### Option B: Cloudflare Tunnel (Recommended for Production)
```bash
cloudflared tunnel --url http://localhost:3001
```

#### Option C: Nginx / Caddy reverse proxy with Certbot SSL
If you have a domain pointing to your VPS, use Let's Encrypt / Certbot:
```bash
sudo certbot --nginx -d yourdomain.com
```

---

## ➕ How to Add New Games

To add a new game to the hub:

1. Create a new directory inside the `Games/` folder (e.g. `Games/Squat_Hero`).
2. Add your web game files, ensuring an `index.html` (or `dist/index.html` for Vite/React apps) is present.
3. *(Optional)* Add a `game.json` metadata file inside your game folder to customize titles, exercise tags, and instructions:
   ```json
   {
     "title": "Squat Hero",
     "description": "Lower body fitness game powered by AI squat detection.",
     "category": "Squats & Lower Body",
     "icon": "🏋️",
     "color": "green",
     "instructions": [
       "Stand 5-7 feet back from your camera.",
       "Perform deep squats to trigger jump boosts."
     ]
   }
   ```
4. The hub will automatically discover and display the game!

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
