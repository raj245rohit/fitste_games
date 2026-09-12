import { FilesetResolver, PoseLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';

export class PoseTracker {
  constructor() {
    this.poseLandmarker = null;
    this.faceLandmarker = null;
    this.videoElement = null;
    this.canvasElement = null;
    this.canvasCtx = null;
    this.isReady = false;
    
    // Smooth head position tracking
    this.smoothedHeadY = 0.5; // Normalized 0-1 (0 top, 1 bottom)
    this.smoothedHeadX = 0.5;
    this.headAngle = 0;
    this.smoothingFactor = 0.25;

    // Push-up Rep Tracking
    this.pushUpState = 'UP'; // 'UP' or 'DOWN'
    this.pushUpCount = 0;
    this.repProgress = 0; // 0 to 1

    // Posture status
    this.postureStatus = {
      isValid: false,
      message: 'Initializing camera...',
      code: 'INITIALIZING',
      bodyAngle: 0,
      headY: 0.5
    };

    this.lastVideoTime = -1;
  }

  async init(videoElement, overlayCanvas) {
    this.videoElement = videoElement;
    this.canvasElement = overlayCanvas;
    if (this.canvasElement) {
      this.canvasCtx = this.canvasElement.getContext('2d');
    }

    try {
      // Load WASM binaries from CDN
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      // Create Pose Landmarker
      try {
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numPoses: 1
        });
      } catch (err) {
        console.warn('GPU delegate failed for PoseLandmarker, falling back to CPU:', err);
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          numPoses: 1
        });
      }

      // Create Face Landmarker for precise head orientation
      try {
        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numFaces: 1
        });
      } catch (err) {
        console.warn('FaceLandmarker fallback to CPU:', err);
        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          numFaces: 1
        });
      }

      this.isReady = true;
      console.log('MediaPipe Vision tasks initialized successfully.');
    } catch (e) {
      console.error('Failed to initialize MediaPipe Vision:', e);
      this.postureStatus = {
        isValid: false,
        message: 'Camera / AI initialization failed. Please check camera permissions.',
        code: 'INIT_ERROR',
        bodyAngle: 0,
        headY: 0.5
      };
    }
  }

  async startCamera(onFrameCallback) {
    if (this.videoElement) {
      this.videoElement.setAttribute('playsinline', '');
      this.videoElement.setAttribute('webkit-playsinline', '');
      this.videoElement.setAttribute('muted', '');
      this.videoElement.muted = true;
    }

    let getUserMediaFn = null;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      getUserMediaFn = (constraints) => navigator.mediaDevices.getUserMedia(constraints);
    } else if (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia) {
      const legacyFn = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
      getUserMediaFn = (constraints) => new Promise((resolve, reject) => legacyFn.call(navigator, constraints, resolve, reject));
    }

    if (!getUserMediaFn) {
      const isHttp = !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
      if (isHttp) {
        alert('🔒 HTTPS Required for Mobile Camera Access\n\nMobile browsers (iOS Safari & Android Chrome) disable camera permissions over HTTP.\n\nPlease open this webpage using HTTPS (or set up an SSL certificate / Cloudflare Tunnel on your server).');
      } else {
        alert('Camera access is not supported by your browser or permission was denied.');
      }
      return false;
    }

    try {
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      let stream;
      try {
        stream = await getUserMediaFn(constraints);
      } catch (err) {
        console.warn('Ideal video constraints failed, trying basic facingMode constraint:', err);
        try {
          stream = await getUserMediaFn({ video: { facingMode: 'user' }, audio: false });
        } catch (err2) {
          console.warn('FacingMode constraint failed, trying default video:', err2);
          stream = await getUserMediaFn({ video: true, audio: false });
        }
      }

      this.videoElement.srcObject = stream;

      return new Promise((resolve) => {
        const playPromise = () => {
          this.videoElement.play().then(() => resolve(true)).catch(() => resolve(true));
        };

        if (this.videoElement.readyState >= 2) {
          playPromise();
        } else {
          this.videoElement.onloadedmetadata = playPromise;
        }
      });
    } catch (err) {
      console.error('Error opening camera stream:', err);
      alert('Could not access camera. Please check camera permissions in your browser settings.');
      return false;
    }
  }

  processFrame(timestamp) {
    if (!this.isReady || !this.videoElement || this.videoElement.paused || this.videoElement.ended) {
      return this.postureStatus;
    }

    if (this.videoElement.currentTime === this.lastVideoTime) {
      return this.postureStatus;
    }
    this.lastVideoTime = this.videoElement.currentTime;

    // Detect pose
    let poseResults = null;
    let faceResults = null;

    if (this.poseLandmarker) {
      poseResults = this.poseLandmarker.detectForVideo(this.videoElement, timestamp);
    }
    if (this.faceLandmarker) {
      faceResults = this.faceLandmarker.detectForVideo(this.videoElement, timestamp);
    }

    this.analyzePoseAndFace(poseResults, faceResults);
    return this.postureStatus;
  }

  analyzePoseAndFace(poseResults, faceResults) {
    const hasPose = poseResults && poseResults.landmarks && poseResults.landmarks.length > 0;
    const hasFace = faceResults && faceResults.faceLandmarks && faceResults.faceLandmarks.length > 0;

    if (!hasPose && !hasFace) {
      this.postureStatus = {
        isValid: false,
        message: 'No player detected. Position camera in front of you.',
        code: 'NO_PLAYER',
        bodyAngle: 0,
        headY: this.smoothedHeadY
      };
      return;
    }

    // Key Pose landmarks (MediaPipe index):
    // 0: nose, 2: left_eye, 5: right_eye, 7: left_ear, 8: right_ear
    // 11: left_shoulder, 12: right_shoulder
    // 23: left_hip, 24: right_hip
    // 25: left_knee, 26: right_knee
    // 27: left_ankle, 28: right_ankle
    const pose = hasPose ? poseResults.landmarks[0] : null;
    const face = hasFace ? faceResults.faceLandmarks[0] : null;

    // Determine raw Head Position (X, Y)
    let rawHeadX = 0.5;
    let rawHeadY = 0.5;

    if (face && face.length > 0) {
      // Use nose or face center
      rawHeadX = face[1].x; // Nose tip in FaceMesh
      rawHeadY = face[1].y;
    } else if (pose && pose[0]) {
      rawHeadX = pose[0].x;
      rawHeadY = pose[0].y;
    }

    // Exponential smoothing for head position
    this.smoothedHeadX += (rawHeadX - this.smoothedHeadX) * this.smoothingFactor;
    this.smoothedHeadY += (rawHeadY - this.smoothedHeadY) * this.smoothingFactor;

    // Validate Push-Up Posture if Pose landmarks exist
    let isValid = false;
    let code = 'VALID';
    let message = 'Great Push-up Posture!';
    let bodyAngle = 180;

    if (pose) {
      const nose = pose[0];
      const leftShoulder = pose[11];
      const rightShoulder = pose[12];
      const leftHip = pose[23];
      const rightHip = pose[24];
      const leftAnkle = pose[27] || pose[25]; // Ankle or Knee
      const rightAnkle = pose[28] || pose[26];

      // Midpoints
      const shoulderMid = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2,
        visibility: (leftShoulder.visibility + rightShoulder.visibility) / 2
      };
      const hipMid = {
        x: (leftHip.x + rightHip.x) / 2,
        y: (leftHip.y + rightHip.y) / 2,
        visibility: (leftHip.visibility + rightHip.visibility) / 2
      };
      const legMid = {
        x: (leftAnkle.x + rightAnkle.x) / 2,
        y: (leftAnkle.y + rightAnkle.y) / 2,
        visibility: (leftAnkle.visibility + rightAnkle.visibility) / 2
      };

      // Check visibility of shoulders and hips
      if (shoulderMid.visibility < 0.3 || hipMid.visibility < 0.3) {
        isValid = false;
        code = 'BODY_NOT_VISIBLE';
        message = 'Position your full body in camera view';
      } else {
        // Calculate Shoulder-Hip-Ankle Angle
        bodyAngle = this.calculateAngle(shoulderMid, hipMid, legMid);

        // Standard straight push-up line is between 145° and 180°
        if (bodyAngle < 135) {
          isValid = false;
          code = 'HIPS_SAGGING_OR_PIKING';
          message = 'Keep body straight! Don\'t bend your hips';
        } else {
          isValid = true;
          code = 'POSTURE_OK';
          message = 'Push-Up Posture Verified!';
        }
      }

      // Track push-up rep cycle (head moving low then high)
      this.trackPushUpReps(this.smoothedHeadY);
    } else {
      // Fallback: If face detected, count posture valid for head-only testing
      isValid = true;
      code = 'HEAD_ONLY';
      message = 'Head Tracked (Adjust camera to show shoulders & hips for full posture checks)';
    }

    this.postureStatus = {
      isValid,
      message,
      code,
      bodyAngle: Math.round(bodyAngle),
      headX: this.smoothedHeadX,
      headY: this.smoothedHeadY,
      reps: this.pushUpCount
    };
  }

  calculateAngle(A, B, C) {
    // Angle at vertex B (Shoulder-Hip-Leg)
    const radians = Math.atan2(C.y - B.y, C.x - B.x) - Math.atan2(A.y - B.y, A.x - B.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) {
      angle = 360.0 - angle;
    }
    return angle;
  }

  trackPushUpReps(headY) {
    // Dynamic thresholds for push up depth (top vs bottom)
    const UP_THRESHOLD = 0.42;
    const DOWN_THRESHOLD = 0.62;

    if (this.pushUpState === 'UP' && headY > DOWN_THRESHOLD) {
      this.pushUpState = 'DOWN';
    } else if (this.pushUpState === 'DOWN' && headY < UP_THRESHOLD) {
      this.pushUpState = 'UP';
      this.pushUpCount++;
    }

    // Rep progress range [0 to 1]
    this.repProgress = Math.min(1, Math.max(0, (headY - UP_THRESHOLD) / (DOWN_THRESHOLD - UP_THRESHOLD)));
  }

  drawSkeletalOverlay(poseResults) {
    if (!this.canvasCtx || !this.canvasElement || !this.videoElement) return;

    const ctx = this.canvasCtx;
    const width = (this.canvasElement.width = this.videoElement.videoWidth || 640);
    const height = (this.canvasElement.height = this.videoElement.videoHeight || 480);

    ctx.clearRect(0, 0, width, height);

    if (this.postureStatus && this.postureStatus.headX) {
      // Draw tracked head target indicator
      const hx = (1 - this.postureStatus.headX) * width; // Mirrored
      const hy = this.postureStatus.headY * height;

      ctx.save();
      ctx.beginPath();
      ctx.arc(hx, hy, 28, 0, 2 * Math.PI);
      ctx.strokeStyle = this.postureStatus.isValid ? 'rgba(74, 222, 128, 0.8)' : 'rgba(248, 113, 113, 0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = this.postureStatus.isValid ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)';
      ctx.fill();
      ctx.restore();
    }
  }

  resetReps() {
    this.pushUpCount = 0;
    this.pushUpState = 'UP';
  }
}
