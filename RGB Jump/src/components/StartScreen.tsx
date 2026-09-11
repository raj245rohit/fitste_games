import React from 'react';
import { Play, Trophy, Volume2, VolumeX, Zap, Sparkles, ShieldCheck } from 'lucide-react';
import type { DifficultyMode } from '../types/game';
import { DIFFICULTY_SETTINGS } from '../types/game';

interface StartScreenProps {
  highScore: number;
  difficulty: DifficultyMode;
  onSelectDifficulty: (mode: DifficultyMode) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onStart: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  highScore,
  difficulty,
  onSelectDifficulty,
  isMuted,
  onToggleMute,
  onStart,
}) => {
  return (
    <div className="start-screen-container">
      {/* Background ambient lighting */}
      <div className="bg-glow red-glow" />
      <div className="bg-glow green-glow" />
      <div className="bg-glow blue-glow" />

      {/* Audio Mute Button */}
      <button
        onClick={onToggleMute}
        className="icon-button mute-button"
        title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
      >
        {isMuted ? <VolumeX className="w-6 h-6 text-red-400" /> : <Volume2 className="w-6 h-6 text-cyan-400" />}
      </button>

      <div className="start-content-card">
        {/* Badge & High Score */}
        <div className="top-badge">
          <Trophy className="w-5 h-5 text-amber-400 animate-bounce" />
          <span>HIGH SCORE: <strong>{highScore}</strong> JUMPS</span>
        </div>

        {/* Title Logo */}
        <div className="logo-container">
          <h1 className="logo-title">
            <span className="text-red">R</span>
            <span className="text-green">G</span>
            <span className="text-blue">B</span>
            <span className="logo-space">&nbsp;</span>
            <span className="text-white logo-jump">JUMP</span>
          </h1>
          <p className="subtitle">Interactive Camera Fitness Challenge</p>
        </div>

        {/* How To Play */}
        <div className="rules-section">
          <h3 className="section-heading">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            HOW TO PLAY
          </h3>
          <div className="rules-grid">
            <div className="rule-card red-border">
              <div className="rule-step">01</div>
              <p>Stand in front of webcam in a clear, well-lit space</p>
            </div>
            <div className="rule-card green-border">
              <div className="rule-step">02</div>
              <p>Listen for audio callouts (<strong>RED</strong>, <strong>GREEN</strong>, or <strong>BLUE</strong>)</p>
            </div>
            <div className="rule-card blue-border">
              <div className="rule-step">03</div>
              <p>Physical jump/move into target zone before timer hits zero!</p>
            </div>
          </div>
        </div>

        {/* Difficulty Selector */}
        <div className="difficulty-section">
          <h3 className="section-heading">
            <Zap className="w-4 h-4 text-amber-400" />
            SELECT DIFFICULTY
          </h3>
          <div className="difficulty-buttons">
            {(['CASUAL', 'NORMAL', 'TURBO'] as DifficultyMode[]).map((mode) => {
              const cfg = DIFFICULTY_SETTINGS[mode];
              const isSelected = difficulty === mode;
              return (
                <button
                  key={mode}
                  onClick={() => onSelectDifficulty(mode)}
                  className={`difficulty-btn ${mode.toLowerCase()} ${isSelected ? 'active' : ''}`}
                >
                  <span className="mode-name">{mode}</span>
                  <span className="mode-desc">{cfg.initialTime}s Countdown</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Start Game Action */}
        <button onClick={onStart} className="primary-start-btn">
          <Play className="w-7 h-7 fill-current" />
          <span>START CALIBRATION & GAME</span>
        </button>

        {/* Privacy Note */}
        <div className="privacy-note">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Camera feed is processed 100% locally on your device for pose tracking. No video is recorded or sent to any server.</span>
        </div>
      </div>
    </div>
  );
};
