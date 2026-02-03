"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { X, Camera, Upload, Loader2, Zap, Video, FileText, QrCode } from "lucide-react";

interface MobileCameraProps {
  spec: {
    id: string;
    code: string;
    requirement: string;
    requirementAr: string;
    evidenceType: string;
  };
  onCapture: (imageBase64: string) => void;
  onSkip: () => void;
  onClose: () => void;
}

export default function MobileCamera({ spec, onCapture, onSkip, onClose }: MobileCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);

  // Start camera on mount
  useEffect(() => {
    let mounted = true;

    const startCamera = async () => {
      try {
        // Stop any existing stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        console.log("[MobileCamera] Starting camera...");

        // Request camera with rear-facing preference
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 },
          },
          audio: false,
        });

        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        console.log("[MobileCamera] Got stream");
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          console.log("[MobileCamera] Video playing");
          setCameraReady(true);
        }
      } catch (err: any) {
        console.error("[MobileCamera] Error:", err);
        if (mounted) {
          if (err.name === "NotAllowedError") {
            setError("Camera access denied. Please allow camera in settings.");
          } else if (err.name === "NotFoundError") {
            setError("No camera found on this device.");
          } else {
            setError(`Camera error: ${err.message}`);
          }
        }
      }
    };

    startCamera();

    // Cleanup on unmount
    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Capture photo - FULL RESOLUTION for evidence
  // This is the EXACT frame that will be sent to SAQR for analysis
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !cameraReady || isCapturing) return;

    setIsCapturing(true);
    console.log("[MobileCamera] Capturing FULL RESOLUTION frame...");

    const video = videoRef.current;
    const videoWidth = video.videoWidth || 1280;
    const videoHeight = video.videoHeight || 720;

    // Capture FULL RESOLUTION image for evidence
    // This ensures the saved thumbnail matches exactly what SAQR analyzed
    const canvas = document.createElement("canvas");
    canvas.width = videoWidth;
    canvas.height = videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setIsCapturing(false);
      return;
    }

    // Draw full frame at original resolution
    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

    // Export at good quality for evidence storage
    const imageBase64 = canvas.toDataURL("image/jpeg", 0.85);

    console.log("[MobileCamera] Captured full resolution:", videoWidth, "x", videoHeight, "size:", Math.round(imageBase64.length / 1024), "KB");

    // Stop camera after capture
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    onCapture(imageBase64);
  }, [cameraReady, isCapturing, onCapture]);

  // Get evidence type icon
  const getEvidenceIcon = () => {
    switch (spec.evidenceType) {
      case "PHOTO": return <Camera className="w-5 h-5 text-amber-400" />;
      case "VIDEO": return <Video className="w-5 h-5 text-amber-400" />;
      case "DOCUMENT": return <FileText className="w-5 h-5 text-amber-400" />;
      case "QR_BARCODE": return <QrCode className="w-5 h-5 text-amber-400" />;
      default: return <Camera className="w-5 h-5 text-amber-400" />;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black flex flex-col"
      style={{
        zIndex: 9999,
        height: '100dvh', // Dynamic viewport height for mobile
      }}
    >
      {/* TOP STRIP - 50px */}
      <div
        className="flex items-center justify-between px-4 bg-black/90 backdrop-blur-sm border-b border-zinc-800 shrink-0"
        style={{
          height: '50px',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center text-white text-2xl touch-manipulation"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="bg-amber-500/20 px-4 py-1.5 rounded-full">
          <span className="text-amber-400 font-mono font-bold text-sm">{spec.code}</span>
        </div>

        <div className="w-10 h-10 flex items-center justify-center text-xl">
          {getEvidenceIcon()}
        </div>
      </div>

      {/* CAMERA AREA - 65% */}
      <div className="relative bg-black" style={{ flex: '0 0 65%' }}>
        {/* Video element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Camera loading/error state */}
        {!cameraReady && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
            <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-4" />
            <p className="text-white text-lg">Starting camera...</p>
            <p className="text-amber-400 mt-1" dir="rtl">جارٍ تشغيل الكاميرا...</p>
          </div>
        )}

        {/* Error state - DO NOT reload page, just go back */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6 text-center">
            <Camera className="w-16 h-16 text-red-500 mb-4" />
            <p className="text-white text-lg mb-2">{error}</p>
            <p className="text-amber-400" dir="rtl">الكاميرا غير متاحة</p>
            <div className="flex gap-4 mt-6">
              <button
                onClick={onClose}
                className="bg-zinc-700 text-white px-6 py-3 rounded-xl font-bold touch-manipulation"
              >
                Back | رجوع
              </button>
              <button
                onClick={onSkip}
                className="bg-amber-500 text-black px-6 py-3 rounded-xl font-bold touch-manipulation"
              >
                Skip | تخطي
              </button>
            </div>
          </div>
        )}

        {/* Capture overlay */}
        {isCapturing && (
          <div className="absolute inset-0 bg-white/30 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-white/50 animate-ping" />
          </div>
        )}

        {/* Viewfinder border */}
        {cameraReady && !isCapturing && (
          <div className="absolute inset-3 border-2 border-amber-500/50 rounded-xl pointer-events-none" />
        )}
      </div>

      {/* SAQR AI STRIP - 15% */}
      <div
        className="bg-zinc-900/95 backdrop-blur-sm px-4 py-2 flex flex-col justify-center shrink-0"
        style={{ flex: '0 0 15%' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-amber-400 text-xs font-medium">SAQR Ready | صقر جاهز</span>
        </div>
        <p className="text-white text-sm font-medium line-clamp-1">{spec.requirement}</p>
        <p className="text-amber-400/80 text-xs line-clamp-1 mt-0.5" dir="rtl">{spec.requirementAr}</p>
      </div>

      {/* BOTTOM ACTIONS - 20% */}
      <div
        className="bg-black flex flex-col items-center justify-center shrink-0"
        style={{
          flex: '0 0 20%',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        }}
      >
        {/* Capture button - Large white circle */}
        <button
          onClick={capturePhoto}
          disabled={!cameraReady || isCapturing}
          className="w-[70px] h-[70px] rounded-full bg-white flex items-center justify-center shadow-lg shadow-white/20 active:scale-90 transition-transform touch-manipulation disabled:opacity-50"
        >
          <div className="w-[60px] h-[60px] rounded-full border-4 border-black/80" />
        </button>

        {/* Skip button */}
        <button
          onClick={onSkip}
          className="mt-3 text-zinc-500 text-sm touch-manipulation py-2 px-4"
        >
          Skip | تخطي
        </button>
      </div>
    </div>
  );
}
