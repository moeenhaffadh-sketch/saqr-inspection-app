// 3-step unified inspection flow: Authority → Category → Specifications (all on one page)
"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { trpc } from "@/lib/trpc/client";
import {
  ArrowLeft,
  ClipboardList,
  Building2,
  Shield,
  Loader2,
  ChevronRight,
  Camera,
  ScanLine,
  Zap,
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
import { Button } from "@/components/ui/button";
import { generateInspectionPDF } from "@/lib/utils/generatePDF";

const VERSION = '0.4.0';
const ANALYSIS_TIMEOUT = 30000;

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

const GCC_COUNTRIES = [
  { code: "BH", name: "Bahrain", nameAr: "البحرين", flag: "🇧🇭" },
  { code: "SA", name: "Saudi Arabia", nameAr: "السعودية", flag: "🇸🇦" },
  { code: "AE", name: "UAE", nameAr: "الإمارات", flag: "🇦🇪" },
  { code: "QA", name: "Qatar", nameAr: "قطر", flag: "🇶🇦" },
  { code: "KW", name: "Kuwait", nameAr: "الكويت", flag: "🇰🇼" },
  { code: "OM", name: "Oman", nameAr: "عمان", flag: "🇴🇲" },
];

// Authority colors for visual distinction
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

function InspectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const countryFromUrl = searchParams.get("country");
  const authorityFromUrl = searchParams.get("authority");
  const inspectionFromUrl = searchParams.get("inspection");

  // Flow state
  const [selectedCountry, setSelectedCountry] = useState<string>("BH");
  const [selectedAuthority, setSelectedAuthority] = useState<string | null>(null);
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Dashboard state
  const [activeSpecId, setActiveSpecId] = useState<string | null>(null);
  const [showForceComplete, setShowForceComplete] = useState(false);
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

  // Initialize country from URL or localStorage
  useEffect(() => {
    let country = "BH";

    if (countryFromUrl && GCC_COUNTRIES.some(c => c.code === countryFromUrl)) {
      country = countryFromUrl;
      localStorage.setItem("saqr_selected_country", countryFromUrl);
    } else {
      const saved = localStorage.getItem("saqr_selected_country");
      if (saved && GCC_COUNTRIES.some(c => c.code === saved)) {
        country = saved;
      }
    }

    setSelectedCountry(country);
    setIsReady(true);
  }, [countryFromUrl]);

  // Initialize authority from URL parameter (for back navigation)
  useEffect(() => {
    if (authorityFromUrl && isReady) {
      setSelectedAuthority(authorityFromUrl);
    }
  }, [authorityFromUrl, isReady]);

  // Initialize inspection from URL parameter (for direct links)
  useEffect(() => {
    if (inspectionFromUrl && isReady) {
      setInspectionId(inspectionFromUrl);
    }
  }, [inspectionFromUrl, isReady]);

  // Fetch authorities for selected country
  const { data: authorities, isLoading: loadingAuthorities } = trpc.authority.getByCountry.useQuery(
    { countryCode: selectedCountry },
    { enabled: isReady && !!selectedCountry }
  );

  // Fetch categories for selected authority
  const { data: categories, isLoading: loadingCategories } = trpc.inspectionCategory.getByAuthority.useQuery(
    { authorityId: selectedAuthority! },
    { enabled: !!selectedAuthority }
  );

  // Fetch inspection data (only when inspectionId is set)
  const {
    data: inspection,
    isLoading: loadingInspection,
    refetch: refetchInspection,
  } = trpc.inspection.getById.useQuery(
    { id: inspectionId! },
    { enabled: !!inspectionId }
  );

  // Create inspection mutation
  const createInspection = trpc.inspection.create.useMutation();

  // Save result mutation
  const saveResult = trpc.inspection.saveResult.useMutation({
    onSuccess: () => {
      console.log("[SAQR] Save result success, refetching");
      refetchInspection();
    },
    onError: (error) => {
      console.error("[SAQR] Save result error:", error);
      setIsAnalyzing(false);
      setAnalysisError("Failed to save result. Please try again.");
    },
  });

  // Complete inspection mutation
  const completeInspection = trpc.inspection.complete.useMutation({
    onSuccess: () => router.push(`/inspections/${inspectionId}/results`),
  });

  const handleAuthoritySelect = (id: string) => {
    setSelectedAuthority(id);
  };

  const handleCategorySelect = async (categoryId: string) => {
    // Create inspection and switch to step 3 instantly
    setIsStarting(true);
    try {
      const newInspection = await createInspection.mutateAsync({
        categoryId,
      });
      // Set inspection ID to switch to step 3
      setInspectionId(newInspection.id);
      setIsStarting(false);
    } catch (error) {
      console.error("Failed to create inspection:", error);
      setIsStarting(false);
    }
  };

  const selectedCountryData = GCC_COUNTRIES.find(c => c.code === selectedCountry);
  const selectedAuthorityData = authorities?.find(a => a.id === selectedAuthority);

  // Current step: 1 = Authority, 2 = Category, 3 = Specifications
  const currentStep = !selectedAuthority ? 1 : !inspectionId ? 2 : 3;

  // Handle back button based on current step
  const handleBack = () => {
    if (currentStep === 3) {
      // Step 3 → Step 2: Clear inspection, keep authority
      setInspectionId(null);
      setActiveSpecId(null);
      resetAnalysisState();
      stopCamera();
    } else if (currentStep === 2) {
      // Step 2 → Step 1: Go back to authority selection
      setSelectedAuthority(null);
    } else {
      // Step 1 → Landing page
      router.push('/');
    }
  };

  // Navigate to specific step
  const goToStep1 = () => {
    setInspectionId(null);
    setSelectedAuthority(null);
    setActiveSpecId(null);
    resetAnalysisState();
    stopCamera();
  };

  const goToStep2 = () => {
    setInspectionId(null);
    setActiveSpecId(null);
    resetAnalysisState();
    stopCamera();
  };

  // ============ CAMERA FUNCTIONS ============

  const resetAnalysisState = useCallback(() => {
    console.log("[SAQR] Resetting analysis state");
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setIsAnalyzing(false);
    setCapturedImage(null);
    setScanStatus("idle");
    setLastScanResult(null);
    setAnalysisError(null);
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
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
    console.log("[SAQR Camera] openCameraForSpec called for:", specId);
    resetAnalysisState();
    stopCamera();
    setActiveSpecId(specId);
    setCameraError(null);
    setCameraReady(false);
  }, [stopCamera, resetAnalysisState]);

  const closeCameraView = useCallback(() => {
    resetAnalysisState();
    stopCamera();
    setActiveSpecId(null);
  }, [stopCamera, resetAnalysisState]);

  // Effect to start camera when activeSpecId is set
  useEffect(() => {
    if (!activeSpecId) return;

    console.log("[SAQR Camera] activeSpecId changed to:", activeSpecId);

    // Use requestAnimationFrame to ensure DOM has been updated
    let cancelled = false;
    const startCameraWhenReady = () => {
      if (cancelled) return;

      // Wait for next frame to ensure React has rendered the camera view
      requestAnimationFrame(() => {
        if (cancelled) return;
        console.log("[SAQR Camera] Starting camera after RAF");
        startCamera();
      });
    };

    // Small delay to ensure state updates have propagated
    const timeoutId = setTimeout(startCameraWhenReady, 50);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [activeSpecId, startCamera]);

  // Cleanup camera on component unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Helper function to make API call with timeout
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

      if (!response.ok) {
        return { error: `API error: ${response.status} ${response.statusText}` };
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        return { error: "API returned non-JSON response" };
      }

      try {
        return await response.json();
      } catch {
        return { error: "Failed to parse API response" };
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        return null;
      }
      throw err;
    } finally {
      signal.removeEventListener('abort', combinedAbort);
    }
  }, []);

  // Build specs with results
  const specs: SpecWithResult[] =
    inspection?.category?.specs.map((spec) => ({
      ...spec,
      result: inspection.results.find((r) => r.specId === spec.id),
    })) || [];

  const sortedSpecs = [...specs].sort((a, b) => {
    const statusOrder = (status: string | null | undefined) => {
      if (status === "PASS") return 0;
      if (status === "FAIL") return 1;
      return 2;
    };
    return statusOrder(a.result?.status) - statusOrder(b.result?.status);
  });

  const passCount = specs.filter((s) => s.result?.status === "PASS").length;
  const failCount = specs.filter((s) => s.result?.status === "FAIL").length;
  const pendingCount = specs.filter((s) => !s.result?.status || s.result.status === "SKIPPED").length;
  const totalCount = specs.length;
  const completionPercent = totalCount > 0 ? Math.round(((passCount + failCount) / totalCount) * 100) : 0;

  const activeSpec = specs.find((s) => s.id === activeSpecId);
  const nextPendingSpec = specs.find((s) => !s.result?.status || s.result.status === "SKIPPED");

  // SAQR continuous auto-scan effect
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

      const scanAbortController = new AbortController();
      abortControllerRef.current = scanAbortController;

      try {
        const enData = await analyzeWithTimeout(image, activeSpec, "en", scanAbortController.signal);

        if (!enData || !isMounted || scanAbortController.signal.aborted) {
          setScanStatus("idle");
          return;
        }

        if (enData.error) {
          setScanStatus("idle");
          return;
        }

        const arData = await analyzeWithTimeout(image, activeSpec, "ar", scanAbortController.signal);

        if (!isMounted || scanAbortController.signal.aborted) {
          setScanStatus("idle");
          return;
        }

        if (enData.status) {
          setLastScanResult({
            status: enData.status,
            confidence: enData.confidence || 0,
            reasoning: enData.reasoning || "",
            reasoningAr: arData?.reasoning || "",
            photoUrl: image,
          });
          setScanStatus("detected");
        } else {
          setScanStatus("idle");
        }
      } catch {
        if (!isMounted) return;
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

  const handleCapture = async () => {
    if (!activeSpec) return;

    const image = capturePhoto();
    if (!image) return;

    setCapturedImage(image);
    setIsAnalyzing(true);
    setAnalysisError(null);

    const captureAbortController = new AbortController();
    abortControllerRef.current = captureAbortController;

    try {
      const enData = await analyzeWithTimeout(image, activeSpec, "en", captureAbortController.signal);

      if (!enData || captureAbortController.signal.aborted) {
        setIsAnalyzing(false);
        setCapturedImage(null);
        return;
      }

      const arData = await analyzeWithTimeout(image, activeSpec, "ar", captureAbortController.signal);

      if (captureAbortController.signal.aborted) {
        setIsAnalyzing(false);
        setCapturedImage(null);
        return;
      }

      setLastScanResult({
        status: enData.status || "uncertain",
        confidence: enData.confidence || 0,
        reasoning: enData.reasoning || "",
        reasoningAr: arData?.reasoning || "",
        photoUrl: image,
      });
      setScanStatus("detected");
      setIsAnalyzing(false);
      setCapturedImage(null);

    } catch {
      setAnalysisError("Analysis failed. Please try again.");
      setIsAnalyzing(false);
      setCapturedImage(null);
    }
  };

  const handleDone = async () => {
    if (!activeSpec || !inspectionId) {
      closeCameraView();
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      if (lastScanResult) {
        const statusMap: Record<string, ResultStatus> = {
          pass: "PASS",
          fail: "FAIL",
          uncertain: "UNCERTAIN",
        };
        const status = statusMap[lastScanResult.status] || "UNCERTAIN";

        await saveResult.mutateAsync({
          inspectionId,
          specId: activeSpec.id,
          status,
          photoUrl: lastScanResult.photoUrl || undefined,
          aiAnalyzed: true,
          aiConfidence: lastScanResult.confidence,
          aiReasoning: lastScanResult.reasoning,
          aiReasoningAr: lastScanResult.reasoningAr,
        });
      } else {
        await saveResult.mutateAsync({
          inspectionId,
          specId: activeSpec.id,
          status: "FAIL",
          photoUrl: undefined,
          aiAnalyzed: true,
          aiConfidence: 0,
          aiReasoning: "Evidence not found: No matching evidence detected during inspection",
          aiReasoningAr: "لم يتم العثور على دليل: لم يتم اكتشاف دليل مطابق أثناء التفتيش",
        });
      }

      resetAnalysisState();
      stopCamera();
      setActiveSpecId(null);
    } catch {
      setAnalysisError("Failed to save. Please try again.");
      setIsAnalyzing(false);
    }
  };

  const handleBackToList = () => {
    closeCameraView();
  };

  const handleRetry = () => {
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
    if (!inspectionId) return;
    if (pendingCount > 0) {
      setShowForceComplete(true);
    } else {
      completeInspection.mutate({ id: inspectionId });
    }
  };

  const handleForceComplete = () => {
    if (!inspectionId) return;
    completeInspection.mutate({ id: inspectionId });
  };

  const handleDownloadPDF = async () => {
    if (!inspection) return;

    setIsGeneratingPDF(true);
    try {
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
          const status = spec.result?.status;
          const pdfStatus = status === "SKIPPED" ? null : (status as "PASS" | "FAIL" | "UNCERTAIN" | null);
          return {
            id: spec.id,
            status: pdfStatus,
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

  // ============ RENDER ============

  // Debug logging
  console.log("[SAQR Render] currentStep:", currentStep, "activeSpecId:", activeSpecId, "activeSpec:", !!activeSpec, "specs.length:", specs.length);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  // CAMERA VIEW - FULL SCREEN (Step 3 with active spec)
  if (currentStep === 3 && activeSpecId && activeSpec) {
    console.log("[SAQR Render] Rendering CAMERA VIEW for spec:", activeSpecId);
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
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 ${capturedImage ? 'hidden' : ''}`}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />

        {capturedImage && (
          <img
            src={capturedImage}
            alt="Captured"
            className="absolute inset-0"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}

        <canvas ref={canvasRef} className="hidden" />

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

        <div className="absolute top-0 left-0 right-0 z-[200] bg-black/80 max-h-[130px] overflow-hidden">
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
          <p className="px-4 text-xs text-zinc-400">Point camera at | <span dir="rtl">وجّه الكاميرا نحو</span></p>
          <div className="flex items-center gap-2 px-4 py-1">
            <span className="text-xs font-mono bg-amber-500/30 text-amber-400 px-2 py-0.5 rounded">{activeSpec.code}</span>
            <EvidenceIcon className={`w-4 h-4 ${evidenceCfg.color}`} />
          </div>
          <p className="px-4 text-sm text-white line-clamp-1">{activeSpec.requirement}</p>
          <p className="px-4 pb-2 text-sm text-zinc-300 line-clamp-1" dir="rtl">{activeSpec.requirementAr}</p>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent pb-safe p-4">
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

          <div className="flex items-center justify-center gap-8">
            <button
              onClick={handleCapture}
              disabled={!cameraReady || isAnalyzing}
              className="w-20 h-20 rounded-full bg-white border-4 border-white/30 shadow-lg touch-manipulation active:scale-95 transition-transform disabled:opacity-50"
            />
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

  // Authority color for step 3
  const authorityCode = inspection?.category?.authority?.code;
  const authorityColor = authorityCode ? authorityColors[authorityCode] || "bg-zinc-600" : "bg-zinc-600";

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="text-zinc-400 hover:text-white transition-colors p-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Link href="/" className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">Saqr</span>
              <Image
                src="/landing-falcon.png"
                alt="Saqr"
                width={36}
                height={36}
                priority
                unoptimized
              />
              <span className="text-xl font-bold text-white">صقر</span>
            </div>
            <p className="text-xs text-zinc-500">Field Inspector v{VERSION}</p>
          </Link>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700">
          <span className="text-lg">{selectedCountryData?.flag}</span>
          <span className="text-sm font-medium">{selectedCountryData?.name}</span>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="border-b border-zinc-800 px-4 py-3 bg-zinc-900/50">
        <div className="flex items-center gap-2 text-sm overflow-x-auto">
          <button
            onClick={goToStep1}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${currentStep === 1 ? "bg-amber-500 text-black" : "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"}`}
          >
            <span className="inline-flex items-center gap-1"><span>1. Authority</span><span>|</span><span>الجهة</span></span>
          </button>
          <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
          <button
            onClick={currentStep >= 2 ? goToStep2 : undefined}
            disabled={currentStep < 2}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${currentStep === 2 ? "bg-amber-500 text-black" : currentStep > 2 ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : "bg-zinc-800 text-zinc-500"}`}
          >
            <span className="inline-flex items-center gap-1"><span>2. Category</span><span>|</span><span>الفئة</span></span>
          </button>
          <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
          <span className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap ${currentStep === 3 ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-500"}`}>
            <span className="inline-flex items-center gap-1"><span>3. Specifications</span><span>|</span><span>المواصفات</span></span>
          </span>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        {/* Step 1: Select Authority */}
        {currentStep === 1 && (
          <section className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold">
                <span className="inline-flex items-center gap-2"><span>Select Authority</span><span>|</span><span>اختر الجهة</span></span>
              </h2>
            </div>

            {loadingAuthorities ? (
              <div className="flex flex-col items-center gap-2 py-12 text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="inline-flex items-center gap-1"><span>Loading...</span><span>|</span><span>جاري التحميل...</span></span>
              </div>
            ) : authorities?.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No authorities available</p>
                <p className="text-sm mt-1" dir="rtl">لا توجد جهات متاحة</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {authorities?.map((authority) => {
                  const colorClass = authorityColors[authority.code] || "bg-zinc-600";
                  return (
                    <button
                      key={authority.id}
                      onClick={() => handleAuthoritySelect(authority.id)}
                      className="p-5 rounded-xl border-2 border-zinc-800 hover:border-amber-500 transition-all text-left bg-zinc-900/50 hover:bg-zinc-900 group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-xl ${colorClass} flex items-center justify-center shrink-0`}>
                          <Building2 className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">{authority.code}</div>
                          <div className="text-sm text-zinc-400 truncate">{authority.name}</div>
                          <div className="text-base text-zinc-400 truncate leading-relaxed" dir="rtl">{authority.nameAr}</div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-amber-400 transition-colors shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Step 2: Select Category */}
        {currentStep === 2 && selectedAuthority && (
          <section className="space-y-4">
            <button
              onClick={() => setSelectedAuthority(null)}
              className="flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="inline-flex items-center gap-1 text-sm"><span>Back to Authorities</span><span>|</span><span>العودة للجهات</span></span>
            </button>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-4">
              <div className={`w-10 h-10 rounded-lg ${authorityColors[selectedAuthorityData?.code || ""] || "bg-zinc-600"} flex items-center justify-center`}>
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-amber-400 inline-flex items-center gap-1">
                  <span>{selectedAuthorityData?.code}</span>
                  <span className="text-amber-400/50">|</span>
                  <span className="text-base" dir="rtl">{selectedAuthorityData?.nameAr}</span>
                </div>
                <div className="text-sm text-zinc-400">{selectedAuthorityData?.name}</div>
              </div>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-xl font-bold">
                <span className="inline-flex items-center gap-2"><span>Select Category</span><span>|</span><span>اختر الفئة</span></span>
              </h2>
            </div>

            {loadingCategories ? (
              <div className="flex flex-col items-center gap-2 py-12 text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="inline-flex items-center gap-1"><span>Loading...</span><span>|</span><span>جاري التحميل...</span></span>
              </div>
            ) : categories?.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No categories available</p>
                <p className="text-sm mt-1" dir="rtl">لا توجد فئات متاحة</p>
              </div>
            ) : isStarting ? (
              <div className="flex flex-col items-center gap-2 py-12 text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span className="inline-flex items-center gap-1"><span>Starting inspection...</span><span>|</span><span>جاري بدء التفتيش...</span></span>
              </div>
            ) : (
              <div className="space-y-3">
                {categories?.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategorySelect(category.id)}
                    className="w-full p-5 rounded-xl border-2 border-zinc-800 hover:border-amber-500 transition-all text-left bg-zinc-900/50 hover:bg-zinc-900 group"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: category.color + "30" }}
                      >
                        <ClipboardList className="w-7 h-7" style={{ color: category.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">{category.name}</div>
                        <div className="text-base text-zinc-400 leading-relaxed" dir="rtl">{category.nameAr}</div>
                        {category.description && (
                          <div className="text-xs text-zinc-500 mt-1">{category.description}</div>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-amber-400 transition-colors shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Step 3: Specifications Dashboard */}
        {currentStep === 3 && inspectionId && (
          <section className="space-y-4 -mx-4 -mt-4">
            {loadingInspection ? (
              <div className="flex flex-col items-center gap-2 py-12 text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span className="inline-flex items-center gap-1"><span>Loading...</span><span>|</span><span>جاري التحميل...</span></span>
              </div>
            ) : !inspection ? (
              <div className="text-center py-12 text-zinc-500">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Inspection not found</p>
                <p className="text-sm mt-1" dir="rtl">التفتيش غير موجود</p>
              </div>
            ) : (
              <>
                {/* Top Section: Authority + Category + Stats */}
                <div className="border-b border-zinc-800 p-4 bg-zinc-900/50">
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

                  <div className="flex items-center gap-6">
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
                <div className="p-4 space-y-2">
                  {sortedSpecs.map((spec) => {
                    const status = spec.result?.status;
                    const isPending = !status || status === "SKIPPED";
                    const evidenceCfg = evidenceTypes[spec.evidenceType] || { icon: ImageIcon, labelEn: "Photo", labelAr: "صورة", color: "text-green-500" };
                    const EvidenceIcon = evidenceCfg.icon;
                    const statusTextColor = isPending ? "text-yellow-400" : status === "PASS" ? "text-green-400" : "text-red-400";
                    const statusText = isPending ? "Pending | معلّق" : status === "PASS" ? "Pass | ناجح" : "Fail | غير مرضي";

                    return (
                      <button
                        key={spec.id}
                        onClick={() => openCameraForSpec(spec.id)}
                        className="w-full p-4 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 transition-all text-left"
                      >
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-xs font-mono bg-zinc-800 px-2 py-0.5 rounded text-amber-400">{spec.code}</span>
                          <EvidenceIcon className={`w-3.5 h-3.5 ${evidenceCfg.color}`} />
                          <span className={`text-xs ${evidenceCfg.color}`}>
                            {evidenceCfg.labelEn} | <span dir="rtl">{evidenceCfg.labelAr}</span>
                          </span>
                          <span className="flex-1" />
                          <span className={`text-xs font-bold ${statusTextColor}`}>{statusText}</span>
                        </div>

                        <p className="text-sm text-zinc-200 line-clamp-1">{spec.requirement}</p>
                        <p className="text-base text-zinc-200 line-clamp-1 mt-0.5" dir="rtl">{spec.requirementAr}</p>

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
              </>
            )}
          </section>
        )}
      </main>

      {/* Bottom Buttons - Only show in Step 3 */}
      {currentStep === 3 && inspection && (
        <div className="border-t border-zinc-800 p-4 space-y-3 bg-zinc-900/50">
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
            Download PDF <span dir="rtl">تحميل</span>
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
      )}

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

      {/* Footer - Only show in Step 1 and 2 */}
      {currentStep < 3 && (
        <footer className="border-t border-zinc-800 p-4 text-center text-xs text-zinc-600 flex items-center justify-center gap-2">
          <Shield className="w-3 h-3" />
          <span>Saqr v{VERSION}</span>
          <span className="w-1 h-1 rounded-full bg-zinc-600" />
          <span>saqr.ai</span>
        </footer>
      )}
    </div>
  );
}

export default function InspectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    }>
      <InspectContent />
    </Suspense>
  );
}
