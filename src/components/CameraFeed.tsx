import React, { useRef, useEffect, useState } from 'react';
import { Camera, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { loadFaceModels, detectFaceDescriptor, detectFacePresence } from '../services/faceService';

interface CameraFeedProps {
  onCapture: (imageSrc: string, descriptor: number[]) => void;
  statusText: string;
  setStatusText: (status: string) => void;
}

export const CameraFeed: React.FC<CameraFeedProps> = ({ onCapture, statusText, setStatusText }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [hasCameraError, setHasCameraError] = useState<boolean>(false);
  const [isProcessingFace, setIsProcessingFace] = useState<boolean>(false);
  const [faceDetected, setFaceDetected] = useState<boolean>(false);

  // Load models on mount
  useEffect(() => {
    async function init() {
      try {
        setStatusText('Loading AI face models...');
        await loadFaceModels();
        setIsLoadingModels(false);
        setStatusText('AI models loaded. Starting camera...');
      } catch (err) {
        console.error(err);
        setStatusText('Failed to load AI models.');
        setIsLoadingModels(false);
      }
    }
    init();
  }, [setStatusText]);

  // Handle camera stream setup
  useEffect(() => {
    if (isLoadingModels) return;

    let activeStream: MediaStream | null = null;
    
    async function startCamera() {
      try {
        setHasCameraError(false);
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
          audio: false,
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play();
        }
        
        activeStream = mediaStream;
        setCameraActive(true);
        setStatusText('Position your face in the frame');
      } catch (err) {
        console.warn('Camera access denied or unavailable:', err);
        setHasCameraError(true);
        setStatusText('Webcam access error. Please grant permissions and reload.');
      }
    }

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isLoadingModels, setStatusText]);

  // Face detection loop on video frames
  useEffect(() => {
    if (!cameraActive || isProcessingFace) return;

    let active = true;
    let timerId: NodeJS.Timeout;

    const runDetection = async () => {
      if (!videoRef.current || !canvasRef.current || !active) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Match canvas dimensions to video dimensions
      if (video.videoWidth > 0 && canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      // Only detect if video stream is fully loaded and playing
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        try {
          const hasFace = await detectFacePresence(video);
          if (hasFace && active) {
            setFaceDetected(true);
            setStatusText('Face detected! Click verify to capture.');
          } else if (active) {
            setFaceDetected(false);
            setStatusText('Position your face in the frame');
          }
        } catch (err) {
          // Lenient error handling during stream ticks
          console.debug('Detection tick warning:', err);
        }
      }

      if (active) {
        timerId = setTimeout(runDetection, 600); // Check every 600ms
      }
    };

    runDetection();

    return () => {
      active = false;
      clearTimeout(timerId);
    };
  }, [cameraActive, isProcessingFace, setStatusText]);

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsProcessingFace(true);
    setStatusText('Processing biometric scan...');

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      setIsProcessingFace(false);
      return;
    }

    // Mirror image drawing logic (aligns with client mirror preview)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    const imageSrc = canvas.toDataURL('image/jpeg', 0.85);

    try {
      // Run detection on the captured static canvas instead of live video
      const result = await detectFaceDescriptor(canvas);
      if (result) {
        onCapture(imageSrc, Array.from(result.descriptor));
      } else {
        // Fallback descriptor if lighting is poor
        onCapture(imageSrc, []);
      }
    } catch (err) {
      console.error(err);
      setStatusText('Biometric processing failed. Try again.');
      // Empty array fallback to let them proceed with warning
      onCapture(imageSrc, []);
    } finally {
      setIsProcessingFace(false);
    }
  };

  if (isLoadingModels) {
    return (
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '280px', gap: '1rem', borderStyle: 'dashed' }}>
        <RefreshCw className="pulse-primary text-primary-color" size={32} style={{ animation: 'spin 2s linear infinite' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{statusText}</p>
      </div>
    );
  }

  if (hasCameraError) {
    return (
      <div className="glass-card animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'center', borderColor: 'var(--color-rose)', borderStyle: 'dashed' }}>
        <AlertCircle className="text-rose animate-pulse" size={32} style={{ margin: '0 auto' }} />
        <h4 style={{ fontSize: '1rem', color: 'var(--color-rose)' }}>Camera Required</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          Biometric file uploads have been disabled. Supervisors must check in using a live camera feed. Please grant webcam permissions to continue.
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="camera-container">
          <video ref={videoRef} className="camera-video" muted playsInline style={{ transform: 'scaleX(-1)' }} />
          <canvas ref={canvasRef} className="camera-canvas" style={{ display: 'none' }} />
          
          {/* HUD Overlay brackets */}
          <div className="scanner-overlay">
            <div className="scanner-bracket top-left"></div>
            <div className="scanner-bracket top-right"></div>
            <div className="scanner-bracket bottom-left"></div>
            <div className="scanner-bracket bottom-right"></div>
            
            {!faceDetected && (
              <div className="scanner-laser"></div>
            )}
          </div>

          {isProcessingFace && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(10, 12, 16, 0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
              <RefreshCw className="text-primary-color" style={{ animation: 'spin 1.5s linear infinite' }} size={28} />
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Scanning Face...</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={capturePhoto}
            className={`btn ${faceDetected ? 'btn-emerald pulse-primary' : 'btn-primary'}`}
            disabled={isProcessingFace}
            style={{ width: '100%' }}
          >
            <Camera size={18} />
            {faceDetected ? 'Verify & Check In' : 'Capture & Verify'}
          </button>
        </div>
      </div>

      {/* Dynamic feedback message */}
      <div style={{
        marginTop: '0.75rem',
        padding: '0.75rem',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.8rem'
      }}>
        {faceDetected ? (
          <CheckCircle className="text-emerald" size={14} />
        ) : (
          <AlertCircle className="text-amber" size={14} />
        )}
        <span style={{ color: faceDetected ? '#34d399' : 'var(--text-secondary)' }}>
          {statusText}
        </span>
      </div>
    </div>
  );
};
