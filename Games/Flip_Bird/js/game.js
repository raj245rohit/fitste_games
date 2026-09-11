import { soundEngine } from './audio.js';

export class FlappyBirdGame {
  constructor(canvas, videoElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.videoElement = videoElement;

    // Canvas Dimensions
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // Game Objects
    this.bird = {
      x: this.width * 0.25, // Fixed horizontal position (or anchored near head)
      y: this.height * 0.5,
      targetY: this.height * 0.5,
      radius: 20,
      width: 44,
      height: 32,
      velocity: 0,
      rotation: 0,
      flapFrame: 0,
      flapTimer: 0
    };

    // Pipes
    this.pipes = [];
    this.pipeWidth = 72;
    this.pipeGap = 210; // Clearance height between top and bottom pipe
    this.pipeSpeed = 3.5;
    this.pipeSpawnTimer = 0;
    this.pipeSpawnInterval = 120; // Frames between pipe spawns

    // Score & Stats
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('flip_bird_highscore') || '0', 10);
    this.reps = 0;

    // Game States: 'IDLE', 'PLAYING', 'PAUSED', 'GAME_OVER'
    this.state = 'IDLE';

    // Particle FX
    this.particles = [];
    this.scorePopups = [];

    // Screen Resize binding
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
    this.bird.x = this.width * 0.28; // Left offset for player head alignment
  }

  start() {
    this.score = 0;
    this.pipes = [];
    this.particles = [];
    this.scorePopups = [];
    this.pipeSpawnTimer = 60; // First pipe spawns after 60 frames
    this.bird.y = this.height * 0.5;
    this.bird.targetY = this.height * 0.5;
    this.bird.velocity = 0;
    this.state = 'PLAYING';
  }

  update(trackingStatus) {
    if (this.state !== 'PLAYING') return;

    // 1. Update Bird Y position based on camera tracking headY
    if (trackingStatus && trackingStatus.headY !== undefined) {
      // Map normalized headY [0.15 .. 0.75] to Canvas height [0.1 .. 0.9]
      const minHeadY = 0.15;
      const maxHeadY = 0.75;
      const normalizedY = (trackingStatus.headY - minHeadY) / (maxHeadY - minHeadY);
      const clampedY = Math.max(0.08, Math.min(0.92, normalizedY));

      this.bird.targetY = clampedY * this.height;

      // Detect Flap sound on upward movement
      const dy = this.bird.targetY - this.bird.y;
      if (dy < -12) {
        soundEngine.playFlap();
      }

      this.bird.velocity = dy;
      this.bird.y += (this.bird.targetY - this.bird.y) * 0.35; // Smooth interpolation

      // Rotation angle based on vertical movement
      this.bird.rotation = Math.max(-0.4, Math.min(0.4, this.bird.velocity * 0.03));

      // Head X alignment option: Anchor bird near actual head position horizontally
      if (trackingStatus.headX) {
        // Mirrored camera coordinate
        const targetX = (1 - trackingStatus.headX) * this.width;
        this.bird.x += (targetX - this.bird.x) * 0.15;
      }
    }

    // 2. Animate Bird Wings
    this.bird.flapTimer++;
    if (this.bird.flapTimer % 6 === 0) {
      this.bird.flapFrame = (this.bird.flapFrame + 1) % 3;
    }

    // 3. Spawn Pipes
    this.pipeSpawnTimer++;
    if (this.pipeSpawnTimer >= this.pipeSpawnInterval) {
      this.pipeSpawnTimer = 0;
      this.spawnPipe();
    }

    // 4. Update Pipes & Check Collisions
    for (let i = this.pipes.length - 1; i >= 0; i--) {
      const pipe = this.pipes[i];
      pipe.x -= this.pipeSpeed;

      // Check if passed for score point
      if (!pipe.passed && pipe.x + this.pipeWidth < this.bird.x) {
        pipe.passed = true;
        this.score++;
        if (this.score > this.highScore) {
          this.highScore = this.score;
          localStorage.setItem('flip_bird_highscore', this.highScore.toString());
        }
        soundEngine.playScore();
        this.addScorePopup(pipe.x + this.pipeWidth / 2, pipe.topHeight + this.pipeGap / 2);
      }

      // Check Collision with Bird
      if (this.checkPipeCollision(pipe)) {
        this.triggerGameOver();
        return;
      }

      // Remove offscreen pipes
      if (pipe.x < -this.pipeWidth - 20) {
        this.pipes.splice(i, 1);
      }
    }

    // 5. Check Top / Bottom canvas boundary collision
    if (this.bird.y - this.bird.radius <= 0 || this.bird.y + this.bird.radius >= this.height) {
      this.triggerGameOver();
      return;
    }

    // 6. Update Particles FX
    this.updateParticles();
  }

  spawnPipe() {
    const minPipeHeight = 80;
    const maxPipeHeight = this.height - this.pipeGap - minPipeHeight;
    const topHeight = Math.floor(Math.random() * (maxPipeHeight - minPipeHeight + 1)) + minPipeHeight;

    this.pipes.push({
      x: this.width + 20,
      topHeight,
      bottomY: topHeight + this.pipeGap,
      passed: false
    });
  }

  checkPipeCollision(pipe) {
    const birdLeft = this.bird.x - this.bird.radius + 6;
    const birdRight = this.bird.x + this.bird.radius - 6;
    const birdTop = this.bird.y - this.bird.radius + 6;
    const birdBottom = this.bird.y + this.bird.radius - 6;

    const pipeLeft = pipe.x;
    const pipeRight = pipe.x + this.pipeWidth;

    // Horizontal overlap check
    if (birdRight > pipeLeft && birdLeft < pipeRight) {
      // Top Pipe collision
      if (birdTop < pipe.topHeight) {
        return true;
      }
      // Bottom Pipe collision
      if (birdBottom > pipe.bottomY) {
        return true;
      }
    }
    return false;
  }

  triggerGameOver() {
    this.state = 'GAME_OVER';
    soundEngine.playCollision();
    this.createExplosionParticles(this.bird.x, this.bird.y);
  }

  render(trackingStatus) {
    // Clear canvas (Background camera video element handles camera stream)
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw Pipes
    this.drawPipes();

    // Draw Bird attached near player head
    if (this.state === 'PLAYING' || this.state === 'GAME_OVER') {
      this.drawBird();
    }

    // Draw Particles & Score Popups
    this.drawParticles();
    this.drawScorePopups();
  }

  drawPipes() {
    for (const pipe of this.pipes) {
      const x = pipe.x;
      const topH = pipe.topHeight;
      const botY = pipe.bottomY;
      const botH = this.height - botY;

      // Pipe Colors (Arcade Green Gradient)
      const grad = this.ctx.createLinearGradient(x, 0, x + this.pipeWidth, 0);
      grad.addColorStop(0, '#22c55e');
      grad.addColorStop(0.3, '#4ade80');
      grad.addColorStop(0.7, '#16a34a');
      grad.addColorStop(1, '#15803d');

      const capGrad = this.ctx.createLinearGradient(x - 4, 0, x + this.pipeWidth + 4, 0);
      capGrad.addColorStop(0, '#4ade80');
      capGrad.addColorStop(0.5, '#86efac');
      capGrad.addColorStop(1, '#16a34a');

      // Top Pipe Body
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(x, 0, this.pipeWidth, topH);
      this.ctx.strokeStyle = '#052e16';
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(x, 0, this.pipeWidth, topH);

      // Top Pipe Rim Cap
      this.ctx.fillStyle = capGrad;
      this.ctx.fillRect(x - 4, topH - 24, this.pipeWidth + 8, 24);
      this.ctx.strokeRect(x - 4, topH - 24, this.pipeWidth + 8, 24);

      // Bottom Pipe Body
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(x, botY, this.pipeWidth, botH);
      this.ctx.strokeRect(x, botY, this.pipeWidth, botH);

      // Bottom Pipe Rim Cap
      this.ctx.fillStyle = capGrad;
      this.ctx.fillRect(x - 4, botY, this.pipeWidth + 8, 24);
      this.ctx.strokeRect(x - 4, botY, this.pipeWidth + 8, 24);
    }
  }

  drawBird() {
    this.ctx.save();
    this.ctx.translate(this.bird.x, this.bird.y);
    this.ctx.rotate(this.bird.rotation);

    // Bird Body (Bright Red/Orange Flappy Bird)
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, 22, 17, 0, 0, Math.PI * 2);
    this.ctx.fillStyle = '#f97316'; // Vibrant orange
    this.ctx.fill();
    this.ctx.lineWidth = 2.5;
    this.ctx.strokeStyle = '#7c2d12';
    this.ctx.stroke();

    // Belly/Chest highlight
    this.ctx.beginPath();
    this.ctx.ellipse(-4, 4, 12, 10, 0, 0, Math.PI * 2);
    this.ctx.fillStyle = '#fde047'; // Yellow chest
    this.ctx.fill();

    // Eye
    this.ctx.beginPath();
    this.ctx.arc(8, -6, 7, 0, Math.PI * 2);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fill();
    this.ctx.stroke();

    // Pupil
    this.ctx.beginPath();
    this.ctx.arc(10, -6, 3, 0, Math.PI * 2);
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fill();

    // Beak
    this.ctx.beginPath();
    this.ctx.moveTo(14, 0);
    this.ctx.lineTo(24, 4);
    this.ctx.lineTo(14, 8);
    this.ctx.closePath();
    this.ctx.fillStyle = '#ef4444';
    this.ctx.fill();
    this.ctx.stroke();

    // Wing flapping animation
    const wingY = [-6, -10, -2][this.bird.flapFrame];
    this.ctx.beginPath();
    this.ctx.ellipse(-8, wingY, 10, 6, -0.3, 0, Math.PI * 2);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.restore();
  }

  createExplosionParticles(x, y) {
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        radius: Math.random() * 5 + 2,
        color: ['#f97316', '#ef4444', '#fde047', '#ffffff'][Math.floor(Math.random() * 4)],
        alpha: 1
      });
    }
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.03;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const sp = this.scorePopups[i];
      sp.y -= 1.5;
      sp.alpha -= 0.02;
      if (sp.alpha <= 0) {
        this.scorePopups.splice(i, 1);
      }
    }
  }

  drawParticles() {
    for (const p of this.particles) {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  addScorePopup(x, y) {
    this.scorePopups.push({
      x,
      y,
      text: '+1',
      alpha: 1
    });
  }

  drawScorePopups() {
    for (const sp of this.scorePopups) {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, sp.alpha);
      this.ctx.font = 'bold 28px Outfit, sans-serif';
      this.ctx.fillStyle = '#4ade80';
      this.ctx.strokeStyle = '#052e16';
      this.ctx.lineWidth = 3;
      this.ctx.strokeText(sp.text, sp.x, sp.y);
      this.ctx.fillText(sp.text, sp.x, sp.y);
      this.ctx.restore();
    }
  }
}
