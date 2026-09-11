import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, RefreshCw, FlipHorizontal, AlertTriangle, ArrowRight, UserCheck } from 'lucide-react';
import { poseDetector } from '../services/poseDetector';
import type { BodyVisibility, ColorZone } from '../types/game';

interface CalibrationScreenProps {
  onCalibrationComplete: () => void;
  onBackToMenu: () => void;
  isMirrored: boolean;
  onToggleMirror: () => void;
}

export const CalibrationScreen: React.FC<CalibrationScreenProps> = ({
  onCalibrationComplete,
  onBackToMenu,
  isMirrored,
  onToggleMirror,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isLoadingModel, setIsLoadingModel] = useState<boolean>(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [visibility, setVisibility] = useState<BodyVisibility>({
    isNoseVisible: false,
    isLeftHipVisible: false,
    isRightHipVisible: false,
    isLeftAnkleVisible: false,
    isRightAnkleVisible: false,
    isFullBodyVisible: false,
  });

  const [currentDetectedZone, setCurrentDetectedZone] = useState<ColorZone | null>('GREEN');

  // Animation Loop Ref
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    // 1. Initialize Pose Landmarker Model
    const initModelAndCamera = async () => {
      try {
        setIsLoadingModel(true);
        await poseDetector.initialize();
        setIsLoadingModel(false);
      } catch (err) {
        console.error('Pose Detector model init error:', err);
        setModelError('Failed to initialize AI Pose Detector model. Check internet connection.');
        setIsLoadingModel(false);
        return;
      }

      // 2. Start Video Webcam Stream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setCameraActive(true);
          };
        }
      } catch (camErr) {
        console.error('Camera stream access denied:', camErr);
        setCameraError('Webcam access was denied or no camera found. Please allow camera permissions.');
      }
    };

    initModelAndCamera();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Frame Processing Loop
  useEffect(() => {
    if (!cameraActive || isLoadingModel) return;

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
            setVisibility(processed.visibility);
            setCurrentDetectedZone(processed.currentZone);

            const ctx = canvas.getContext('2d');
            if (ctx) {
              poseDetector.drawOverlay(
                ctx,
                landmarks,
                processed.boundingBox,
                processed.currentZone,
                isMirrored,
                canvas.width,
                canvas.height
              );
            }
          }
        } else {
          // Clear overlay if no body detected
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
          setVisibility({
            isNoseVisible: false,
            isLeftHipVisible: false,
            isRightHipVisible: false,
            isLeftAnkleVisible: false,
            isRightAnkleVisible: false,
            isFullBodyVisible: false,
          });
        }
      }

      requestRef.current = requestAnimationFrame(processFrame);
    };

    requestRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [cameraActive, isLoadingModel, isMirrored]);

  return (
    <div className="calibration-container">
      {/* Header Bar */}
      <div className="calibration-header">
        <button onClick={onBackToMenu} className="back-btn">
          &larr; Back to Menu
        </button>
        <h2 className="calibration-title">
          <Camera className="w-6 h-6 text-cyan-400" />
          CAMERA & BODY CALIBRATION
        </h2>
        <button onClick={onToggleMirror} className="mirror-toggle-btn">
          <FlipHorizontal className="w-4 h-4" />
          {isMirrored ? 'Mirroring: ON' : 'Mirroring: OFF'}
        </button>
      </div>

      <div className="calibration-body">
        {/* Main Camera Feed Viewfinder */}
        <div className="viewfinder-box">
          {/* Video Stream */}
          <video
            ref={videoRef}
            playsInline
            muted
            className={`webcam-video ${isMirrored ? 'mirrored' : ''}`}
          />
          {/* Canvas Skeleton Overlay */}
          <canvas ref={canvasRef} className="overlay-canvas" />

          {/* Loading / Error States */}
          {isLoadingModel && (
            <div className="overlay-status-modal">
              <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin mb-3" />
              <p>Loading AI Pose Detection Engine...</p>
            </div>
          )}

          {cameraError && (
            <div className="overlay-status-modal error">
              <AlertTriangle className="w-10 h-10 text-red-400 mb-2" />
              <p>{cameraError}</p>
            </div>
          )}

          {modelError && (
            <div className="overlay-status-modal error">
              <AlertTriangle className="w-10 h-10 text-red-400 mb-2" />
              <p>{modelError}</p>
            </div>
          )}

          {/* Zone Helper Bands Overlay */}
          <div className="zone-bands-overlay">
            <div className={`zone-band red ${currentDetectedZone === 'RED' ? 'active' : ''}`}>
              <span>RED (LEFT)</span>
            </div>
            <div className={`zone-band green ${currentDetectedZone === 'GREEN' ? 'active' : ''}`}>
              <span>GREEN (CENTER)</span>
            </div>
            <div className={`zone-band blue ${currentDetectedZone === 'BLUE' ? 'active' : ''}`}>
              <span>BLUE (RIGHT)</span>
            </div>
          </div>
        </div>

        {/* Right Side Calibration Diagnostics & Controls */}
        <div className="calibration-sidebar">
          <div className="diag-card">
            <h3>
              <UserCheck className="w-5 h-5 text-emerald-400" />
              BODY TRACKING STATUS
            </h3>

            <div className="check-list">
              <div className={`check-item ${visibility.isNoseVisible ? 'pass' : 'fail'}`}>
                <CheckCircle2 className="w-4 h-4" />
                <span>Head / Face Visible</span>
              </div>
              <div className={`check-item ${visibility.isLeftHipVisible || visibility.isRightHipVisible ? 'pass' : 'fail'}`}>
                <CheckCircle2 className="w-4 h-4" />
                <span>Torso / Hips Visible</span>
              </div>
              <div className={`check-item ${visibility.isLeftAnkleVisible || visibility.isRightAnkleVisible ? 'pass' : 'fail'}`}>
                <CheckCircle2 className="w-4 h-4" />
                <span>Lower Body / Feet Visible</span>
              </div>
            </div>

            <div className="zone-test-box">
              <span className="label">CURRENT TEST ZONE:</span>
              <span className={`zone-pill ${currentDetectedZone?.toLowerCase()}`}>
                {currentDetectedZone || 'NONE DETECTED'}
              </span>
            </div>

            <p className="instruction-tip">
              💡 <strong>Tip:</strong> Stand 6-8 feet away from webcam so your full upper and lower body are visible in the frame.
            </p>
          </div>

          <button
            onClick={onCalibrationComplete}
            disabled={!cameraActive || isLoadingModel}
            className="ready-start-btn"
          >
            <span>READY TO JUMP!</span>
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
