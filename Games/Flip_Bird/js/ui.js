import { PoseTracker } from './tracking.js';
import { FlappyBirdGame } from './game.js';
import { soundEngine } from './audio.js';

export class UIManager {
  constructor() {
    // DOM Elements
    this.videoElement = document.getElementById('camera-feed');
    this.gameCanvas = document.getElementById('game-canvas');
    this.skeletonCanvas = document.getElementById('skeleton-canvas');

    // Screens
    this.startScreen = document.getElementById('start-screen');
    this.tutorialScreen = document.getElementById('tutorial-screen');
    this.postureCheckScreen = document.getElementById('posture-check-screen');
    this.countdownOverlay = document.getElementById('countdown-overlay');
    this.countdownNumber = document.getElementById('countdown-number');
    this.gameHud = document.getElementById('game-hud');
    this.gameOverScreen = document.getElementById('game-over-screen');
    this.warningBanner = document.getElementById('warning-banner');

    // HUD Text
    this.liveScoreEl = document.getElementById('hud-score');
    this.highScoreEl = document.getElementById('hud-highscore');
    this.repsEl = document.getElementById('hud-reps');
    this.startHighScoreEl = document.getElementById('start-highscore');
    this.finalScoreEl = document.getElementById('final-score');
    this.finalHighScoreEl = document.getElementById('final-highscore');
    this.finalRepsEl = document.getElementById('final-reps');
    this.postureMessageEl = document.getElementById('posture-status-msg');
    this.postureBadgeEl = document.getElementById('posture-badge');
    this.warningTextEl = document.getElementById('warning-text');

    // Buttons
    this.btnStartGame = document.getElementById('btn-start-game');
    this.btnHowToPlay = document.getElementById('btn-how-to-play');
    this.btnTutorialReady = document.getElementById('btn-tutorial-ready');
    this.btnRestart = document.getElementById('btn-restart');
    this.btnHome = document.getElementById('btn-home');
    this.btnMute = document.getElementById('btn-mute');

    // Engines
    this.tracker = new PoseTracker();
    this.game = new FlappyBirdGame(this.gameCanvas, this.videoElement);

    // State: 'START', 'TUTORIAL', 'ALIGNMENT', 'COUNTDOWN', 'PLAYING', 'GAME_OVER'
    this.currentState = 'START';
    this.alignmentSuccessTimer = 0;
    this.warningSoundCooldown = 0;

    this.init();
  }

  async init() {
    this.updateHighScoreDisplays();
    this.bindEvents();

    // Initialize MediaPipe asynchronously
    await this.tracker.init(this.videoElement, this.skeletonCanvas);

    // Start Animation Loop
    requestAnimationFrame((t) => this.loop(t));
  }

  bindEvents() {
    this.btnStartGame.addEventListener('click', () => this.showTutorial());
    this.btnHowToPlay.addEventListener('click', () => this.showTutorial());
    this.btnTutorialReady.addEventListener('click', () => this.startPostureCheck());
    this.btnRestart.addEventListener('click', () => this.startPostureCheck());
    this.btnHome.addEventListener('click', () => this.showStartScreen());

    this.btnMute.addEventListener('click', () => {
      const isMuted = soundEngine.toggleMute();
      this.btnMute.innerText = isMuted ? '🔇 Muted' : '🔊 Sound On';
    });
  }

  updateHighScoreDisplays() {
    const hs = this.game.highScore;
    if (this.startHighScoreEl) this.startHighScoreEl.innerText = hs.toString();
    if (this.highScoreEl) this.highScoreEl.innerText = hs.toString();
    if (this.finalHighScoreEl) this.finalHighScoreEl.innerText = hs.toString();
  }

  showStartScreen() {
    this.currentState = 'START';
    this.game.state = 'IDLE';
    this.hideAllScreens();
    this.startScreen.classList.remove('hidden');
    this.updateHighScoreDisplays();
  }

  showTutorial() {
    this.currentState = 'TUTORIAL';
    this.hideAllScreens();
    this.tutorialScreen.classList.remove('hidden');
  }

  async startPostureCheck() {
    this.currentState = 'ALIGNMENT';
    this.hideAllScreens();
    this.postureCheckScreen.classList.remove('hidden');
    this.skeletonCanvas.classList.remove('hidden');

    this.alignmentSuccessTimer = 0;
    const cameraStarted = await this.tracker.startCamera();
    if (!cameraStarted) {
      alert('Camera access is required to track your push-up position.');
    }
  }

  startCountdown() {
    this.currentState = 'COUNTDOWN';
    this.hideAllScreens();
    this.countdownOverlay.classList.remove('hidden');
    this.skeletonCanvas.classList.add('hidden');

    let count = 3;
    this.countdownNumber.innerText = count.toString();
    soundEngine.playFlap();

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        this.countdownNumber.innerText = count.toString();
        soundEngine.playFlap();
      } else if (count === 0) {
        this.countdownNumber.innerText = 'GO!';
        soundEngine.playScore();
      } else {
        clearInterval(interval);
        this.countdownOverlay.classList.add('hidden');
        this.startGameplay();
      }
    }, 900);
  }

  startGameplay() {
    this.currentState = 'PLAYING';
    this.gameHud.classList.remove('hidden');
    this.tracker.resetReps();
    this.game.start();
  }

  showGameOver() {
    this.currentState = 'GAME_OVER';
    this.gameHud.classList.add('hidden');
    this.warningBanner.classList.add('hidden');
    this.gameOverScreen.classList.remove('hidden');

    if (this.finalScoreEl) this.finalScoreEl.innerText = this.game.score.toString();
    if (this.finalRepsEl) this.finalRepsEl.innerText = this.tracker.pushUpCount.toString();
    this.updateHighScoreDisplays();
  }

  hideAllScreens() {
    this.startScreen.classList.add('hidden');
    this.tutorialScreen.classList.add('hidden');
    this.postureCheckScreen.classList.add('hidden');
    this.countdownOverlay.classList.add('hidden');
    this.gameHud.classList.add('hidden');
    this.gameOverScreen.classList.add('hidden');
    this.warningBanner.classList.add('hidden');
  }

  loop(timestamp) {
    // Process tracking frame
    const status = this.tracker.processFrame(timestamp);

    // Render skeleton debug layer if in ALIGNMENT screen
    if (this.currentState === 'ALIGNMENT') {
      this.tracker.drawSkeletalOverlay();
      this.updateAlignmentStatus(status);
    }

    // Gameplay Loop
    if (this.currentState === 'PLAYING') {
      // Validate posture during gameplay
      this.handleGameplayPostureCheck(status);

      // Update & render Flappy Bird game
      this.game.update(status);
      this.game.render(status);

      // Update HUD
      if (this.liveScoreEl) this.liveScoreEl.innerText = this.game.score.toString();
      if (this.repsEl) this.repsEl.innerText = this.tracker.pushUpCount.toString();
      if (this.highScoreEl) this.highScoreEl.innerText = this.game.highScore.toString();

      // Check Game Over
      if (this.game.state === 'GAME_OVER') {
        this.showGameOver();
      }
    }

    requestAnimationFrame((t) => this.loop(t));
  }

  updateAlignmentStatus(status) {
    if (!this.postureMessageEl || !this.postureBadgeEl) return;

    this.postureMessageEl.innerText = status.message;

    if (status.isValid) {
      this.postureBadgeEl.className = 'status-badge valid';
      this.postureBadgeEl.innerText = '✅ PERFECT POSTURE';
      this.alignmentSuccessTimer++;

      // Hold posture for ~45 frames (~1.5s) to trigger countdown
      if (this.alignmentSuccessTimer > 45) {
        this.startCountdown();
      }
    } else {
      this.postureBadgeEl.className = 'status-badge invalid';
      this.postureBadgeEl.innerText = '⚠️ ADJUST POSTURE';
      this.alignmentSuccessTimer = 0;
    }
  }

  handleGameplayPostureCheck(status) {
    if (!status.isValid) {
      this.warningBanner.classList.remove('hidden');
      if (this.warningTextEl) {
        this.warningTextEl.innerText = status.message;
      }

      this.warningSoundCooldown++;
      if (this.warningSoundCooldown % 60 === 0) {
        soundEngine.playWarning();
      }
    } else {
      this.warningBanner.classList.add('hidden');
      this.warningSoundCooldown = 0;
    }
  }
}

// Bootstrap UIManager when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.uiManager = new UIManager();
});
