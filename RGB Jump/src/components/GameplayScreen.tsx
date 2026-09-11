import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, CheckCircle2, XCircle, Trophy, Flame } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';
import { poseDetector } from '../services/poseDetector';
import { COLOR_CONFIGS, DIFFICULTY_SETTINGS } from '../types/game';
import type { ColorZone, DifficultyMode } from '../types/game';

interface GameplayScreenProps {
  difficulty: DifficultyMode;
  highScore: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onGameOver: (finalScore: number, streak: number) => void;
  isMirrored: boolean;
}

export const GameplayScreen: React.FC<GameplayScreenProps> = ({
  difficulty,
  highScore,
  isMuted,
  onToggleMute,
  onGameOver,
  isMirrored,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Game Loop State
  const [targetColor, setTargetColor] = useState<ColorZone>('GREEN');
  const [score, setScore] = useState<number>(0);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [roundNumber, setRoundNumber] = useState<number>(1);

  // Round Timing State
  const diffConfig = DIFFICULTY_SETTINGS[difficulty];
  const [roundDuration, setRoundDuration] = useState<number>(diffConfig.initialTime);
  const [timeLeft, setTimeLeft] = useState<number>(diffConfig.initialTime);
  const [isRoundActive, setIsRoundActive] = useState<boolean>(false);

  // Current detected player position
  const playerZoneRef = useRef<ColorZone | null>(null);
  const playerDetectedRef = useRef<boolean>(false);

  // Result Feedback Popup
  const [feedback, setFeedback] = useState<{ type: 'SUCCESS' | 'FAILURE'; message: string } | null>(null);

  // Animation & Timer Refs
  const requestRef = useRef<number | null>(null);
  const roundTimerRef = useRef<number | null>(null);

  // Prevent immediate duplicate colors
  const lastColorRef = useRef<ColorZone | null>(null);

  // 1. Initialize Camera & Start First Round
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            startNewRound(1, diffConfig.initialTime);
          };
        }
      } catch (err) {
        console.error('Camera stream failure in Gameplay:', err);
      }
    };

    startCamera();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  // 2. Start Next Round Logic
  const startNewRound = (round: number, duration: number) => {
    setIsRoundActive(false);
    setFeedback(null);

    // Pick new random target color different from last
    const zones: ColorZone[] = ['RED', 'GREEN', 'BLUE'];
    let nextColor: ColorZone;
    do {
      nextColor = zones[Math.floor(Math.random() * zones.length)];
    } while (nextColor === lastColorRef.current && zones.length > 1);

    lastColorRef.current = nextColor;
    setTargetColor(nextColor);
    setRoundNumber(round);
    setRoundDuration(duration);
    setTimeLeft(duration);

    // Play Audio Cue for Color
    audioEngine.speakColor(nextColor);

    // Start 3-2-1 countdown tick
    setIsRoundActive(true);
  };

  // 3. Round Countdown Timer Loop
  useEffect(() => {
    if (!isRoundActive) return;

    const startTime = Date.now();
    const endTime = startTime + roundDuration * 1000;

    const interval = window.setInterval(() => {
      const now = Date.now();
      const remainingMs = Math.max(0, endTime - now);
      const remainingSec = remainingMs / 1000;

      setTimeLeft(remainingSec);

      // Play audio ticks at integer seconds
      if (Math.ceil(remainingSec) !== Math.ceil(remainingSec + 0.1)) {
        audioEngine.playCountdownTick(remainingSec <= 1.0);
      }

      // Time Expired -> Validate Position
      if (remainingMs <= 0) {
        clearInterval(interval);
        evaluateRoundResult();
      }
    }, 50);

    roundTimerRef.current = interval;

    return () => {
      clearInterval(interval);
    };
  }, [isRoundActive, roundDuration, targetColor]);

  // 4. Evaluate Player Position when Time Expires
  const evaluateRoundResult = () => {
    setIsRoundActive(false);

    const currentZone = playerZoneRef.current;
    const isDetected = playerDetectedRef.current;

    if (isDetected && currentZone === targetColor) {
      // SUCCESS!
      const newScore = score + 1;
      const newStreak = currentStreak + 1;
      setScore(newScore);
      setCurrentStreak(newStreak);

      audioEngine.playSuccess();
      setFeedback({ type: 'SUCCESS', message: 'PERFECT JUMP! +1' });

      // Ramp up difficulty (decrease round duration)
      const nextDuration = Math.max(
        diffConfig.minTime,
        roundDuration - diffConfig.timeDecreaseStep
      );

      // Trigger next round after short feedback flash
      setTimeout(() => {
        startNewRound(roundNumber + 1, nextDuration);
      }, 1000);
    } else {
      // FAILURE / GAME OVER
      audioEngine.playFailure();
      const failMsg = !isDetected
        ? 'NO PLAYER DETECTED!'
        : `WRONG ZONE! (You were in ${currentZone})`;

      setFeedback({ type: 'FAILURE', message: failMsg });

      setTimeout(() => {
        onGameOver(score, currentStreak);
      }, 1400);
    }
  };

  // 5. Canvas Render & Pose Detection Loop
  useEffect(() => {
    const processFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        const now = performance.now();
        const poseResults = poseDetector.detectPose(video, now);

        if (poseResults && poseResults.landmarks && poseResults.landmarks.length > 0) {
          const landmarks = poseResults.landmarks[0];
          const processed = poseDetector.processLandmarks(landmarks, isMirrored);

          if (processed) {
            playerZoneRef.current = processed.currentZone;
            playerDetectedRef.current = true;

            const ctx = canvas.getContext('2d');
            if (ctx) {
              poseDetector.drawOverlay(
                ctx,
                landmarks,
                processed.boundingBox,
                targetColor,
                isMirrored,
                canvas.width,
                canvas.height
              );
            }
          }
        } else {
          playerDetectedRef.current = false;
          playerZoneRef.current = null;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            poseDetector.drawOverlay(ctx, [], null, targetColor, isMirrored, canvas.width, canvas.height);
          }
        }
      }

      requestRef.current = requestAnimationFrame(processFrame);
    };

    requestRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isMirrored, targetColor]);

  // Compute countdown percentage for visual progress gauge
  const progressPercent = Math.max(0, Math.min(100, (timeLeft / roundDuration) * 100));
  const targetConfig = COLOR_CONFIGS[targetColor];

  return (
    <div className="gameplay-container">
      {/* 3-Strip Vertical Colored Background */}
      <div className="zone-strips-background">
        <div className={`strip red-strip ${targetColor === 'RED' ? 'active-target' : ''}`}>
          <span className="strip-label">RED</span>
        </div>
        <div className={`strip green-strip ${targetColor === 'GREEN' ? 'active-target' : ''}`}>
          <span className="strip-label">GREEN</span>
        </div>
        <div className={`strip blue-strip ${targetColor === 'BLUE' ? 'active-target' : ''}`}>
          <span className="strip-label">BLUE</span>
        </div>
      </div>

      {/* Camera Video Feed & Canvas Overlay */}
      <div className="gameplay-viewfinder">
        <video ref={videoRef} playsInline muted className={`webcam-video ${isMirrored ? 'mirrored' : ''}`} />
        <canvas ref={canvasRef} className="overlay-canvas" />
      </div>

      {/* Top HUD Overlay */}
      <div className="hud-top-bar">
        <div className="hud-metric">
          <span className="hud-label">SCORE</span>
          <span className="hud-value text-emerald-400">{score}</span>
        </div>

        <div className="hud-metric">
          <Flame className="w-5 h-5 text-amber-400 animate-bounce" />
          <span className="hud-label">STREAK</span>
          <span className="hud-value text-amber-400">{currentStreak}x</span>
        </div>

        <div className="hud-metric">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <span className="hud-label">HIGH SCORE</span>
          <span className="hud-value text-yellow-400">{highScore}</span>
        </div>

        <button onClick={onToggleMute} className="hud-mute-btn">
          {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-cyan-400" />}
        </button>
      </div>

      {/* Center Target Color Announcement */}
      <div className="center-target-announcement">
        <span className="prompt-subtitle">JUMP INTO</span>
        <h1 className="prompt-color-text" style={{ color: targetConfig.hex, textShadow: targetConfig.textShadow }}>
          {targetColor}
        </h1>

        {/* Progress Gauge Timer Bar */}
        <div className="timer-gauge-container">
          <div
            className="timer-gauge-fill"
            style={{
              width: `${progressPercent}%`,
              backgroundColor: targetConfig.hex,
              boxShadow: `0 0 15px ${targetConfig.hex}`,
            }}
          />
        </div>

        <div className="timer-number-display">
          <span>{timeLeft.toFixed(1)}s</span>
        </div>
      </div>

      {/* Result Flash Overlay Feedback */}
      {feedback && (
        <div className={`feedback-overlay ${feedback.type.toLowerCase()}`}>
          {feedback.type === 'SUCCESS' ? (
            <CheckCircle2 className="w-20 h-20 text-emerald-400 animate-ping mb-2" />
          ) : (
            <XCircle className="w-20 h-20 text-red-500 animate-bounce mb-2" />
          )}
          <h2>{feedback.message}</h2>
        </div>
      )}
    </div>
  );
};
