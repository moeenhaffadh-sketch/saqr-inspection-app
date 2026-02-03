"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2,
  ScanLine,
  Zap,
  ZapOff,
} from "lucide-react";
import Link from "next/link";

// Mock specs for testing SAQR camera UI
const mockSpecs = [
  { id: "1", code: "FS-001", requirement: "Fire extinguisher must be visible and accessible", evidenceType: "photo" },
  { id: "2", code: "FS-002", requirement: "Emergency exit signs must be illuminated", evidenceType: "photo" },
  { id: "3", code: "FS-003", requirement: "First aid kit must be fully stocked", evidenceType: "photo" },
  { id: "4", code: "HS-001", requirement: "Handwashing stations must have soap and paper towels", evidenceType: "photo" },
  { id: "5", code: "HS-002", requirement: "Food storage areas must be clean and organized", evidenceType: "photo" },
];

export default function TestInspectionPage() {
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [saqrEnabled, setSaqrEnabled] = useState(true); // Start with SAQR ON
  const [stabilityStatus, setStabilityStatus] = useState<"stable" | "unstable" | "no-spec">("no-spec");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedSpec, setDetectedSpec] = useState<typeof mockSpecs[0] | null>(null);
  const [completedSpecs, setCompletedSpecs] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const pendingSpecs = mockSpecs.filter(s => !completedSpecs.includes(s.id));

  // Start camera
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Camera requires HTTPS or localhost");
      return;
    }

    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            setCameraReady(true);
          }).catch(console.error);
        };
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setCameraError(
        err.name === "NotAllowedError"
          ? "Camera permission denied. Tap to retry."
          : "Camera error: " + err.message
      );
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => startCamera(), 500);
    return () => {
      clearTimeout(timer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startCamera]);

  // SAQR auto-scan simulation
  useEffect(() => {
    if (!saqrEnabled || !cameraReady || isAnalyzing) {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      if (!saqrEnabled) {
        setStabilityStatus("no-spec");
        setDetectedSpec(null);
      }
      return;
    }

    const runAutoScan = async () => {
      if (!videoRef.current || !canvasRef.current || isAnalyzing || pendingSpecs.length === 0) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0);
      const image = canvas.toDataURL("image/jpeg", 0.7);

      setStabilityStatus("unstable");
      setIsAnalyzing(true);

      try {
        // Call actual AI analyze endpoint
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image,
            mode: "multi-spec",
            specs: pendingSpecs.map((s) => ({
              id: s.id,
              code: s.code,
              description: s.requirement,
              category: s.evidenceType,
            })),
            language: "en",
          }),
        });

        const data = await response.json();

        if (data.matchedSpecId && data.status) {
          const matched = mockSpecs.find(s => s.id === data.matchedSpecId);
          setDetectedSpec(matched || null);
          setStabilityStatus("stable");

          // Auto-complete after 3 seconds if high confidence
          if (data.confidence >= 0.85 && matched) {
            setTimeout(() => {
              setCompletedSpecs(prev => [...prev, matched.id]);
              setDetectedSpec(null);
              setStabilityStatus("no-spec");
            }, 3000);
          }
        } else {
          setStabilityStatus("no-spec");
          setDetectedSpec(null);
        }
      } catch (err) {
        console.error("Scan error:", err);
        setStabilityStatus("no-spec");
        setDetectedSpec(null);
      } finally {
        setIsAnalyzing(false);
      }
    };

    runAutoScan();
    scanIntervalRef.current = setInterval(runAutoScan, 3000);

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, [saqrEnabled, cameraReady, isAnalyzing, pendingSpecs]);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden z-[9999]">
      {/* Camera */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Scanning overlay */}
      {saqrEnabled && isAnalyzing && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute inset-4 border-2 border-amber-500/50 rounded-2xl animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="flex items-center gap-2 bg-amber-600/90 backdrop-blur-sm px-4 py-2 rounded-full">
              <ScanLine className="w-5 h-5 text-white animate-pulse" />
              <span className="text-white font-medium">SAQR Scanning...</span>
            </div>
          </div>
        </div>
      )}

      {/* Detection result */}
      {saqrEnabled && detectedSpec && stabilityStatus === "stable" && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute inset-4 border-4 border-green-500 rounded-2xl" />
          <div className="absolute top-24 left-1/2 -translate-x-1/2">
            <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl backdrop-blur-md bg-green-600/90">
              <div className="text-white/80 text-xs font-mono bg-black/30 px-2 py-1 rounded">
                {detectedSpec.code}
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-white" />
                <span className="text-white text-xl font-bold">DETECTED</span>
              </div>
              <p className="text-white/90 text-sm text-center max-w-xs">
                {detectedSpec.requirement}
              </p>
              <div className="text-white/80 text-sm mt-2">
                Auto-saving in 3s...
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Camera error */}
      {cameraError && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="text-center p-6">
            <Camera className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
            <p className="text-white text-lg mb-4">{cameraError}</p>
            <Button onClick={startCamera} className="bg-amber-500 text-black">
              <Camera className="w-5 h-5 mr-2" /> Start Camera
            </Button>
          </div>
        </div>
      )}

      {/* Camera loading */}
      {!cameraReady && !cameraError && (
        <div className="absolute inset-0 bg-black flex items-center justify-center z-50">
          <div className="text-center p-6">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-amber-500 animate-spin" />
            <p className="text-white text-lg">Starting Camera...</p>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-[200] bg-gradient-to-b from-black/80 via-black/40 to-transparent pt-safe">
        <div className="flex items-center justify-between p-3 gap-2">
          <Link
            href="/"
            className="camera-back-btn p-2.5 rounded-full bg-black/90 backdrop-blur-sm z-[999]"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>

          <div className="flex-1 mx-2">
            <div className="flex items-center justify-between text-xs text-white/80 mb-1">
              <span>Test Mode</span>
              <span>{completedSpecs.length}/{mockSpecs.length}</span>
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${(completedSpecs.length / mockSpecs.length) * 100}%` }}
              />
            </div>
          </div>

          <button
            onClick={() => {
              setSaqrEnabled(!saqrEnabled);
              setDetectedSpec(null);
              setStabilityStatus("no-spec");
            }}
            className={`flex items-center gap-1.5 px-3 h-8 rounded-lg backdrop-blur-sm ${
              saqrEnabled ? "bg-amber-500 text-black" : "bg-black/60 text-white/80 border border-white/30"
            }`}
          >
            {saqrEnabled ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
            <span className="text-xs font-bold">SAQR</span>
          </button>

          <div className="px-3 h-8 rounded-lg bg-amber-500/90 flex items-center">
            <span className="text-black font-bold text-xs">TEST</span>
          </div>
        </div>

        {/* SAQR instruction */}
        {saqrEnabled && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-amber-400" />
              <p className="text-amber-400 text-sm font-medium line-clamp-2">
                Point camera at:{" "}
                <span className="text-white font-semibold">
                  {detectedSpec
                    ? detectedSpec.requirement.slice(0, 50) + (detectedSpec.requirement.length > 50 ? "..." : "")
                    : "required inspection item"}
                </span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent pb-safe">
        {/* Stability indicator */}
        {saqrEnabled && (
          <div className="flex justify-center pb-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-sm">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  stabilityStatus === "stable"
                    ? "bg-green-500"
                    : stabilityStatus === "unstable"
                    ? "bg-yellow-500 animate-pulse"
                    : "bg-red-500"
                }`}
              />
              <span className="text-xs text-white/90">
                {stabilityStatus === "stable" && detectedSpec
                  ? detectedSpec.requirement.slice(0, 35) + (detectedSpec.requirement.length > 35 ? "..." : "")
                  : stabilityStatus === "unstable"
                  ? "Scanning..."
                  : "No spec in view"}
              </span>
            </div>
          </div>
        )}

        {/* SAQR mode button */}
        {saqrEnabled && (
          <div className="flex justify-center px-4 pb-4">
            <Button
              disabled={pendingSpecs.length > 0}
              className="bg-amber-500 text-black min-h-[48px] px-8"
            >
              {pendingSpecs.length > 0 ? (
                <>{pendingSpecs.length} items remaining</>
              ) : (
                <>Complete Inspection</>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
