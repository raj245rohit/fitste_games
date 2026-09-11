import React, { useState, useEffect } from 'react';
import { StartScreen } from './components/StartScreen';
import { CalibrationScreen } from './components/CalibrationScreen';
import { GameplayScreen } from './components/GameplayScreen';
import { GameOverScreen } from './components/GameOverScreen';
import type { DifficultyMode, GameState } from './types/game';
import { audioEngine } from './services/audioEngine';

export const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('START');
  const [difficulty, setDifficulty] = useState<DifficultyMode>('NORMAL');

  // Persistence State
  const [highScore, setHighScore] = useState<number>(() => {
    const saved = localStorage.getItem('rgb_jump_highscore');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem('rgb_jump_muted') === 'true';
  });

  const [isMirrored, setIsMirrored] = useState<boolean>(true);

  // Game End Stats
  const [lastScore, setLastScore] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);

  useEffect(() => {
    audioEngine.setMuted(isMuted);
    localStorage.setItem('rgb_jump_muted', isMuted ? 'true' : 'false');
  }, [isMuted]);

  const handleToggleMute = () => {
    setIsMuted(prev => !prev);
  };

  const handleGameOver = (finalScore: number, streak: number) => {
    setLastScore(finalScore);
    setBestStreak(streak);

    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem('rgb_jump_highscore', finalScore.toString());
    }

    setGameState('GAMEOVER');
  };

  return (
    <div className="app-main">
      {gameState === 'START' && (
        <StartScreen
          highScore={highScore}
          difficulty={difficulty}
          onSelectDifficulty={setDifficulty}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onStart={() => setGameState('CALIBRATION')}
        />
      )}

      {gameState === 'CALIBRATION' && (
        <CalibrationScreen
          onCalibrationComplete={() => setGameState('GAMEPLAY')}
          onBackToMenu={() => setGameState('START')}
          isMirrored={isMirrored}
          onToggleMirror={() => setIsMirrored(prev => !prev)}
        />
      )}

      {gameState === 'GAMEPLAY' && (
        <GameplayScreen
          difficulty={difficulty}
          highScore={highScore}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onGameOver={handleGameOver}
          isMirrored={isMirrored}
        />
      )}

      {gameState === 'GAMEOVER' && (
        <GameOverScreen
          score={lastScore}
          bestStreak={bestStreak}
          highScore={highScore}
          difficulty={difficulty}
          onRestart={() => setGameState('GAMEPLAY')}
          onHome={() => setGameState('START')}
        />
      )}
    </div>
  );
};

export default App;
