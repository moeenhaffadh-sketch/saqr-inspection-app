"use client";

import { useState, useRef, useCallback, use, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2,
  ChevronRight,
  X,
  Sparkles,
  List,
  ScanLine,
  Zap,
  ZapOff,
} from "lucide-react";
import Link from "next/link";

// SKIPPED is kept for database compatibility but treated as pending in UI
type ResultStatus = "PASS" | "FAIL" | "UNCERTAIN" | "SKIPPED";

interface SpecWithResult {
  id: string;
  code: string;
  requirement: string;
  requirementAr: string;
  evidenceType: string;
  guidance: string | null;
  guidanceAr: string | null;
  result?: {
    status: ResultStatus | null;
    notes: string | null;
    photoUrl: string | null;
    aiAnalyzed: boolean;
    aiConfidence: number | null;
    aiReasoning: string | null;
  };
}

const statusConfig = {
  PASS: {
    icon: CheckCircle2,
    color: "bg-green-600",
    activeColor: "bg-green-500 ring-2 ring-green-300",
    label: "Pass",
  },
  FAIL: {
    icon: XCircle,
    color: "bg-red-600",
    activeColor: "bg-red-500 ring-2 ring-red-300",
    label: "Fail",
  },
  UNCERTAIN: {
    icon: HelpCircle,
    color: "bg-amber-600",
    activeColor: "bg-amber-500 ring-2 ring-amber-300",
    label: "Unsure",
  },
};

export default function InspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get retake index from URL if provided (for retaking specific specs)
  const retakeIndex = searchParams.get("retake");
  const initialIndex = retakeIndex ? parseInt(retakeIndex, 10) : 0;

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showSidebar, setShowSidebar] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // SAQR auto-scan mode
  const [saqrEnabled, setSaqrEnabled] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "detected">("idle");
  const [stabilityStatus, setStabilityStatus] = useState<"stable" | "unstable" | "no-spec">("no-spec");
  const [lastAIResult, setLastAIResult] = useState<{
    status: string;
    confidence: number;
    reasoning: string;
    matchedSpecId?: string;
    matchedSpecCode?: string;
  } | null>(null);
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoAdvanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Update current index when retake parameter changes
  useEffect(() => {
    if (retakeIndex) {
      const index = parseInt(retakeIndex, 10);
      if (!isNaN(index) && index >= 0) {
        setCurrentIndex(index);
        setCapturedImage(null);
      }
    }
  }, [retakeIndex]);

  const {
    data: inspection,
    isLoading,
    refetch,
  } = trpc.inspection.getById.useQuery({ id });

  const saveResult = trpc.inspection.saveResult.useMutation({
    onSuccess: () => refetch(),
  });

  const completeInspection = trpc.inspection.complete.useMutation({
    onSuccess: () => router.push(`/inspections/${id}/results`),
  });

  const specs: SpecWithResult[] =
    inspection?.category?.specs.map((spec) => ({
      ...spec,
      result: inspection.results.find((r) => r.specId === spec.id),
    })) || [];

  const currentSpec = specs[currentIndex];
  // SKIPPED is treated as pending, not completed
  const completedCount = specs.filter((s) => s.result?.status && s.result.status !== "SKIPPED").length;
  const progress = specs.length > 0 ? (completedCount / specs.length) * 100 : 0;

  // Camera start function - can be called manually on iOS
  const startCamera = useCallback(async () => {
    // Check if mediaDevices is available (requires HTTPS or localhost)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        "Camera requires HTTPS. Use localhost or enable HTTPS."
      );
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
          : err.name === "NotFoundError"
          ? "No camera found"
          : "Camera error: " + err.message
      );
    }
  }, []);

  // Start camera on mount
  useEffect(() => {
    // Small delay to ensure component is mounted
    const timer = setTimeout(() => {
      startCamera();
    }, 500);

    return () => {
      clearTimeout(timer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startCamera]);

  // Get pending specs (not yet completed - SKIPPED is treated as pending)
  const pendingSpecs = specs.filter((s) => !s.result?.status || s.result.status === "SKIPPED");

  // SAQR auto-scan effect - scans any spec in view
  useEffect(() => {
    if (!saqrEnabled || !cameraReady || capturedImage || isAnalyzing) {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      if (!saqrEnabled) {
        setStabilityStatus("no-spec");
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

      setScanStatus("scanning");
      setStabilityStatus("unstable");
      setIsAnalyzing(true);

      try {
        // Send all pending specs to AI for matching
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

        if (data.error) {
          setScanStatus("idle");
          setStabilityStatus("no-spec");
          return;
        }

        // Check if AI found a matching spec
        if (data.matchedSpecId && data.status) {
          const matchedSpec = specs.find((s) => s.id === data.matchedSpecId);

          setLastAIResult({
            status: data.status,
            confidence: data.confidence || 0,
            reasoning: data.reasoning || "",
            matchedSpecId: data.matchedSpecId,
            matchedSpecCode: matchedSpec?.code,
          });
          setScanStatus("detected");
          setStabilityStatus("stable");

          // Auto-save if confidence is high (>85%)
          if (data.confidence >= 0.85) {
            setAutoAdvanceCountdown(3);

            let count = 3;
            const countdownInterval = setInterval(() => {
              count--;
              setAutoAdvanceCountdown(count);
              if (count <= 0) {
                clearInterval(countdownInterval);
              }
            }, 1000);

            autoAdvanceTimeoutRef.current = setTimeout(async () => {
              const statusMap: Record<string, ResultStatus> = {
                pass: "PASS",
                fail: "FAIL",
                uncertain: "UNCERTAIN",
              };

              await saveResult.mutateAsync({
                inspectionId: id,
                specId: data.matchedSpecId,
                status: statusMap[data.status] || "UNCERTAIN",
                photoUrl: image,
                aiAnalyzed: true,
                aiConfidence: data.confidence,
                aiReasoning: data.reasoning,
              });

              setLastAIResult(null);
              setScanStatus("idle");
              setAutoAdvanceCountdown(null);

              // Move to next pending spec if any
              const nextPendingIndex = specs.findIndex(
                (s) => !s.result?.status && s.id !== data.matchedSpecId
              );
              if (nextPendingIndex >= 0) {
                setCurrentIndex(nextPendingIndex);
              }
            }, 3000);
          }
        } else {
          // No spec detected in view
          setStabilityStatus("no-spec");
          setScanStatus("idle");
          setLastAIResult(null);
        }
      } catch (err) {
        console.error("Auto-scan error:", err);
        setScanStatus("idle");
        setStabilityStatus("no-spec");
      } finally {
        setIsAnalyzing(false);
      }
    };

    // Run first scan immediately
    runAutoScan();

    // Then run every 3 seconds
    scanIntervalRef.current = setInterval(runAutoScan, 3000);

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
    };
  }, [saqrEnabled, cameraReady, capturedImage, pendingSpecs, id, isAnalyzing, specs]);

  // Cancel auto-advance on manual interaction
  const cancelAutoAdvance = useCallback(() => {
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    setAutoAdvanceCountdown(null);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.85);
    }
    return null;
  }, []);

  const handleCapture = useCallback(() => {
    const image = capturePhoto();
    if (image) {
      setCapturedImage(image);
    }
  }, [capturePhoto]);

  const analyzeWithAI = async () => {
    if (!capturedImage || !currentSpec) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: capturedImage,
          checklistItem: {
            code: currentSpec.code,
            description: currentSpec.requirement,
            category: currentSpec.evidenceType,
          },
          language: "en",
        }),
      });

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      if (data.status) {
        const statusMap: Record<string, ResultStatus> = {
          pass: "PASS",
          fail: "FAIL",
          uncertain: "UNCERTAIN",
        };

        await saveResult.mutateAsync({
          inspectionId: id,
          specId: currentSpec.id,
          status: statusMap[data.status] || "UNCERTAIN",
          photoUrl: capturedImage,
          aiAnalyzed: true,
          aiConfidence: data.confidence,
          aiReasoning: data.reasoning,
        });

        setCapturedImage(null);
        if (currentIndex < specs.length - 1) {
          setCurrentIndex(currentIndex + 1);
        }
      }
    } catch (err) {
      console.error("AI analysis error:", err);
      alert("AI analysis failed. Please mark manually.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleManualStatus = async (status: ResultStatus) => {
    if (!currentSpec) return;

    // Cancel any auto-advance in progress
    cancelAutoAdvance();
    setLastAIResult(null);
    setScanStatus("idle");
    setStabilityStatus("no-spec");

    const image = capturedImage || capturePhoto();

    await saveResult.mutateAsync({
      inspectionId: id,
      specId: currentSpec.id,
      status,
      photoUrl: image || undefined,
    });

    setCapturedImage(null);
    if (currentIndex < specs.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleComplete = () => {
    completeInspection.mutate({ id });
  };

  const goToSpec = (index: number) => {
    cancelAutoAdvance();
    setLastAIResult(null);
    setScanStatus("idle");
    setStabilityStatus("no-spec");
    setCurrentIndex(index);
    setCapturedImage(null);
    setShowSidebar(false);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Inspection not found</p>
          <Link href="/inspections" className="text-amber-400 hover:underline">
            Back to inspections
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden z-[100]">
      {/* Full-screen Camera */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover ${capturedImage ? 'hidden' : ''}`}
      />

      {/* Captured Image Preview */}
      {capturedImage && (
        <img
          src={capturedImage}
          alt="Captured"
          className="absolute inset-0 w-full h-full object-contain bg-black"
        />
      )}

      <canvas ref={canvasRef} className="hidden" />

      {/* SAQR Scan Indicator */}
      {saqrEnabled && scanStatus === "scanning" && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {/* Scanning animation border */}
          <div className="absolute inset-4 border-2 border-amber-500/50 rounded-2xl animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="flex items-center gap-2 bg-amber-600/90 backdrop-blur-sm px-4 py-2 rounded-full">
              <ScanLine className="w-5 h-5 text-white animate-pulse" />
              <span className="text-white font-medium">SAQR Scanning...</span>
            </div>
          </div>
        </div>
      )}

      {/* SAQR Detection Result Overlay */}
      {saqrEnabled && lastAIResult && scanStatus === "detected" && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {/* Result border */}
          <div
            className={`absolute inset-4 border-4 rounded-2xl transition-colors ${
              lastAIResult.status === "pass"
                ? "border-green-500"
                : lastAIResult.status === "fail"
                ? "border-red-500"
                : "border-amber-500"
            }`}
          />

          {/* Result badge */}
          <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-auto">
            <div
              className={`flex flex-col items-center gap-2 px-6 py-4 rounded-2xl backdrop-blur-md ${
                lastAIResult.status === "pass"
                  ? "bg-green-600/90"
                  : lastAIResult.status === "fail"
                  ? "bg-red-600/90"
                  : "bg-amber-600/90"
              }`}
            >
              {/* Matched spec code */}
              {lastAIResult.matchedSpecCode && (
                <div className="text-white/80 text-xs font-mono bg-black/30 px-2 py-1 rounded">
                  {lastAIResult.matchedSpecCode}
                </div>
              )}
              <div className="flex items-center gap-2">
                {lastAIResult.status === "pass" ? (
                  <CheckCircle2 className="w-6 h-6 text-white" />
                ) : lastAIResult.status === "fail" ? (
                  <XCircle className="w-6 h-6 text-white" />
                ) : (
                  <HelpCircle className="w-6 h-6 text-white" />
                )}
                <span className="text-white text-xl font-bold uppercase">
                  {lastAIResult.status}
                </span>
                <span className="text-white/80 text-sm">
                  Confidence {Math.round(lastAIResult.confidence * 100)}% نسبة الثقة
                </span>
              </div>
              <p className="text-white/90 text-sm text-center max-w-xs">
                {lastAIResult.reasoning}
              </p>
              {autoAdvanceCountdown !== null && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="text-white/80 text-sm">
                    Auto-saving in {autoAdvanceCountdown}s
                  </div>
                  <button
                    onClick={cancelAutoAdvance}
                    className="text-white text-xs bg-white/20 px-2 py-1 rounded"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Camera Error Overlay */}
      {cameraError && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="text-center p-6">
            <Camera className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
            <p className="text-white text-lg mb-2">{cameraError}</p>
            <p className="text-zinc-400 text-sm mb-4">
              Tap the button below to start camera
            </p>
            <Button
              onClick={startCamera}
              className="bg-amber-500 hover:bg-amber-400 text-black text-lg px-8 py-4 min-h-[56px]"
            >
              <Camera className="w-5 h-5 mr-2" />
              Start Camera
            </Button>
          </div>
        </div>
      )}

      {/* Camera Not Started Overlay - shows tap to start */}
      {!cameraReady && !cameraError && (
        <div className="absolute inset-0 bg-black flex items-center justify-center z-50">
          <div className="text-center p-6">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-amber-500 animate-spin" />
            <p className="text-white text-lg mb-2">Starting Camera...</p>
            <p className="text-zinc-400 text-sm mb-4">
              If prompted, allow camera access
            </p>
            <Button
              onClick={startCamera}
              variant="outline"
              className="text-white border-white/30 min-h-[48px]"
            >
              Tap if camera doesn't start
            </Button>
          </div>
        </div>
      )}

      {/* Top Bar Overlay - extremely high z-index to stay above all layout elements */}
      <div className="absolute top-0 left-0 right-0 z-[200] bg-gradient-to-b from-black/80 via-black/40 to-transparent pt-safe">
        <div className="flex items-center justify-between p-3 gap-2">
          {/* Back Button - highest z-index to ensure visibility above any overlays */}
          <Link
            href="/inspections"
            className="camera-back-btn p-2.5 rounded-full bg-black/90 backdrop-blur-sm touch-manipulation z-[999] shrink-0 relative"
            style={{ isolation: 'isolate' }}
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>

          {/* Progress */}
          <div className="flex-1 min-w-0 mx-2">
            <div className="flex items-center justify-between text-xs text-white/80 mb-1">
              <span>{currentSpec?.code}</span>
              <span>{completedCount}/{specs.length}</span>
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* SAQR Toggle - matched size with Authority */}
          <button
            onClick={() => {
              cancelAutoAdvance();
              setSaqrEnabled(!saqrEnabled);
              setLastAIResult(null);
              setScanStatus("idle");
              setStabilityStatus("no-spec");
            }}
            className={`flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg backdrop-blur-sm transition-all touch-manipulation shrink-0 ${
              saqrEnabled
                ? "bg-amber-500 text-black"
                : "bg-black/60 text-white/80 border border-white/30"
            }`}
          >
            {saqrEnabled ? (
              <Zap className="w-4 h-4" />
            ) : (
              <ZapOff className="w-4 h-4" />
            )}
            <span className="text-xs font-bold">SAQR</span>
          </button>

          {/* Authority Badge - same size as SAQR toggle */}
          <div className="flex items-center justify-center px-3 h-8 rounded-lg bg-amber-500/90 backdrop-blur-sm shrink-0">
            <span className="text-black font-bold text-xs">{inspection.category.authority.code}</span>
          </div>
        </div>

        {/* SAQR: Dynamic instruction showing spec to point at */}
        {saqrEnabled && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-amber-400 text-sm font-medium line-clamp-2">
                Point camera at:{" "}
                <span className="text-white font-semibold">
                  {(() => {
                    // Get the current detected spec name for consistency
                    const detectedSpec = lastAIResult?.matchedSpecId
                      ? specs.find((s) => s.id === lastAIResult.matchedSpecId)
                      : null;

                    if (detectedSpec) {
                      const req = detectedSpec.requirement;
                      return req.length > 50 ? req.slice(0, 50) + "..." : req;
                    }

                    // Fallback when no spec detected
                    return "required inspection item";
                  })()}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Current Requirement - only shown when SAQR is OFF */}
        {!saqrEnabled && (
          <div className="px-4 pb-4">
            <p className="text-white text-sm font-medium line-clamp-2 drop-shadow-lg">
              {currentSpec?.requirement}
            </p>
          </div>
        )}
      </div>

      {/* Side Panel Toggle */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        className="absolute top-1/2 right-0 -translate-y-1/2 z-30 p-2 bg-black/60 backdrop-blur-sm rounded-l-lg touch-manipulation"
      >
        {showSidebar ? (
          <ChevronRight className="w-5 h-5 text-white" />
        ) : (
          <List className="w-5 h-5 text-white" />
        )}
      </button>

      {/* Checklist Sidebar */}
      <div
        className={`absolute top-0 right-0 bottom-0 w-72 bg-black/90 backdrop-blur-md z-40 transition-transform duration-300 ${
          showSidebar ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">Checklist</h3>
            <button
              onClick={() => setShowSidebar(false)}
              className="p-1 rounded-full hover:bg-white/10"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto h-[calc(100%-60px)] pb-safe">
          {specs.map((spec, idx) => {
            const status = spec.result?.status;
            // Treat SKIPPED as pending (no config)
            const config = status && status !== "SKIPPED" ? statusConfig[status as keyof typeof statusConfig] : null;
            const Icon = config?.icon;

            return (
              <button
                key={spec.id}
                onClick={() => goToSpec(idx)}
                className={`w-full p-3 text-left border-b border-white/5 transition-colors touch-manipulation ${
                  idx === currentIndex
                    ? "bg-amber-500/20"
                    : "hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/60 w-12 shrink-0">
                    {spec.code}
                  </span>
                  {config && Icon ? (
                    <span className={`w-5 h-5 rounded-full ${config.color} flex items-center justify-center`}>
                      <Icon className="w-3 h-3 text-white" />
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded-full border border-white/30" />
                  )}
                </div>
                <p className="text-white/80 text-xs mt-1 line-clamp-2">
                  {spec.requirement}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent pb-safe">
        {/* Stability Indicator - only shown when SAQR is enabled */}
        {saqrEnabled && (
          <div className="flex justify-center pb-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-sm">
              <div
                className={`w-2.5 h-2.5 rounded-full transition-colors shrink-0 ${
                  stabilityStatus === "stable"
                    ? "bg-green-500"
                    : stabilityStatus === "unstable"
                    ? "bg-yellow-500 animate-pulse"
                    : "bg-red-500"
                }`}
              />
              <span className="text-xs text-white/90">
                {(() => {
                  // Must match the spec shown in top instruction
                  const detectedSpec = lastAIResult?.matchedSpecId
                    ? specs.find((s) => s.id === lastAIResult.matchedSpecId)
                    : null;

                  if (stabilityStatus === "stable" && detectedSpec) {
                    const req = detectedSpec.requirement;
                    return req.length > 35 ? req.slice(0, 35) + "..." : req;
                  }

                  if (stabilityStatus === "unstable") return "Scanning...";
                  return "No spec in view";
                })()}
              </span>
            </div>
          </div>
        )}

        {/* Captured Image Actions - only when SAQR is OFF */}
        {!saqrEnabled && capturedImage && (
          <div className="flex justify-center gap-3 px-4 pb-3">
            <Button
              variant="outline"
              onClick={() => setCapturedImage(null)}
              className="bg-black/50 border-white/30 text-white min-h-[44px]"
            >
              <X className="w-4 h-4 mr-2" /> Retake
            </Button>
            <Button
              onClick={analyzeWithAI}
              disabled={isAnalyzing}
              className="bg-amber-500 hover:bg-amber-400 text-black min-h-[44px]"
            >
              {isAnalyzing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {isAnalyzing ? "Analyzing..." : "SAQR Analyze"}
            </Button>
          </div>
        )}

        {/* Navigation / Capture Row - only when SAQR is OFF */}
        {!saqrEnabled && (
          <div className="flex items-center justify-between px-4 pb-4">
            {/* Previous */}
            <Button
              variant="outline"
              disabled={currentIndex === 0}
              onClick={() => goToSpec(currentIndex - 1)}
              className="bg-black/50 border-white/30 text-white min-h-[48px] min-w-[48px]"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>

            {/* Capture Button */}
            {!capturedImage && (
              <button
                onClick={handleCapture}
                disabled={!cameraReady}
                className="w-20 h-20 rounded-full bg-white border-4 border-white/30 shadow-lg touch-manipulation active:scale-95 transition-transform disabled:opacity-50"
              >
                <div className="w-full h-full rounded-full bg-white" />
              </button>
            )}

            {/* Next / Complete */}
            {currentIndex < specs.length - 1 ? (
              <Button
                variant="outline"
                onClick={() => goToSpec(currentIndex + 1)}
                className="bg-black/50 border-white/30 text-white min-h-[48px] min-w-[48px]"
              >
                <ArrowRight className="w-5 h-5" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={completeInspection.isPending}
                className="bg-amber-500 hover:bg-amber-400 text-black min-h-[48px] px-4"
              >
                {completeInspection.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>Done</>
                )}
              </Button>
            )}
          </div>
        )}

        {/* SAQR Mode: Done button only (auto-inspection) */}
        {saqrEnabled && (
          <div className="flex justify-center px-4 pb-4">
            <Button
              onClick={handleComplete}
              disabled={completeInspection.isPending || pendingSpecs.length > 0}
              className="bg-amber-500 hover:bg-amber-400 text-black min-h-[48px] px-8"
            >
              {completeInspection.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : pendingSpecs.length > 0 ? (
                <>{pendingSpecs.length} items remaining</>
              ) : (
                <>Complete Inspection</>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Sidebar Backdrop */}
      {showSidebar && (
        <div
          className="absolute inset-0 bg-black/50 z-30"
          onClick={() => setShowSidebar(false)}
        />
      )}
    </div>
  );
}
