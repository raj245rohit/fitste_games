import React, { useEffect } from 'react';
import { RotateCcw, Home, Trophy, Flame, Award, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { audioEngine } from '../services/audioEngine';
import type { DifficultyMode } from '../types/game';

interface GameOverScreenProps {
  score: number;
  bestStreak: number;
  highScore: number;
  difficulty: DifficultyMode;
  onRestart: () => void;
  onHome: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  score,
  bestStreak,
  highScore,
  difficulty,
  onRestart,
  onHome,
}) => {
  const isNewHighScore = score > 0 && score >= highScore;

  useEffect(() => {
    if (isNewHighScore) {
      audioEngine.playHighScoreFanfare();

      // Trigger Confetti explosion
      const duration = 2.5 * 1000;
      const animationEnd = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#FF2A6D', '#05FFA1', '#00F0FF', '#FFB703'],
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#FF2A6D', '#05FFA1', '#00F0FF', '#FFB703'],
        });

        if (Date.now() < animationEnd) {
          requestAnimationFrame(frame);
        }
      };

      frame();
    }
  }, [isNewHighScore]);

  return (
    <div className="gameover-container">
      <div className="gameover-card">
        {/* New High Score Banner */}
        {isNewHighScore ? (
          <div className="new-record-banner">
            <Sparkles className="w-5 h-5 text-yellow-300 animate-spin" />
            <span>NEW HIGH SCORE RECORD!</span>
            <Sparkles className="w-5 h-5 text-yellow-300 animate-spin" />
          </div>
        ) : (
          <div className="gameover-title">GAME OVER</div>
        )}

        {/* Score Circle Display */}
        <div className="score-display-box">
          <span className="score-label">FINAL SCORE</span>
          <h1 className="score-number">{score}</h1>
          <span className="score-unit">SUCCESSFUL JUMPS</span>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div className="stat-info">
              <span className="stat-label">HIGH SCORE</span>
              <span className="stat-val">{Math.max(score, highScore)}</span>
            </div>
          </div>

          <div className="stat-card">
            <Flame className="w-5 h-5 text-orange-400" />
            <div className="stat-info">
              <span className="stat-label">BEST STREAK</span>
              <span className="stat-val">{bestStreak}x</span>
            </div>
          </div>

          <div className="stat-card">
            <Award className="w-5 h-5 text-cyan-400" />
            <div className="stat-info">
              <span className="stat-label">DIFFICULTY</span>
              <span className="stat-val">{difficulty}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="gameover-actions">
          <button onClick={onRestart} className="action-btn restart-btn">
            <RotateCcw className="w-6 h-6" />
            <span>PLAY AGAIN</span>
          </button>

          <button onClick={onHome} className="action-btn home-btn">
            <Home className="w-6 h-6" />
            <span>MAIN MENU</span>
          </button>
        </div>
      </div>
    </div>
  );
};
