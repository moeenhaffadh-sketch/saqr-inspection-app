// LOCKED v0.3.0 - Simplified camera flow
// Inspection Dashboard with continuous AI scanning
"use client";

import { useState, useRef, useCallback, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Camera,
  Loader2,
  ScanLine,
  Zap,
  Building2,
  ClipboardList,
  ChevronRight,
  Play,
  Check,
  AlertTriangle,
  FileText,
  Video,
  QrCode,
  Barcode,
  Award,
  PenLine,
  ImageIcon,
  RefreshCw,
  Download,
} from "lucide-react";
import Link from "next/link";
import { generateInspectionPDF } from "@/lib/utils/generatePDF";

const VERSION = '0.3.0';
const ANALYSIS_TIMEOUT = 15000; // 15 seconds

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
    aiReasoningAr: string | null;
  };
}

// Authority colors
const authorityColors: Record<string, string> = {
  MOH: "bg-blue-500",
  MOIC: "bg-purple-500",
  GDCD: "bg-red-500",
  MUN: "bg-green-500",
  NHRA: "bg-amber-500",
};

// Evidence type icons, labels, and colors
const evidenceTypes: Record<string, { icon: React.ElementType; labelEn: string; labelAr: string; color: string }> = {
  VIDEO: { icon: Video, labelEn: "Video", labelAr: "فيديو", color: "text-purple-500" },
  DOCUMENT: { icon: FileText, labelEn: "Document", labelAr: "مستند", color: "text-blue-500" },
  PHOTO: { icon: Camera, labelEn: "Photo", labelAr: "صورة", color: "text-green-500" },
  QR_CODE: { icon: QrCode, labelEn: "QR Code", labelAr: "رمز QR", color: "text-cyan-500" },
  QR_BARCODE: { icon: QrCode, labelEn: "QR Code", labelAr: "رمز QR", color: "text-cyan-500" },
  BARCODE: { icon: Barcode, labelEn: "Barcode", labelAr: "باركود", color: "text-yellow-500" },
  CERTIFICATE: { icon: Award, labelEn: "Certificate", labelAr: "شهادة", color: "text-red-500" },
  MANUAL: { icon: PenLine, labelEn: "Manual", labelAr: "يدوي", color: "text-amber-500" },
};

export default function InspectionDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  // Dashboard state
  const [activeSpecId, setActiveSpecId] = useState<string | null>(null);
  const [showForceComplete, setShowForceComplete] = useState(false);
  const [selectedSpecIds, setSelectedSpecIds] = useState<Set<string> | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Camera state
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "detected">("idle");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [lastScanResult, setLastScanResult] = useState<{
    status: string;
    confidence: number;
    reasoning: string;
    reasoningAr: string;
    photoUrl: string | null;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    data: inspection,
    isLoading,
    refetch,
  } = trpc.inspection.getById.useQuery({ id });

  const saveResult = trpc.inspection.saveResult.useMutation({
    onSuccess: () => {
      console.log("[SAQR] Save result success, refetching");
      refetch();
    },
    onError: (error) => {
      console.error("[SAQR] Save result error:", error);
      setIsAnalyzing(false);
      setAnalysisError("Failed to save result. Please try again.");
    },
  });

  const completeInspection = trpc.inspection.complete.useMutation({
    onSuccess: () => router.push(`/inspections/${id}/results`),
  });

  // Helper function to reset all analysis state
  const resetAnalysisState = useCallback(() => {
    console.log("[SAQR] Resetting analysis state");

    // Cancel any pending API requests
    if (abortControllerRef.current) {
      console.log("[SAQR] Aborting pending API requests");
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Clear scan interval
    if (scanIntervalRef.current) {
      console.log("[SAQR] Clearing scan interval");
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    // Reset all state
    setIsAnalyzing(false);
    setCapturedImage(null);
    setScanStatus("idle");
    setLastScanResult(null);
    setAnalysisError(null);
  }, []);

  // Load selected specs and pre-inspection results from localStorage on mount
  useEffect(() => {
    try {
      const storedSpecs = localStorage.getItem("saqr_selected_specs");
      if (storedSpecs) {
        const specIds = JSON.parse(storedSpecs) as string[];
        setSelectedSpecIds(new Set(specIds));
        localStorage.removeItem("saqr_selected_specs");
      } else {
        setSelectedSpecIds(null);
      }

      const storedResults = localStorage.getItem("saqr_pre_inspection_results");
      if (storedResults) {
        const preResults = JSON.parse(storedResults) as Array<{
          specId: string;
          status: "PASS" | "FAIL";
          photoUrl?: string;
          aiAnalyzed?: boolean;
          aiConfidence?: number;
          aiReasoning?: string;
          aiReasoningAr?: string;
        }>;

        preResults.forEach((result) => {
          saveResult.mutate({
            inspectionId: id,
            specId: result.specId,
            status: result.status,
            notes: "Pre-inspected during review",
            photoUrl: result.photoUrl || undefined,
            aiAnalyzed: result.aiAnalyzed || false,
            aiConfidence: result.aiConfidence || undefined,
            aiReasoning: result.aiReasoning || undefined,
            aiReasoningAr: result.aiReasoningAr || undefined,
          });
        });

        localStorage.removeItem("saqr_pre_inspection_results");
      }
    } catch (e) {
      setSelectedSpecIds(null);
    }
  }, [id]);

  // Build specs with results
  const allSpecs: SpecWithResult[] =
    inspection?.category?.specs.map((spec) => ({
      ...spec,
      result: inspection.results.find((r) => r.specId === spec.id),
    })) || [];

  const specs: SpecWithResult[] = selectedSpecIds
    ? allSpecs.filter((spec) => selectedSpecIds.has(spec.id))
    : allSpecs;

  // Sort specs: Pass first, then Fail, then Pending (for PDF and display)
  const sortedSpecs = [...specs].sort((a, b) => {
    const statusOrder = (status: string | null | undefined) => {
      if (status === "PASS") return 0;
      if (status === "FAIL") return 1;
      return 2; // Pending/Skipped/null
    };
    return statusOrder(a.result?.status) - statusOrder(b.result?.status);
  });

  // Stats
  const passCount = specs.filter((s) => s.result?.status === "PASS").length;
  const failCount = specs.filter((s) => s.result?.status === "FAIL").length;
  const pendingCount = specs.filter((s) => !s.result?.status || s.result.status === "SKIPPED").length;
  const totalCount = specs.length;
  const completionPercent = totalCount > 0 ? Math.round(((passCount + failCount) / totalCount) * 100) : 0;

  const activeSpec = specs.find((s) => s.id === activeSpecId);
  const nextPendingSpec = specs.find((s) => !s.result?.status || s.result.status === "SKIPPED");

  // Camera functions
  const stopCamera = useCallback(() => {
    console.log("[SAQR] stopCamera called");
    if (streamRef.current) {
      console.log("[SAQR] Stopping existing stream, tracks:", streamRef.current.getTracks().length);
      streamRef.current.getTracks().forEach((track) => {
        console.log("[SAQR] Stopping track:", track.kind, track.label);
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    console.log("[SAQR] startCamera called");
    console.log("[SAQR] videoRef.current:", !!videoRef.current);
    console.log("[SAQR] navigator.mediaDevices:", !!navigator.mediaDevices);

    // Check if camera API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const errorMsg = "Camera not available. Use localhost or HTTPS.";
      console.error("[SAQR] Camera API not available");
      setCameraError(errorMsg);
      return;
    }

    // Stop any existing stream first
    if (streamRef.current) {
      console.log("[SAQR] Stopping previous stream before starting new one");
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      setCameraError(null);
      setCameraReady(false);

      // Simple approach: just request any video, let browser pick best
      console.log("[SAQR] Requesting camera stream...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      console.log("[SAQR] Camera stream received, tracks:", stream.getTracks().length);
      streamRef.current = stream;

      // Attach stream to video element
      if (videoRef.current) {
        console.log("[SAQR] Attaching stream to video element");
        videoRef.current.srcObject = stream;

        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          console.log("[SAQR] Video metadata loaded, dimensions:", videoRef.current?.videoWidth, "x", videoRef.current?.videoHeight);
          if (videoRef.current) {
            videoRef.current.play()
              .then(() => {
                console.log("[SAQR] Video playing, camera ready!");
                setCameraReady(true);
              })
              .catch((playErr) => {
                console.error("[SAQR] Video play error:", playErr);
                setCameraError("Failed to start video playback");
              });
          }
        };

        videoRef.current.onerror = (e) => {
          console.error("[SAQR] Video element error:", e);
          setCameraError("Video element error");
        };
      } else {
        console.error("[SAQR] videoRef.current is null after getting stream!");
        setCameraError("Video element not ready");
      }
    } catch (err: any) {
      console.error("[SAQR] Camera error:", err.name, err.message);
      let errorMsg = "Camera error: " + err.message;

      if (err.name === "NotAllowedError") {
        errorMsg = "Camera permission denied. Tap to allow.";
      } else if (err.name === "NotFoundError") {
        errorMsg = "No camera found on device.";
      } else if (err.name === "NotReadableError") {
        errorMsg = "Camera is in use by another app.";
      } else if (err.name === "OverconstrainedError") {
        errorMsg = "Camera constraints not supported.";
      } else if (err.name === "SecurityError") {
        errorMsg = "Camera requires HTTPS or localhost.";
      }

      setCameraError(errorMsg);
    }
  }, []);

  const openCameraForSpec = useCallback((specId: string) => {
    console.log("[SAQR] openCameraForSpec called, specId:", specId);

    // Reset all state from previous spec
    resetAnalysisState();
    stopCamera();

    // Set new active spec - this will trigger the useEffect to start camera
    setActiveSpecId(specId);
    setCameraError(null);
    setCameraReady(false);
  }, [stopCamera, resetAnalysisState]);

  const closeCameraView = useCallback(() => {
    console.log("[SAQR] closeCameraView called");
    resetAnalysisState();
    stopCamera();
    setActiveSpecId(null);
  }, [stopCamera, resetAnalysisState]);

  // Effect to start camera when activeSpecId is set
  useEffect(() => {
    if (!activeSpecId) {
      console.log("[SAQR] useEffect: no activeSpecId, skipping camera start");
      return;
    }

    console.log("[SAQR] useEffect: activeSpecId set to", activeSpecId);

    // Function to attempt camera start with retry
    const attemptCameraStart = (retryCount = 0) => {
      console.log("[SAQR] attemptCameraStart, retry:", retryCount, "videoRef:", !!videoRef.current);

      if (videoRef.current) {
        console.log("[SAQR] Video element found, starting camera");
        startCamera();
      } else if (retryCount < 10) {
        console.log("[SAQR] Video element not ready, retrying in 100ms...");
        setTimeout(() => attemptCameraStart(retryCount + 1), 100);
      } else {
        console.error("[SAQR] Video element not available after 10 retries");
        setCameraError("Video element failed to initialize");
      }
    };

    const timeoutId = setTimeout(() => attemptCameraStart(), 50);

    return () => {
      console.log("[SAQR] useEffect cleanup: clearing timeout");
      clearTimeout(timeoutId);
    };
  }, [activeSpecId, startCamera]);

  // Cleanup camera on component unmount
  useEffect(() => {
    return () => {
      console.log("[SAQR] Component unmount: stopping camera");
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Helper function to make API call with timeout and abort support
  const analyzeWithTimeout = useCallback(async (
    image: string,
    spec: { code: string; requirement: string; evidenceType: string },
    language: string,
    signal: AbortSignal
  ): Promise<any> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT);

    const combinedAbort = () => {
      clearTimeout(timeoutId);
      if (!controller.signal.aborted) controller.abort();
    };
    signal.addEventListener('abort', combinedAbort);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image,
          checklistItem: {
            code: spec.code,
            description: spec.requirement,
            category: spec.evidenceType,
          },
          language,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return await response.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Analysis timed out');
      }
      throw err;
    } finally {
      signal.removeEventListener('abort', combinedAbort);
    }
  }, []);

  // SAQR continuous auto-scan effect (always on)
  useEffect(() => {
    if (!cameraReady || !activeSpec || capturedImage || isAnalyzing) {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      return;
    }

    let isMounted = true;

    const runAutoScan = async () => {
      if (!videoRef.current || !canvasRef.current || isAnalyzing || !isMounted) return;

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
      console.log("[SAQR] Auto-scan starting for spec:", activeSpec.code);

      const scanAbortController = new AbortController();
      abortControllerRef.current = scanAbortController;

      try {
        const enData = await analyzeWithTimeout(
          image,
          activeSpec,
          "en",
          scanAbortController.signal
        );

        if (!isMounted || scanAbortController.signal.aborted) return;

        if (enData.error) {
          console.log("[SAQR] Auto-scan error:", enData.error);
          setScanStatus("idle");
          return;
        }

        const arData = await analyzeWithTimeout(
          image,
          activeSpec,
          "ar",
          scanAbortController.signal
        );

        if (!isMounted || scanAbortController.signal.aborted) return;

        if (enData.status) {
          console.log("[SAQR] Auto-scan detected:", enData.status, "confidence:", enData.confidence);
          setLastScanResult({
            status: enData.status,
            confidence: enData.confidence || 0,
            reasoning: enData.reasoning || "",
            reasoningAr: arData.reasoning || "",
            photoUrl: image,
          });
          setScanStatus("detected");
        } else {
          setScanStatus("idle");
        }
      } catch (err: any) {
        if (!isMounted) return;
        if (err.message === 'Analysis timed out') {
          console.log("[SAQR] Auto-scan timed out");
        } else {
          console.error("[SAQR] Auto-scan error:", err);
        }
        setScanStatus("idle");
      }
    };

    runAutoScan();
    scanIntervalRef.current = setInterval(runAutoScan, 5000);

    return () => {
      isMounted = false;
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [cameraReady, activeSpec, capturedImage, isAnalyzing, analyzeWithTimeout]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.85);
    }
    return null;
  }, []);

  // Handle capture - takes photo and analyzes (stores result for DONE)
  const handleCapture = async () => {
    if (!activeSpec) return;

    const image = capturePhoto();
    if (!image) return;

    console.log("[SAQR] Capture started for spec:", activeSpec.code);
    setCapturedImage(image);
    setIsAnalyzing(true);
    setAnalysisError(null);

    const captureAbortController = new AbortController();
    abortControllerRef.current = captureAbortController;

    try {
      console.log("[SAQR] Analyzing (EN)...");
      const enData = await analyzeWithTimeout(
        image,
        activeSpec,
        "en",
        captureAbortController.signal
      );

      if (captureAbortController.signal.aborted) {
        console.log("[SAQR] Capture aborted");
        return;
      }

      console.log("[SAQR] Analyzing (AR)...");
      const arData = await analyzeWithTimeout(
        image,
        activeSpec,
        "ar",
        captureAbortController.signal
      );

      if (captureAbortController.signal.aborted) {
        console.log("[SAQR] Capture aborted");
        return;
      }

      console.log("[SAQR] Analysis complete:", enData.status);

      // Store result for DONE button to save
      setLastScanResult({
        status: enData.status || "uncertain",
        confidence: enData.confidence || 0,
        reasoning: enData.reasoning || "",
        reasoningAr: arData.reasoning || "",
        photoUrl: image,
      });
      setScanStatus("detected");
      setIsAnalyzing(false);
      setCapturedImage(null); // Clear captured image to show live camera again

    } catch (err: any) {
      console.error("[SAQR] Capture error:", err);
      if (err.message === 'Analysis timed out') {
        setAnalysisError("Analysis timed out. Please try again.");
      } else {
        setAnalysisError("Analysis failed. Please try again.");
      }
      setIsAnalyzing(false);
      setCapturedImage(null);
    }
  };

  // Handle DONE - saves current scan result and closes camera
  const handleDone = async () => {
    if (!activeSpec) {
      closeCameraView();
      return;
    }

    console.log("[SAQR] Done pressed, lastScanResult:", lastScanResult ? lastScanResult.status : "none");
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      if (lastScanResult) {
        // Save the scan result
        const statusMap: Record<string, ResultStatus> = {
          pass: "PASS",
          fail: "FAIL",
          uncertain: "UNCERTAIN",
        };
        const status = statusMap[lastScanResult.status] || "UNCERTAIN";

        console.log("[SAQR] Saving scan result:", status);
        await saveResult.mutateAsync({
          inspectionId: id,
          specId: activeSpec.id,
          status,
          photoUrl: lastScanResult.photoUrl || undefined,
          aiAnalyzed: true,
          aiConfidence: lastScanResult.confidence,
          aiReasoning: lastScanResult.reasoning,
          aiReasoningAr: lastScanResult.reasoningAr,
        });
      } else {
        // No evidence detected - save as fail with "not found" comment
        console.log("[SAQR] Saving as 'evidence not found'");
        await saveResult.mutateAsync({
          inspectionId: id,
          specId: activeSpec.id,
          status: "FAIL",
          photoUrl: undefined,
          aiAnalyzed: true,
          aiConfidence: 0,
          aiReasoning: "Evidence not found: No matching evidence detected during inspection",
          aiReasoningAr: "لم يتم العثور على دليل: لم يتم اكتشاف دليل مطابق أثناء التفتيش",
        });
      }

      // Close camera after saving
      resetAnalysisState();
      stopCamera();
      setActiveSpecId(null);
    } catch (err) {
      console.error("[SAQR] Done save error:", err);
      setAnalysisError("Failed to save. Please try again.");
      setIsAnalyzing(false);
    }
  };

  // Handle back (top left) - just close without saving
  const handleBackToList = () => {
    console.log("[SAQR] Back to list pressed");
    closeCameraView();
  };

  // Handle retry after error
  const handleRetry = () => {
    console.log("[SAQR] Retry pressed");
    setAnalysisError(null);
    setCapturedImage(null);
    setIsAnalyzing(false);
  };

  const handleContinueInspection = () => {
    if (nextPendingSpec) {
      openCameraForSpec(nextPendingSpec.id);
    }
  };

  const handleComplete = () => {
    if (pendingCount > 0) {
      setShowForceComplete(true);
    } else {
      completeInspection.mutate({ id });
    }
  };

  const handleForceComplete = () => {
    completeInspection.mutate({ id });
  };

  // Handle PDF download
  const handleDownloadPDF = async () => {
    if (!inspection) return;

    setIsGeneratingPDF(true);
    try {
      // Build the data structure for PDF
      const pdfData = {
        id: inspection.id,
        status: inspection.status,
        startedAt: inspection.startedAt?.toISOString() || null,
        completedAt: inspection.completedAt?.toISOString() || null,
        passRate: inspection.passRate,
        totalItems: specs.length,
        passedItems: passCount,
        failedItems: failCount,
        category: {
          name: inspection.category.name,
          nameAr: inspection.category.nameAr,
          authority: {
            code: inspection.category.authority.code,
            name: inspection.category.authority.name,
            nameAr: inspection.category.authority.nameAr,
          },
        },
        site: inspection.site ? {
          name: inspection.site.name,
          nameAr: inspection.site.nameAr,
          address: inspection.site.address,
        } : null,
        organization: inspection.organization ? {
          name: inspection.organization.name,
          nameAr: inspection.organization.nameAr,
        } : null,
        results: sortedSpecs.map((spec) => {
          // Convert SKIPPED to null since PDF only supports PASS/FAIL/UNCERTAIN
          const rawStatus = spec.result?.status;
          const status = (rawStatus === "SKIPPED" ? null : rawStatus) as "PASS" | "FAIL" | "UNCERTAIN" | null;
          return {
            id: spec.id,
            status,
            notes: spec.result?.notes || null,
            photoUrl: spec.result?.photoUrl || null,
            aiAnalyzed: spec.result?.aiAnalyzed || false,
            aiConfidence: spec.result?.aiConfidence || null,
            aiReasoning: spec.result?.aiReasoning || null,
            aiReasoningAr: spec.result?.aiReasoningAr || null,
            spec: {
              code: spec.code,
              requirement: spec.requirement,
              requirementAr: spec.requirementAr,
            },
          };
        }),
      };

      await generateInspectionPDF(pdfData);
    } catch (err) {
      console.error("[SAQR] PDF generation error:", err);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <p className="mb-2">Inspection not found</p>
          <p className="text-sm text-zinc-500 mb-4" dir="rtl">التفتيش غير موجود</p>
          <Link href="/inspect" className="text-amber-400 hover:underline">
            Back | العودة
          </Link>
        </div>
      </div>
    );
  }

  const authorityCode = inspection.category.authority.code;
  const authorityColor = authorityColors[authorityCode] || "bg-zinc-600";

  // CAMERA VIEW - FULL SCREEN
  if (activeSpecId && activeSpec) {
    const evidenceCfg = evidenceTypes[activeSpec.evidenceType] || { icon: ImageIcon, color: "text-green-500" };
    const EvidenceIcon = evidenceCfg.icon;

    return (
      <div
        className="bg-black overflow-hidden text-white"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 100
        }}
      >
        {/* Camera - Full Screen */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 ${capturedImage ? 'hidden' : ''}`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />

        {capturedImage && (
          <img
            src={capturedImage}
            alt="Captured"
            className="absolute inset-0"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        )}

        <canvas ref={canvasRef} className="hidden" />

        {/* Camera Error */}
        {cameraError && (
          <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
            <div className="text-center p-6">
              <Camera className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
              <p className="text-white text-lg mb-4">{cameraError}</p>
              <Button onClick={startCamera} className="bg-amber-500 hover:bg-amber-400 text-black">
                <Camera className="w-5 h-5 mr-2" />
                Start Camera | <span dir="rtl">تشغيل الكاميرا</span>
              </Button>
            </div>
          </div>
        )}

        {/* Camera Loading */}
        {!cameraReady && !cameraError && (
          <div className="absolute inset-0 bg-black flex items-center justify-center z-50">
            <div className="text-center p-6">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-amber-500 animate-spin" />
              <p className="text-white text-lg">
                Starting Camera... | <span dir="rtl">جاري تشغيل الكاميرا...</span>
              </p>
            </div>
          </div>
        )}

        {/* Analyzing overlay */}
        {isAnalyzing && !analysisError && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="text-center p-6">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-amber-500 animate-spin" />
              <p className="text-white text-lg">
                Analyzing... | <span dir="rtl">جاري التحليل...</span>
              </p>
            </div>
          </div>
        )}

        {/* Error overlay with retry */}
        {analysisError && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="text-center p-6">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
              <p className="text-white text-lg mb-4">{analysisError}</p>
              <div className="flex gap-3 justify-center">
                <Button onClick={handleRetry} className="bg-amber-500 hover:bg-amber-400 text-black">
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Retry | <span dir="rtl">إعادة</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* TOP: Back arrow + Spec Info */}
        <div className="absolute top-0 left-0 right-0 z-[200] bg-black/80 max-h-[130px] overflow-hidden">
          {/* Row 1: Back arrow + SAQR badge */}
          <div className="flex items-center justify-between px-4 py-2">
            <button onClick={handleBackToList} disabled={isAnalyzing} className="flex items-center gap-2 text-white text-sm disabled:opacity-50">
              <ArrowLeft className="w-5 h-5" />
              Back | <span dir="rtl">رجوع</span>
            </button>
            <div className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-black">
              <Zap className="w-3 h-3" />
              SAQR AI
            </div>
          </div>
          {/* Row 2: Point camera at */}
          <p className="px-4 text-xs text-zinc-400">Point camera at | <span dir="rtl">وجّه الكاميرا نحو</span></p>
          {/* Row 3: Code + icon */}
          <div className="flex items-center gap-2 px-4 py-1">
            <span className="text-xs font-mono bg-amber-500/30 text-amber-400 px-2 py-0.5 rounded">{activeSpec.code}</span>
            <EvidenceIcon className={`w-4 h-4 ${evidenceCfg.color}`} />
          </div>
          {/* Row 4: EN text */}
          <p className="px-4 text-sm text-white line-clamp-1">{activeSpec.requirement}</p>
          {/* Row 5: AR text */}
          <p className="px-4 pb-2 text-sm text-zinc-300 line-clamp-1" dir="rtl">{activeSpec.requirementAr}</p>
        </div>

        {/* BOTTOM: Scanning status + Controls */}
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent pb-safe p-4">
          {/* Scanning Status Indicator */}
          <div className="flex justify-center mb-4">
            {scanStatus === "scanning" && (
              <div className="bg-amber-500/20 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-amber-400 animate-pulse" />
                <span className="text-amber-400 text-sm font-medium">Scanning... | <span dir="rtl">جاري المسح</span></span>
              </div>
            )}
            {scanStatus === "detected" && lastScanResult && (
              <div className={`px-4 py-2 rounded-lg max-w-sm ${
                lastScanResult.status === "pass" ? "bg-green-600/90" :
                lastScanResult.status === "fail" ? "bg-red-600/90" : "bg-amber-600/90"
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-bold text-sm">
                    {lastScanResult.status === "pass" ? "Detected: Pass | ناجح" :
                     lastScanResult.status === "fail" ? "Detected: Fail | غير مرضي" : "Uncertain | غير متأكد"}
                  </span>
                  <span className="text-white/70 text-xs">{Math.round(lastScanResult.confidence * 100)}%</span>
                </div>
                <p className="text-white/80 text-xs line-clamp-1">{lastScanResult.reasoning}</p>
              </div>
            )}
            {scanStatus === "idle" && cameraReady && !capturedImage && (
              <div className="bg-zinc-800/80 backdrop-blur-sm px-4 py-2 rounded-full flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-zinc-400" />
                <span className="text-zinc-400 text-sm">Looking for evidence... | <span dir="rtl">جاري البحث عن دليل...</span></span>
              </div>
            )}
          </div>

          {/* Two buttons: Capture (white circle) + DONE */}
          <div className="flex items-center justify-center gap-8">
            {/* Capture button (white circle) */}
            <button
              onClick={handleCapture}
              disabled={!cameraReady || isAnalyzing}
              className="w-20 h-20 rounded-full bg-white border-4 border-white/30 shadow-lg touch-manipulation active:scale-95 transition-transform disabled:opacity-50"
            />

            {/* DONE button */}
            <button
              onClick={handleDone}
              disabled={isAnalyzing}
              className="flex flex-col items-center gap-1 touch-manipulation disabled:opacity-50"
            >
              <div className="w-14 h-14 rounded-full bg-green-600 flex items-center justify-center">
                <Check className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs text-green-400">Done | <span dir="rtl">تم</span></span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // DASHBOARD VIEW
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 p-4">
        <div className="flex items-center justify-between">
          <Link href="/inspect" className="flex items-center gap-2 text-zinc-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Back | <span dir="rtl">رجوع</span></span>
          </Link>
          <span className="text-xs text-zinc-500">v{VERSION}</span>
        </div>
        <h1 className="text-center mt-2 font-bold">
          Inspection Dashboard | <span dir="rtl">لوحة التفتيش</span>
        </h1>
      </header>

      {/* Top Section: Authority + Category + Stats */}
      <div className="border-b border-zinc-800 p-4 bg-zinc-900/50">
        {/* Authority + Category */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${authorityColor}`}>
            <Building2 className="w-4 h-4 text-white" />
            <span className="text-white font-bold text-sm">
              {authorityCode} | <span dir="rtl">{inspection.category.authority.nameAr}</span>
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-600" />
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" style={{ color: inspection.category.color }} />
            <span className="text-white text-sm">
              {inspection.category.name} | <span dir="rtl">{inspection.category.nameAr}</span>
            </span>
          </div>
        </div>

        {/* Completion Ring + Stats */}
        <div className="flex items-center gap-6">
          {/* Circular Progress */}
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="text-zinc-800" />
              <circle
                cx="50" cy="50" r="40"
                stroke="currentColor" strokeWidth="8" fill="none"
                strokeDasharray={`${(completionPercent / 100) * 251} 251`}
                strokeLinecap="round"
                className={completionPercent === 100 ? "text-green-500" : completionPercent >= 50 ? "text-amber-500" : "text-red-500"}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold">{completionPercent}%</span>
              <span className="text-[8px] text-zinc-400">Complete | <span dir="rtl">الإنجاز</span></span>
            </div>
          </div>

          {/* Stats - Simple text based */}
          <div className="flex-1 grid grid-cols-3 gap-2">
            <div className="bg-zinc-800 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-green-400">{passCount}</div>
              <div className="text-[10px] text-green-400">Pass | <span dir="rtl">ناجح</span></div>
            </div>
            <div className="bg-zinc-800 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-red-400">{failCount}</div>
              <div className="text-[10px] text-red-400">Fail | <span dir="rtl">غير مرضي</span></div>
            </div>
            <div className="bg-zinc-800 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-yellow-400">{pendingCount}</div>
              <div className="text-[10px] text-yellow-400">Pending | <span dir="rtl">معلّق</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Specs List */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {sortedSpecs.map((spec) => {
            const status = spec.result?.status;
            const isPending = !status || status === "SKIPPED";
            const evidenceCfg = evidenceTypes[spec.evidenceType] || { icon: ImageIcon, labelEn: "Photo", labelAr: "صورة", color: "text-green-500" };
            const EvidenceIcon = evidenceCfg.icon;

            // Status text color
            const statusTextColor = isPending ? "text-yellow-400" : status === "PASS" ? "text-green-400" : "text-red-400";
            const statusText = isPending ? "Pending | معلّق" : status === "PASS" ? "Pass | ناجح" : "Fail | غير مرضي";

            return (
              <button
                key={spec.id}
                onClick={() => openCameraForSpec(spec.id)}
                className="w-full p-4 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 transition-all text-left"
              >
                {/* Header: Code + Evidence + Status */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs font-mono bg-zinc-800 px-2 py-0.5 rounded text-amber-400">{spec.code}</span>
                  <EvidenceIcon className={`w-3.5 h-3.5 ${evidenceCfg.color}`} />
                  <span className={`text-xs ${evidenceCfg.color}`}>
                    {evidenceCfg.labelEn} | <span dir="rtl">{evidenceCfg.labelAr}</span>
                  </span>
                  <span className="flex-1" />
                  <span className={`text-xs font-bold ${statusTextColor}`}>{statusText}</span>
                </div>

                {/* Requirement EN */}
                <p className="text-sm text-zinc-200 line-clamp-1">{spec.requirement}</p>
                {/* Requirement AR */}
                <p className="text-base text-zinc-200 line-clamp-1 mt-0.5" dir="rtl">{spec.requirementAr}</p>

                {/* SAQR Comment */}
                {spec.result?.aiReasoning && (
                  <div className="mt-2 pt-2 border-t border-zinc-700">
                    <div className="flex items-center gap-1 mb-1">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span className="text-xs text-amber-400 font-medium">SAQR</span>
                    </div>
                    <p className="text-xs text-zinc-300 line-clamp-2">{spec.result.aiReasoning}</p>
                    {spec.result.aiReasoningAr && (
                      <p className="text-sm text-zinc-300 line-clamp-2 mt-1" dir="rtl">{spec.result.aiReasoningAr}</p>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </main>

      {/* Bottom Buttons */}
      <div className="border-t border-zinc-800 p-4 space-y-3 bg-zinc-900/50">
        {/* Download PDF Button - Always available */}
        <button
          onClick={handleDownloadPDF}
          disabled={isGeneratingPDF}
          className="w-full bg-zinc-800 text-white py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isGeneratingPDF ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Download PDF | <span dir="rtl">تحميل PDF</span>
        </button>

        {pendingCount > 0 ? (
          <>
            <button
              onClick={handleContinueInspection}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-black py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              Continue | <span dir="rtl">متابعة</span>
            </button>
            <button
              onClick={handleComplete}
              className="w-full bg-zinc-800 text-zinc-400 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              Force Complete ({pendingCount}) | <span dir="rtl">إكمال إجباري</span>
            </button>
          </>
        ) : (
          <button
            onClick={handleComplete}
            disabled={completeInspection.isPending}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {completeInspection.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
            Done | <span dir="rtl">تم</span>
          </button>
        )}
      </div>

      {/* Force Complete Modal */}
      {showForceComplete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full border border-zinc-700">
            <div className="text-center mb-4">
              <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
              <h3 className="text-lg font-bold text-white">
                Force Complete? | <span dir="rtl">إكمال إجباري؟</span>
              </h3>
              <p className="text-sm text-zinc-400 mt-2">
                You have {pendingCount} pending items | <span dir="rtl">لديك {pendingCount} عناصر معلقة</span>
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleForceComplete}
                disabled={completeInspection.isPending}
                className="w-full bg-yellow-600 text-white py-3 rounded-lg font-medium disabled:opacity-50"
              >
                {completeInspection.isPending ? "Completing..." : "Force Complete"} | <span dir="rtl">{completeInspection.isPending ? "جاري الإكمال..." : "إكمال إجباري"}</span>
              </button>
              <button
                onClick={() => setShowForceComplete(false)}
                className="w-full bg-zinc-800 text-zinc-400 py-3 rounded-lg font-medium"
              >
                Cancel | <span dir="rtl">إلغاء</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
