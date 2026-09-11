export type ColorZone = 'RED' | 'GREEN' | 'BLUE';

export type GameState = 'START' | 'CALIBRATION' | 'GAMEPLAY' | 'GAMEOVER';

export type DifficultyMode = 'CASUAL' | 'NORMAL' | 'TURBO';

export interface BodyVisibility {
  isNoseVisible: boolean;
  isLeftHipVisible: boolean;
  isRightHipVisible: boolean;
  isLeftAnkleVisible: boolean;
  isRightAnkleVisible: boolean;
  isFullBodyVisible: boolean;
}

export interface PlayerBoundingBox {
  minX: number; // 0..1
  minY: number; // 0..1
  maxX: number; // 0..1
  maxY: number; // 0..1
  centerX: number; // 0..1
  centerY: number; // 0..1
  currentZone: ColorZone;
}

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface GameStats {
  score: number;
  highScore: number;
  bestStreak: number;
  currentStreak: number;
  totalRounds: number;
  correctJumps: number;
  averageReactionTime: number; // in seconds
}

export interface DifficultyConfig {
  initialTime: number; // seconds
  minTime: number; // seconds
  timeDecreaseStep: number; // seconds per round
  gracePeriod: number; // seconds after announcement before check
}

export const DIFFICULTY_SETTINGS: Record<DifficultyMode, DifficultyConfig> = {
  CASUAL: {
    initialTime: 4.0,
    minTime: 2.0,
    timeDecreaseStep: 0.1,
    gracePeriod: 0.5,
  },
  NORMAL: {
    initialTime: 3.0,
    minTime: 1.2,
    timeDecreaseStep: 0.15,
    gracePeriod: 0.4,
  },
  TURBO: {
    initialTime: 2.0,
    minTime: 0.8,
    timeDecreaseStep: 0.2,
    gracePeriod: 0.3,
  },
};

export const COLOR_CONFIGS: Record<ColorZone, { name: string; hex: string; bgGradient: string; textShadow: string }> = {
  RED: {
    name: 'RED',
    hex: '#FF2A6D',
    bgGradient: 'linear-gradient(180deg, rgba(255, 42, 109, 0.45) 0%, rgba(255, 42, 109, 0.15) 100%)',
    textShadow: '0 0 30px rgba(255, 42, 109, 0.8)',
  },
  GREEN: {
    name: 'GREEN',
    hex: '#05FFA1',
    bgGradient: 'linear-gradient(180deg, rgba(5, 255, 161, 0.45) 0%, rgba(5, 255, 161, 0.15) 100%)',
    textShadow: '0 0 30px rgba(5, 255, 161, 0.8)',
  },
  BLUE: {
    name: 'BLUE',
    hex: '#00F0FF',
    bgGradient: 'linear-gradient(180deg, rgba(0, 240, 255, 0.45) 0%, rgba(0, 240, 255, 0.15) 100%)',
    textShadow: '0 0 30px rgba(0, 240, 255, 0.8)',
  },
};
