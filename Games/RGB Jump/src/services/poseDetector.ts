import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { BodyVisibility, ColorZone, LandmarkPoint, PlayerBoundingBox } from '../types/game';

type PoseLandmarkerResult = ReturnType<PoseLandmarker['detectForVideo']>;

// Standard MediaPipe Pose Landmark Indexes
const LANDMARK_INDEXES = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

// Skeleton connections for drawing
const POSE_CONNECTIONS = [
  [11, 12], // Shoulders
  [11, 23], [12, 24], // Torso sides
  [23, 24], // Hips
  [11, 13], [13, 15], // Left Arm
  [12, 14], [14, 16], // Right Arm
  [23, 25], [25, 27], // Left Leg
  [24, 26], [26, 28], // Right Leg
];

class PoseDetectorService {
  private poseLandmarker: PoseLandmarker | null = null;
  private isInitializing: boolean = false;
  private initError: string | null = null;

  public async initialize(): Promise<void> {
    if (this.poseLandmarker) return;
    if (this.isInitializing) return;

    this.isInitializing = true;
    this.initError = null;

    try {
      // Load WebAssembly binaries from CDN for reliable browser loading
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      console.log('MediaPipe Pose Landmarker successfully initialized!');
    } catch (err) {
      console.warn('GPU delegate failed or CDN fetch fallback, trying CPU mode...', err);
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
      } catch (cpuErr) {
        console.error('Failed to initialize Pose Landmarker:', cpuErr);
        this.initError = 'Failed to load Pose Detection model. Please check internet connection.';
        throw cpuErr;
      }
    } finally {
      this.isInitializing = false;
    }
  }

  public isReady(): boolean {
    return this.poseLandmarker !== null;
  }

  public getInitError(): string | null {
    return this.initError;
  }

  public detectPose(videoElement: HTMLVideoElement, timestampMs: number): PoseLandmarkerResult | null {
    if (!this.poseLandmarker || videoElement.readyState < 2) return null;
    try {
      return this.poseLandmarker.detectForVideo(videoElement, timestampMs);
    } catch (err) {
      console.error('Error during pose detection frame:', err);
      return null;
    }
  }

  /**
   * Determine horizontal ColorZone from landmarks
   */
  public calculateZone(centerX: number): ColorZone {
    if (centerX < 0.333) return 'RED';
    if (centerX < 0.666) return 'GREEN';
    return 'BLUE';
  }

  /**
   * Extract player body position metrics and bounding box
   */
  public processLandmarks(
    landmarks: LandmarkPoint[],
    isMirrored: boolean = true
  ): {
    centerX: number; // 0..1
    centerY: number; // 0..1
    boundingBox: PlayerBoundingBox;
    visibility: BodyVisibility;
    currentZone: ColorZone;
  } | null {
    if (!landmarks || landmarks.length === 0) return null;

    // Helper to mirror X if selfie mode
    const getX = (lm: LandmarkPoint) => (isMirrored ? 1.0 - lm.x : lm.x);
    const getY = (lm: LandmarkPoint) => lm.y;

    const nose = landmarks[LANDMARK_INDEXES.NOSE];
    const leftHip = landmarks[LANDMARK_INDEXES.LEFT_HIP];
    const rightHip = landmarks[LANDMARK_INDEXES.RIGHT_HIP];
    const leftAnkle = landmarks[LANDMARK_INDEXES.LEFT_ANKLE];
    const rightAnkle = landmarks[LANDMARK_INDEXES.RIGHT_ANKLE];

    // Center X calculation: Prefer hip midpoint, fallback to nose/torso
    let centerX = 0.5;
    let centerY = 0.5;

    if (leftHip && rightHip && (leftHip.visibility ?? 1) > 0.3 && (rightHip.visibility ?? 1) > 0.3) {
      centerX = (getX(leftHip) + getX(rightHip)) / 2;
      centerY = (getY(leftHip) + getY(rightHip)) / 2;
    } else if (nose && (nose.visibility ?? 1) > 0.3) {
      centerX = getX(nose);
      centerY = getY(nose);
    }

    // Compute bounding box around detected keypoints
    let minX = 1;
    let maxX = 0;
    let minY = 1;
    let maxY = 0;

    landmarks.forEach(lm => {
      const vis = lm.visibility ?? 1;
      if (vis > 0.25) {
        const px = getX(lm);
        const py = getY(lm);
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    });

    // Add padding to bounding box
    const paddingX = 0.04;
    const paddingY = 0.05;
    minX = Math.max(0, minX - paddingX);
    maxX = Math.min(1, maxX + paddingX);
    minY = Math.max(0, minY - paddingY);
    maxY = Math.min(1, maxY + paddingY);

    const currentZone = this.calculateZone(centerX);

    // Evaluate visibility checks for calibration
    const visThreshold = 0.4;
    const isNoseVisible = !!nose && (nose.visibility ?? 1) > visThreshold;
    const isLeftHipVisible = !!leftHip && (leftHip.visibility ?? 1) > visThreshold;
    const isRightHipVisible = !!rightHip && (rightHip.visibility ?? 1) > visThreshold;
    const isLeftAnkleVisible = !!leftAnkle && (leftAnkle.visibility ?? 1) > visThreshold;
    const isRightAnkleVisible = !!rightAnkle && (rightAnkle.visibility ?? 1) > visThreshold;

    const isFullBodyVisible =
      isNoseVisible && (isLeftHipVisible || isRightHipVisible) && (isLeftAnkleVisible || isRightAnkleVisible);

    return {
      centerX,
      centerY,
      currentZone,
      boundingBox: {
        minX,
        minY,
        maxX,
        maxY,
        centerX,
        centerY,
        currentZone,
      },
      visibility: {
        isNoseVisible,
        isLeftHipVisible,
        isRightHipVisible,
        isLeftAnkleVisible,
        isRightAnkleVisible,
        isFullBodyVisible,
      },
    };
  }

  /**
   * Draw pose skeleton, keypoints, bounding box, and target ghost overlay on canvas
   */
  public drawOverlay(
    ctx: CanvasRenderingContext2D,
    landmarks: LandmarkPoint[],
    boundingBox: PlayerBoundingBox | null,
    targetZone: ColorZone | null,
    isMirrored: boolean = true,
    width: number,
    height: number
  ) {
    ctx.clearRect(0, 0, width, height);

    // 1. Draw 3-Zone Dividers & Active Highlights
    const zoneWidth = width / 3;
    const zones: { zone: ColorZone; color: string; rgb: string; xStart: number }[] = [
      { zone: 'RED', color: '#FF2A6D', rgb: '255, 42, 109', xStart: 0 },
      { zone: 'GREEN', color: '#05FFA1', rgb: '5, 255, 161', xStart: zoneWidth },
      { zone: 'BLUE', color: '#00F0FF', rgb: '0, 240, 255', xStart: zoneWidth * 2 },
    ];

    zones.forEach(({ zone, color, rgb, xStart }) => {
      const isTarget = targetZone === zone;

      // Vertical line divider
      if (xStart > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.setLineDash([8, 8]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(xStart, 0);
        ctx.lineTo(xStart, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // If target zone, render glowing ghost guide & animated highlight strip
      if (isTarget) {
        // Target strip fill glow
        const gradient = ctx.createLinearGradient(xStart, 0, xStart + zoneWidth, 0);
        gradient.addColorStop(0, `rgba(${rgb}, 0.05)`);
        gradient.addColorStop(0.5, `rgba(${rgb}, 0.25)`);
        gradient.addColorStop(1, `rgba(${rgb}, 0.05)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(xStart, 0, zoneWidth, height);

        // Target zone border pulse
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        ctx.strokeRect(xStart + 4, 4, zoneWidth - 8, height - 8);
        ctx.shadowBlur = 0; // reset shadow

        // Draw Ghost/Silhouette Target Silhouette in target zone
        const ghostCenterX = xStart + zoneWidth / 2;
        const ghostCenterY = height * 0.55;
        this.drawGhostSilhouette(ctx, ghostCenterX, ghostCenterY, height * 0.45, color);
      }
    });

    // 2. Draw Skeleton Connections
    if (landmarks && landmarks.length > 0) {
      const getCanvasX = (lm: LandmarkPoint) => (isMirrored ? (1.0 - lm.x) * width : lm.x * width);
      const getCanvasY = (lm: LandmarkPoint) => lm.y * height;

      // Limbs
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.shadowColor = '#00F0FF';
      ctx.shadowBlur = 10;

      POSE_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const startLm = landmarks[startIdx];
        const endLm = landmarks[endIdx];
        if (startLm && endLm && (startLm.visibility ?? 1) > 0.3 && (endLm.visibility ?? 1) > 0.3) {
          ctx.beginPath();
          ctx.moveTo(getCanvasX(startLm), getCanvasY(startLm));
          ctx.lineTo(getCanvasX(endLm), getCanvasY(endLm));
          ctx.stroke();
        }
      });
      ctx.shadowBlur = 0;

      // Keypoint dots
      landmarks.forEach(lm => {
        if ((lm.visibility ?? 1) > 0.3) {
          const cx = getCanvasX(lm);
          const cy = getCanvasY(lm);

          ctx.fillStyle = '#05FFA1';
          ctx.beginPath();
          ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
          ctx.fill();

          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    }

    // 3. Draw Neon Bounding Box around player
    if (boundingBox) {
      const bx = boundingBox.minX * width;
      const by = boundingBox.minY * height;
      const bw = (boundingBox.maxX - boundingBox.minX) * width;
      const bh = (boundingBox.maxY - boundingBox.minY) * height;

      const zoneColorMap: Record<ColorZone, string> = {
        RED: '#FF2A6D',
        GREEN: '#05FFA1',
        BLUE: '#00F0FF',
      };
      const boxColor = zoneColorMap[boundingBox.currentZone];

      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 3;
      ctx.shadowColor = boxColor;
      ctx.shadowBlur = 15;

      // Corner accent style bounding box
      const cornerLen = Math.min(bw, bh) * 0.2;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(bx, by + cornerLen);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + cornerLen, by);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(bx + bw - cornerLen, by);
      ctx.lineTo(bx + bw, by);
      ctx.lineTo(bx + bw, by + cornerLen);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(bx, by + bh - cornerLen);
      ctx.lineTo(bx, by + bh);
      ctx.lineTo(bx + cornerLen, by + bh);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(bx + bw - cornerLen, by + bh);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx + bw, by + bh - cornerLen);
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Current Zone Badge Tag on top of bounding box
      ctx.fillStyle = boxColor;
      ctx.font = 'bold 14px "Outfit", sans-serif';
      const labelText = `ZONE: ${boundingBox.currentZone}`;
      const textWidth = ctx.measureText(labelText).width;

      ctx.fillRect(bx, by - 24, textWidth + 16, 24);
      ctx.fillStyle = '#000000';
      ctx.fillText(labelText, bx + 8, by - 7);
    }
  }

  /**
   * Draw glowing ghost silhouette guide in the target zone
   */
  private drawGhostSilhouette(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    color: string
  ) {
    ctx.save();
    ctx.translate(cx, cy);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;

    const headRadius = size * 0.12;
    const bodyHeight = size * 0.45;
    const shoulderWidth = size * 0.3;

    // Head
    ctx.beginPath();
    ctx.arc(0, -size * 0.35, headRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Torso & Limbs silhouette
    ctx.beginPath();

    // Shoulders
    ctx.moveTo(-shoulderWidth / 2, -size * 0.2);
    ctx.lineTo(shoulderWidth / 2, -size * 0.2);

    // Spine
    ctx.moveTo(0, -size * 0.2);
    ctx.lineTo(0, bodyHeight * 0.3);

    // Arms
    ctx.moveTo(-shoulderWidth / 2, -size * 0.2);
    ctx.lineTo(-shoulderWidth * 0.7, 0);

    ctx.moveTo(shoulderWidth / 2, -size * 0.2);
    ctx.lineTo(shoulderWidth * 0.7, 0);

    // Legs
    ctx.moveTo(0, bodyHeight * 0.3);
    ctx.lineTo(-shoulderWidth * 0.4, bodyHeight);

    ctx.moveTo(0, bodyHeight * 0.3);
    ctx.lineTo(shoulderWidth * 0.4, bodyHeight);

    ctx.stroke();

    ctx.restore();
  }
}

export const poseDetector = new PoseDetectorService();
