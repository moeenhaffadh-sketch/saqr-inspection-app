// SAQR Field Inspector v1.0.0 - Manual Spec-by-Spec
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
  ChevronLeft,
  Download,
  Camera,
  Upload,
  ScanLine,
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { generateInspectionPDF } from "@/lib/utils/generatePDF";

const VERSION = "1.0.0";

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

interface EvidenceCapture {
  id: string;
  image: string;
  thumbnail: string;
  timestamp: string;
  result: "PASS" | "FAIL" | "NEEDS_REVIEW";
  confidence: number;
  finding: string;
  findingAr: string;
  severity: string;
}

const GCC_COUNTRIES = [
  { code: "BH", name: "Bahrain", nameAr: "البحرين", flag: "🇧🇭" },
  { code: "SA", name: "Saudi Arabia", nameAr: "السعودية", flag: "🇸🇦" },
  { code: "AE", name: "UAE", nameAr: "الإمارات", flag: "🇦🇪" },
  { code: "QA", name: "Qatar", nameAr: "قطر", flag: "🇶🇦" },
  { code: "KW", name: "Kuwait", nameAr: "الكويت", flag: "🇰🇼" },
  { code: "OM", name: "Oman", nameAr: "عمان", flag: "🇴🇲" },
];

const authorityColors: Record<string, string> = {
  MOH: "bg-blue-500",
  MOIC: "bg-purple-500",
  GDCD: "bg-red-500",
  MUN: "bg-green-500",
  NHRA: "bg-amber-500",
};

const DOC_KEYWORDS = [
  "license", "licence", "certificate", "permit", "record", "log",
  "contract", "insurance", "training", "document", "registration",
  "رخصة", "شهادة", "تصريح", "سجل", "عقد", "تأمين", "تدريب", "وثيقة",
];

function isDocumentSpec(spec: { requirement: string }): boolean {
  const textLower = spec.requirement.toLowerCase();
  return DOC_KEYWORDS.some((kw) => textLower.includes(kw));
}

function createThumbnail(base64Image: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 88;
      const scale = Math.min(size / img.width, size / img.height);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      } else {
        resolve(base64Image);
      }
    };
    img.src = base64Image;
  });
}

function InspectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const countryFromUrl = searchParams.get("country");
  const authorityFromUrl = searchParams.get("authority");
  const inspectionFromUrl = searchParams.get("inspection");

  // Flow state - Steps 1, 2, 3
  const [selectedCountry, setSelectedCountry] = useState<string>("BH");
  const [selectedAuthority, setSelectedAuthority] = useState<string | null>(null);
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Step 4: Camera mode
  const [cameraSpecIndex, setCameraSpecIndex] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [documentScanMode, setDocumentScanMode] = useState(false);

  // Evidence storage per spec (in-memory for session)
  const [specEvidence, setSpecEvidence] = useState<Map<string, EvidenceCapture[]>>(new Map());

  // Photo viewer
  const [viewingPhoto, setViewingPhoto] = useState<{ specId: string; photoIndex: number } | null>(null);

  // PDF generation
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showForceComplete, setShowForceComplete] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);

  // Initialize country from URL or localStorage
  useEffect(() => {
    let country = "BH";
    if (countryFromUrl && GCC_COUNTRIES.some((c) => c.code === countryFromUrl)) {
      country = countryFromUrl;
      localStorage.setItem("saqr_selected_country", countryFromUrl);
    } else {
      const saved = localStorage.getItem("saqr_selected_country");
      if (saved && GCC_COUNTRIES.some((c) => c.code === saved)) {
        country = saved;
      }
    }
    setSelectedCountry(country);
    setIsReady(true);
  }, [countryFromUrl]);

  useEffect(() => {
    if (authorityFromUrl && isReady) setSelectedAuthority(authorityFromUrl);
  }, [authorityFromUrl, isReady]);

  useEffect(() => {
    if (inspectionFromUrl && isReady) setInspectionId(inspectionFromUrl);
  }, [inspectionFromUrl, isReady]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Fetch data
  const { data: authorities, isLoading: loadingAuthorities } = trpc.authority.getByCountry.useQuery(
    { countryCode: selectedCountry },
    { enabled: isReady && !!selectedCountry }
  );

  const { data: categories, isLoading: loadingCategories } = trpc.inspectionCategory.getByAuthority.useQuery(
    { authorityId: selectedAuthority! },
    { enabled: !!selectedAuthority }
  );

  const {
    data: inspection,
    isLoading: loadingInspection,
    refetch: refetchInspection,
  } = trpc.inspection.getById.useQuery({ id: inspectionId! }, { enabled: !!inspectionId });

  // Mutations
  const createInspection = trpc.inspection.create.useMutation();
  const saveResult = trpc.inspection.saveResult.useMutation({
    onSuccess: () => refetchInspection(),
  });
  const completeInspection = trpc.inspection.complete.useMutation({
    onSuccess: () => router.push(`/inspections/${inspectionId}/results`),
  });

  // Build specs list
  const specs: SpecWithResult[] =
    inspection?.category?.specs.map((spec) => ({
      ...spec,
      result: inspection.results.find((r) => r.specId === spec.id),
    })) || [];

  // ==================== CAMERA FUNCTIONS ====================

  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      setCameraReady(true);
      setCameraError(null);
      return;
    }

    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
        },
        audio: false,
      });

      if (!isMountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (err: unknown) {
      const error = err as Error & { name?: string };
      console.error("[Camera] Error:", error.name, error.message);

      if (error.name === "AbortError") return;

      if (error.name === "NotAllowedError") {
        setCameraError("Camera permission denied. Please allow camera access in your browser settings.");
      } else if (error.name === "NotFoundError") {
        setCameraError("No camera found on this device.");
      } else if (error.name === "NotReadableError") {
        setCameraError("Camera is in use by another application.");
      } else {
        // Try fallback
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          if (!isMountedRef.current) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setCameraReady(true);
          }
        } catch (err2: unknown) {
          const error2 = err2 as Error & { name?: string };
          if (error2.name === "NotAllowedError") {
            setCameraError("Camera permission denied.");
          } else {
            setCameraError(`Camera error: ${error2.message || "Unknown"}`);
          }
        }
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  // ==================== CAPTURE & ANALYSIS ====================

  const captureFrame = useCallback((highRes: boolean = false): string | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", highRes ? 0.95 : 0.85);
  }, []);

  const analyzeImage = useCallback(async (
    imageBase64: string,
    spec: SpecWithResult
  ): Promise<{
    result: "PASS" | "FAIL" | "NEEDS_REVIEW";
    confidence: number;
    finding: string;
    findingAr: string;
    severity: string;
  }> => {
    try {
      const isDoc = isDocumentSpec(spec);
      const endpoint = isDoc ? "/api/ai/analyze-doc" : "/api/ai/analyze-spec";
      const imageData = imageBase64.replace(/^data:image\/\w+;base64,/, "");

      const body = isDoc
        ? { image: imageData, specs: [{ id: spec.id, code: spec.code, text: spec.requirement }] }
        : { image: imageData, specs: [{ code: spec.code, text: spec.requirement }] };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();

      if (isDoc) {
        const specResult = data.specResults?.[0];
        return {
          result: specResult?.result || "NEEDS_REVIEW",
          confidence: specResult?.confidence || 50,
          finding: specResult?.finding || data.extractedText || "Document analyzed",
          findingAr: specResult?.findingAr || "تم تحليل الوثيقة",
          severity: specResult?.severity || "OK",
        };
      } else {
        const specResult = data.results?.[0];
        return {
          result: specResult?.result || "NEEDS_REVIEW",
          confidence: specResult?.confidence || 50,
          finding: specResult?.finding || "Analysis complete",
          findingAr: specResult?.findingAr || "تم التحليل",
          severity: specResult?.severity || "OK",
        };
      }
    } catch (err) {
      console.error("[Analyze] Error:", err);
      return {
        result: "NEEDS_REVIEW",
        confidence: 0,
        finding: "Analysis failed - please retake",
        findingAr: "فشل التحليل - يرجى إعادة الالتقاط",
        severity: "OK",
      };
    }
  }, []);

  const handleCapture = useCallback(async () => {
    if (!cameraReady || isAnalyzing || cameraSpecIndex === null) return;

    const spec = specs[cameraSpecIndex];
    if (!spec) return;

    // Flash effect
    const flashEl = document.getElementById("capture-flash");
    if (flashEl) {
      flashEl.style.opacity = "1";
      setTimeout(() => { flashEl.style.opacity = "0"; }, 100);
    }

    // Vibrate
    if (navigator.vibrate) navigator.vibrate(50);

    const imageBase64 = captureFrame(documentScanMode);
    if (!imageBase64) return;

    setIsAnalyzing(true);

    const thumbnail = await createThumbnail(imageBase64);
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
    const captureId = `${spec.id}-${Date.now()}`;

    // Add placeholder evidence
    setSpecEvidence((prev) => {
      const next = new Map(prev);
      const existing = next.get(spec.id) || [];
      next.set(spec.id, [...existing, {
        id: captureId,
        image: imageBase64,
        thumbnail,
        timestamp,
        result: "NEEDS_REVIEW",
        confidence: 0,
        finding: "Analyzing...",
        findingAr: "جارٍ التحليل...",
        severity: "OK",
      }]);
      return next;
    });

    // Analyze
    const analysis = await analyzeImage(imageBase64, spec);

    // Update with analysis result
    setSpecEvidence((prev) => {
      const next = new Map(prev);
      const existing = next.get(spec.id) || [];
      next.set(spec.id, existing.map((e) =>
        e.id === captureId
          ? { ...e, ...analysis }
          : e
      ));
      return next;
    });

    // Auto-save to database
    if (inspectionId) {
      const status = analysis.result === "PASS" ? "PASS" :
                     analysis.result === "FAIL" ? "FAIL" : "UNCERTAIN";
      try {
        await saveResult.mutateAsync({
          inspectionId,
          specId: spec.id,
          status,
          photoUrl: imageBase64,
          aiAnalyzed: true,
          aiConfidence: analysis.confidence / 100,
          aiReasoning: analysis.finding,
          aiReasoningAr: analysis.findingAr,
        });
      } catch (err) {
        console.error("[Save] Error:", err);
      }
    }

    setIsAnalyzing(false);
    setDocumentScanMode(false);
  }, [cameraReady, isAnalyzing, cameraSpecIndex, specs, captureFrame, documentScanMode, analyzeImage, inspectionId, saveResult]);

  // File upload handler
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || cameraSpecIndex === null) return;

    const spec = specs[cameraSpecIndex];
    if (!spec) return;

    setIsAnalyzing(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const thumbnail = await createThumbnail(base64);
      const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
      const captureId = `${spec.id}-${Date.now()}`;

      setSpecEvidence((prev) => {
        const next = new Map(prev);
        const existing = next.get(spec.id) || [];
        next.set(spec.id, [...existing, {
          id: captureId,
          image: base64,
          thumbnail,
          timestamp,
          result: "NEEDS_REVIEW",
          confidence: 0,
          finding: "Analyzing...",
          findingAr: "جارٍ التحليل...",
          severity: "OK",
        }]);
        return next;
      });

      const analysis = await analyzeImage(base64, spec);

      setSpecEvidence((prev) => {
        const next = new Map(prev);
        const existing = next.get(spec.id) || [];
        next.set(spec.id, existing.map((e) =>
          e.id === captureId ? { ...e, ...analysis } : e
        ));
        return next;
      });

      if (inspectionId) {
        const status = analysis.result === "PASS" ? "PASS" :
                       analysis.result === "FAIL" ? "FAIL" : "UNCERTAIN";
        try {
          await saveResult.mutateAsync({
            inspectionId,
            specId: spec.id,
            status,
            photoUrl: base64,
            aiAnalyzed: true,
            aiConfidence: analysis.confidence / 100,
            aiReasoning: analysis.finding,
            aiReasoningAr: analysis.findingAr,
          });
        } catch (err) {
          console.error("[Save] Error:", err);
        }
      }

      setIsAnalyzing(false);
    };

    reader.readAsDataURL(file);
    e.target.value = "";
  }, [cameraSpecIndex, specs, analyzeImage, inspectionId, saveResult]);

  // ==================== NAVIGATION ====================

  const handleAuthoritySelect = (id: string) => {
    setSelectedAuthority(id);
  };

  const handleCategorySelect = async (categoryId: string) => {
    setIsStarting(true);
    try {
      const newInspection = await createInspection.mutateAsync({ categoryId });
      setInspectionId(newInspection.id);
    } catch (error) {
      console.error("[Nav] Failed to create inspection:", error);
    } finally {
      setIsStarting(false);
    }
  };

  const selectedCountryData = GCC_COUNTRIES.find((c) => c.code === selectedCountry);
  const selectedAuthorityData = authorities?.find((a) => a.id === selectedAuthority);
  const currentStep = !selectedAuthority ? 1 : !inspectionId ? 2 : 3;

  const handleBack = () => {
    if (currentStep === 3) setInspectionId(null);
    else if (currentStep === 2) setSelectedAuthority(null);
    else router.push("/");
  };

  const goToStep1 = () => {
    setInspectionId(null);
    setSelectedAuthority(null);
  };

  const goToStep2 = () => setInspectionId(null);

  // Open camera for a spec (Step 4)
  const openCameraForSpec = useCallback((specIndex: number) => {
    setCameraSpecIndex(specIndex);
    setCameraError(null);
    setDocumentScanMode(false);
    // Start camera from user gesture
    startCamera();
  }, [startCamera]);

  // Close camera and return to spec list (Step 3)
  const closeCameraView = useCallback(() => {
    stopCamera();
    setCameraSpecIndex(null);
    setDocumentScanMode(false);
  }, [stopCamera]);

  // Navigate to prev spec (stay in camera)
  const goToPrevSpec = useCallback(() => {
    if (cameraSpecIndex !== null && cameraSpecIndex > 0) {
      setCameraSpecIndex(cameraSpecIndex - 1);
    }
  }, [cameraSpecIndex]);

  // Navigate to next spec (stay in camera)
  const goToNextSpec = useCallback(() => {
    if (cameraSpecIndex !== null && cameraSpecIndex < specs.length - 1) {
      setCameraSpecIndex(cameraSpecIndex + 1);
    }
  }, [cameraSpecIndex, specs.length]);

  // Delete a photo
  const deletePhoto = useCallback((specId: string, photoIndex: number) => {
    setSpecEvidence((prev) => {
      const next = new Map(prev);
      const existing = next.get(specId) || [];
      const newEvidence = [...existing];
      newEvidence.splice(photoIndex, 1);
      next.set(specId, newEvidence);
      return next;
    });
    setViewingPhoto(null);
  }, []);

  // Stats
  const passCount = specs.filter((s) => s.result?.status === "PASS").length;
  const failCount = specs.filter((s) => s.result?.status === "FAIL").length;
  const pendingCount = specs.filter((s) => !s.result?.status || s.result.status === "SKIPPED").length;
  const totalCount = specs.length;
  const completionPercent = totalCount > 0 ? Math.round(((passCount + failCount) / totalCount) * 100) : 0;

  const handleComplete = () => {
    if (!inspectionId) return;
    if (pendingCount > 0) setShowForceComplete(true);
    else completeInspection.mutate({ id: inspectionId });
  };

  const handleForceComplete = () => {
    if (inspectionId) completeInspection.mutate({ id: inspectionId });
  };

  const handleDownloadPDF = async () => {
    if (!inspection) return;
    setIsGeneratingPDF(true);
    try {
      await generateInspectionPDF({
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
        site: inspection.site ? { name: inspection.site.name, nameAr: inspection.site.nameAr, address: inspection.site.address } : null,
        organization: inspection.organization ? { name: inspection.organization.name, nameAr: inspection.organization.nameAr } : null,
        results: specs.map((spec) => ({
          id: spec.id,
          status: spec.result?.status === "SKIPPED" ? null : (spec.result?.status as "PASS" | "FAIL" | "UNCERTAIN" | null),
          notes: spec.result?.notes || null,
          photoUrl: spec.result?.photoUrl || null,
          aiAnalyzed: spec.result?.aiAnalyzed || false,
          aiConfidence: spec.result?.aiConfidence || null,
          aiReasoning: spec.result?.aiReasoning || null,
          aiReasoningAr: spec.result?.aiReasoningAr || null,
          spec: { code: spec.code, requirement: spec.requirement, requirementAr: spec.requirementAr },
        })),
      });
    } catch (err) {
      console.error("PDF error:", err);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // ==================== RENDER ====================

  if (!isReady) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  const authorityCode = inspection?.category?.authority?.code || "";
  const authorityColor = authorityCode ? authorityColors[authorityCode] || "bg-zinc-600" : "bg-zinc-600";

  // ==================== STEP 4: CAMERA VIEW ====================
  if (cameraSpecIndex !== null && specs[cameraSpecIndex]) {
    const spec = specs[cameraSpecIndex];
    const evidence = specEvidence.get(spec.id) || [];
    const isDoc = isDocumentSpec(spec);

    return (
      <div className="fixed inset-0 flex flex-col bg-black">
        {/* Flash overlay */}
        <div
          id="capture-flash"
          className="fixed inset-0 pointer-events-none z-50 transition-opacity duration-100"
          style={{ backgroundColor: "white", opacity: 0 }}
        />

        {/* Top bar */}
        <header className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900">
          <button onClick={goToPrevSpec} disabled={cameraSpecIndex === 0} className="flex items-center gap-1 text-zinc-400 disabled:opacity-30">
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">Prev</span>
          </button>
          <div className="text-center">
            <span className="font-mono font-bold text-amber-400">{spec.code}</span>
            <span className="text-sm text-zinc-500 ml-2">({cameraSpecIndex + 1}/{specs.length})</span>
          </div>
          <button onClick={goToNextSpec} disabled={cameraSpecIndex >= specs.length - 1} className="flex items-center gap-1 text-zinc-400 disabled:opacity-30">
            <span className="text-sm">Next</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </header>

        {/* Camera view */}
        <div className="relative flex-1" style={{ minHeight: "45vh" }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Document scan overlay */}
          {documentScanMode && cameraReady && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="rounded-lg"
                style={{
                  width: "85%",
                  height: "60%",
                  border: "3px dashed #c8a84e",
                  backgroundColor: "rgba(200,168,78,0.1)",
                }}
              />
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <p className="text-amber-400">Align document in frame</p>
                <p className="text-zinc-500" dir="rtl">ضع الوثيقة في الإطار</p>
              </div>
            </div>
          )}

          {/* Loading or error state */}
          {!cameraReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              {cameraError ? (
                <div className="text-center p-6 max-w-sm">
                  <div className="relative inline-block mb-4">
                    <Camera className="w-16 h-16 text-zinc-600" />
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                      <X className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <h3 className="font-bold text-lg text-white mb-2">Camera access required</h3>
                  <p className="text-lg text-zinc-400 mb-3" dir="rtl">مطلوب الوصول للكاميرا</p>
                  <p className="text-sm text-zinc-500 mb-4">{cameraError}</p>
                  <button
                    onClick={() => { setCameraError(null); startCamera(); }}
                    className="px-6 py-3 rounded-xl font-bold bg-amber-500 text-black"
                  >
                    Try Again | حاول مرة أخرى
                  </button>
                </div>
              ) : (
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              )}
            </div>
          )}
        </div>

        {/* Spec info */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-900">
          <p className="text-sm text-white mb-1">{spec.requirement}</p>
          <p className="text-sm text-zinc-500" dir="rtl">{spec.requirementAr}</p>

          {/* Evidence thumbnails */}
          {evidence.length > 0 && (
            <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
              {evidence.map((e, i) => (
                <button
                  key={e.id}
                  onClick={() => setViewingPhoto({ specId: spec.id, photoIndex: i })}
                  className="w-11 h-11 rounded-lg overflow-hidden shrink-0 relative"
                  style={{
                    border: `2px solid ${e.result === "PASS" ? "#22c55e" : e.result === "FAIL" ? "#ef4444" : "#eab308"}`,
                  }}
                >
                  <img src={e.thumbnail} alt="" className="w-full h-full object-cover" />
                  {e.confidence === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    </div>
                  )}
                </button>
              ))}
              <span className="text-xs text-zinc-500 whitespace-nowrap">{evidence.length} captured</span>
            </div>
          )}
        </div>

        {/* Capture controls */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900">
          <div className="flex items-center justify-between mb-4">
            {/* Upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-1 px-4 py-2 text-zinc-400"
            >
              <Upload className="w-5 h-5" />
              <span className="text-xs">Upload</span>
            </button>

            {/* Capture */}
            <button
              onClick={handleCapture}
              disabled={!cameraReady || isAnalyzing}
              className="rounded-full flex items-center justify-center disabled:opacity-50"
              style={{
                width: 72,
                height: 72,
                border: "4px solid #c8a84e",
                backgroundColor: isAnalyzing ? "transparent" : "white",
              }}
            >
              {isAnalyzing ? (
                <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
              ) : (
                <Camera className="w-6 h-6 text-black" />
              )}
            </button>

            {/* Document scan */}
            {isDoc ? (
              <button
                onClick={() => setDocumentScanMode(!documentScanMode)}
                className={`flex flex-col items-center gap-1 px-4 py-2 ${documentScanMode ? "text-amber-400" : "text-zinc-400"}`}
              >
                <ScanLine className="w-5 h-5" />
                <span className="text-xs">Scan Doc</span>
              </button>
            ) : (
              <div style={{ width: 70 }} />
            )}
          </div>

          {/* Back to list */}
          <button
            onClick={closeCameraView}
            className="w-full py-3 rounded-xl bg-zinc-800 text-white font-medium flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to List | العودة للقائمة
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
    );
  }

  // ==================== PHOTO VIEWER ====================
  if (viewingPhoto) {
    const spec = specs.find((s) => s.id === viewingPhoto.specId);
    const evidence = specEvidence.get(viewingPhoto.specId) || [];
    const photo = evidence[viewingPhoto.photoIndex];

    if (!spec || !photo) {
      setViewingPhoto(null);
      return null;
    }

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
        <header className="flex items-center justify-between p-4">
          <button onClick={() => setViewingPhoto(null)} className="text-white">
            <X className="w-6 h-6" />
          </button>
          <div className="text-center">
            <span className="font-mono text-amber-400">{spec.code}</span>
            <span className="text-zinc-500 ml-2">{viewingPhoto.photoIndex + 1}/{evidence.length}</span>
          </div>
          <div style={{ width: 24 }} />
        </header>

        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
          <img src={photo.image} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>

        <div className="p-4 space-y-3">
          <div className="bg-zinc-900 rounded-lg p-3">
            <p className="text-sm text-amber-400 font-medium mb-1">AI Comment:</p>
            <p className="text-sm text-white">{photo.finding}</p>
            {photo.findingAr && <p className="text-sm text-zinc-400 mt-1" dir="rtl">{photo.findingAr}</p>}
          </div>

          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <span>
              Result: <span className={photo.result === "PASS" ? "text-green-400" : photo.result === "FAIL" ? "text-red-400" : "text-yellow-400"}>
                {photo.result}
              </span>
            </span>
            <span>Confidence: {photo.confidence}%</span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setViewingPhoto({ ...viewingPhoto, photoIndex: Math.max(0, viewingPhoto.photoIndex - 1) })}
              disabled={viewingPhoto.photoIndex === 0}
              className="px-4 py-2 rounded-lg border border-zinc-700 text-white disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5 inline" /> Prev
            </button>

            <button
              onClick={() => {
                if (window.confirm("Delete this photo?")) {
                  deletePhoto(viewingPhoto.specId, viewingPhoto.photoIndex);
                }
              }}
              className="px-4 py-2 rounded-lg border border-red-500 text-red-500"
            >
              <Trash2 className="w-4 h-4 inline mr-1" /> Delete
            </button>

            <button
              onClick={() => setViewingPhoto({ ...viewingPhoto, photoIndex: Math.min(evidence.length - 1, viewingPhoto.photoIndex + 1) })}
              disabled={viewingPhoto.photoIndex >= evidence.length - 1}
              className="px-4 py-2 rounded-lg border border-zinc-700 text-white disabled:opacity-30"
            >
              Next <ChevronRight className="w-5 h-5 inline" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== MAIN 3-STEP VIEW ====================
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="text-zinc-400 hover:text-white p-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Link href="/" className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">Saqr</span>
              <Image src="/landing-falcon.png" alt="Saqr" width={36} height={36} priority unoptimized />
              <span className="text-xl font-bold">صقر</span>
            </div>
            <p className="text-xs text-zinc-500">Field Inspector v{VERSION}</p>
          </Link>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700">
          <span className="text-lg">{selectedCountryData?.flag}</span>
          <span className="text-sm font-medium">{selectedCountryData?.name}</span>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="border-b border-zinc-800 px-4 py-3 bg-zinc-900/50">
        <div className="flex items-center gap-2 text-sm overflow-x-auto">
          <button
            onClick={goToStep1}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap ${currentStep === 1 ? "bg-amber-500 text-black" : "bg-amber-500/20 text-amber-400"}`}
          >
            1. Authority | الجهة
          </button>
          <ChevronRight className="w-4 h-4 text-zinc-600" />
          <button
            onClick={currentStep >= 2 ? goToStep2 : undefined}
            disabled={currentStep < 2}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap ${
              currentStep === 2 ? "bg-amber-500 text-black" : currentStep > 2 ? "bg-amber-500/20 text-amber-400" : "bg-zinc-800 text-zinc-500"
            }`}
          >
            2. Category | الفئة
          </button>
          <ChevronRight className="w-4 h-4 text-zinc-600" />
          <span className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap ${currentStep === 3 ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-500"}`}>
            3. Specs | المواصفات
          </span>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        {/* Step 1: Authority */}
        {currentStep === 1 && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-center">Select Authority | اختر الجهة</h2>
            {loadingAuthorities ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {authorities?.map((auth) => (
                  <button
                    key={auth.id}
                    onClick={() => handleAuthoritySelect(auth.id)}
                    className="p-5 rounded-xl border-2 border-zinc-800 hover:border-amber-500 bg-zinc-900/50 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-xl ${authorityColors[auth.code] || "bg-zinc-600"} flex items-center justify-center`}>
                        <Building2 className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="text-lg font-bold">{auth.code}</div>
                        <div className="text-sm text-zinc-400">{auth.name}</div>
                        <div className="text-zinc-400" dir="rtl">{auth.nameAr}</div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-600" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Step 2: Category */}
        {currentStep === 2 && (
          <section className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-4">
              <div className={`w-10 h-10 rounded-lg ${authorityColors[selectedAuthorityData?.code || ""] || "bg-zinc-600"} flex items-center justify-center`}>
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div className="font-bold text-amber-400">
                {selectedAuthorityData?.code} | <span dir="rtl">{selectedAuthorityData?.nameAr}</span>
              </div>
            </div>
            <h2 className="text-xl font-bold text-center">Select Category | اختر الفئة</h2>
            {loadingCategories || isStarting ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
            ) : (
              <div className="space-y-3">
                {categories?.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat.id)}
                    className="w-full p-5 rounded-xl border-2 border-zinc-800 hover:border-amber-500 bg-zinc-900/50 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: cat.color + "30" }}>
                        <ClipboardList className="w-7 h-7" style={{ color: cat.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="text-lg font-bold">{cat.name}</div>
                        <div className="text-zinc-400" dir="rtl">{cat.nameAr}</div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-600" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Step 3: Specs Dashboard */}
        {currentStep === 3 && (
          <section className="space-y-4 -mx-4 -mt-4">
            {loadingInspection ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
            ) : !inspection ? (
              <div className="text-center py-12 text-zinc-500">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Inspection not found | <span dir="rtl">لم يتم العثور على الفحص</span></p>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div className="border-b border-zinc-800 p-4 bg-zinc-900/50">
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${authorityColor}`}>
                      <Building2 className="w-4 h-4 text-white" />
                      <span className="text-white font-bold text-sm">{authorityCode}</span>
                    </div>
                    <span className="text-zinc-400 text-xs">|</span>
                    <span className="text-zinc-300 text-sm" dir="rtl">{inspection.category.authority.nameAr}</span>
                    <ChevronRight className="w-4 h-4 text-zinc-600" />
                    <span className="text-white text-sm">{inspection.category.name}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="relative w-20 h-20">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="text-zinc-800" />
                        <circle
                          cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="none"
                          strokeDasharray={`${(completionPercent / 100) * 251} 251`}
                          strokeLinecap="round"
                          className={completionPercent === 100 ? "text-green-500" : completionPercent >= 50 ? "text-amber-500" : "text-red-500"}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-lg font-bold">{completionPercent}%</span>
                      </div>
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div className="bg-zinc-800 rounded-lg p-2 text-center">
                        <div className="text-lg font-bold text-green-400">{passCount}</div>
                        <div className="text-[10px] text-green-400">Pass | ناجح</div>
                      </div>
                      <div className="bg-zinc-800 rounded-lg p-2 text-center">
                        <div className="text-lg font-bold text-red-400">{failCount}</div>
                        <div className="text-[10px] text-red-400">Fail | راسب</div>
                      </div>
                      <div className="bg-zinc-800 rounded-lg p-2 text-center">
                        <div className="text-lg font-bold text-yellow-400">{pendingCount}</div>
                        <div className="text-[10px] text-yellow-400">Pending | معلّق</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Specs List */}
                <div className="p-4 space-y-2">
                  {specs.map((spec, index) => {
                    const status = spec.result?.status;
                    const isPending = !status || status === "SKIPPED";
                    const evidence = specEvidence.get(spec.id) || [];
                    const dbPhoto = spec.result?.photoUrl;

                    return (
                      <div
                        key={spec.id}
                        className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden"
                        style={{
                          borderLeftWidth: 3,
                          borderLeftColor: isPending ? "#475569" : status === "PASS" ? "#22c55e" : "#ef4444",
                        }}
                      >
                        <button
                          onClick={() => openCameraForSpec(index)}
                          className="w-full p-4 text-left hover:bg-zinc-800/50"
                        >
                          <div className="flex items-start gap-3">
                            {/* Status/thumbnail */}
                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${
                              isPending ? "bg-zinc-800" : status === "PASS" ? "bg-green-500/20" : "bg-red-500/20"
                            }`}>
                              {dbPhoto ? (
                                <img src={dbPhoto} alt="" className="w-full h-full object-cover" />
                              ) : isPending ? (
                                <Camera className="w-6 h-6 text-zinc-500" />
                              ) : status === "PASS" ? (
                                <CheckCircle className="w-7 h-7 text-green-500" />
                              ) : (
                                <XCircle className="w-7 h-7 text-red-500" />
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="text-xs font-mono bg-zinc-800 px-2 py-0.5 rounded text-amber-400">{spec.code}</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                  isPending ? "bg-yellow-500/20 text-yellow-400" :
                                  status === "PASS" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                }`}>
                                  {isPending ? "Tap to inspect" : status === "PASS" ? "Pass" : "Fail"}
                                </span>
                              </div>
                              <p className="text-sm text-white leading-relaxed">{spec.requirement}</p>
                              <p className="text-sm text-zinc-400 mt-1" dir="rtl">{spec.requirementAr}</p>

                              {/* Evidence thumbnails */}
                              {evidence.length > 0 && (
                                <div className="flex items-center gap-2 mt-3 overflow-x-auto">
                                  {evidence.map((e, i) => (
                                    <button
                                      key={e.id}
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        setViewingPhoto({ specId: spec.id, photoIndex: i });
                                      }}
                                      className="w-10 h-10 rounded-lg overflow-hidden shrink-0"
                                      style={{
                                        border: `2px solid ${e.result === "PASS" ? "#22c55e" : e.result === "FAIL" ? "#ef4444" : "#eab308"}`,
                                      }}
                                    >
                                      <img src={e.thumbnail} alt="" className="w-full h-full object-cover" />
                                    </button>
                                  ))}
                                  <span className="text-xs text-zinc-500">{evidence.length} photos</span>
                                </div>
                              )}

                              {/* AI Finding */}
                              {spec.result?.aiReasoning && (
                                <p className="text-xs text-zinc-500 mt-2 line-clamp-1">{spec.result.aiReasoning}</p>
                              )}
                            </div>

                            <ChevronRight className="w-5 h-5 text-zinc-600 shrink-0" />
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}
      </main>

      {/* Bottom Buttons - Step 3 only */}
      {currentStep === 3 && inspection && (
        <div className="border-t border-zinc-800 p-4 space-y-3 bg-zinc-900/50">
          <button onClick={handleDownloadPDF} disabled={isGeneratingPDF} className="w-full bg-zinc-800 text-white py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF | تحميل
          </button>
          {pendingCount > 0 ? (
            <button onClick={handleComplete} className="w-full bg-amber-500 text-black py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Complete with {pendingCount} pending | إكمال مع {pendingCount} معلّق
            </button>
          ) : (
            <button onClick={handleComplete} disabled={completeInspection.isPending} className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50">
              {completeInspection.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
              All Complete | اكتمل الفحص
            </button>
          )}
        </div>
      )}

      {/* Footer */}
      {currentStep < 3 && (
        <footer className="border-t border-zinc-800 p-4 text-center text-xs text-zinc-600 flex items-center justify-center gap-2">
          <Shield className="w-3 h-3" />
          <span>Saqr v{VERSION}</span>
        </footer>
      )}

      {/* Force Complete Modal */}
      {showForceComplete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full border border-zinc-700">
            <div className="text-center mb-4">
              <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
              <h3 className="text-lg font-bold">Complete Inspection? | <span dir="rtl">إتمام الفحص؟</span></h3>
              <p className="text-sm text-zinc-400 mt-2">{pendingCount} items still pending | <span dir="rtl">{pendingCount} عناصر لا تزال معلقة</span></p>
            </div>
            <div className="space-y-3">
              <button onClick={handleForceComplete} disabled={completeInspection.isPending} className="w-full bg-amber-500 text-black py-3 rounded-lg font-medium disabled:opacity-50">
                {completeInspection.isPending ? "Completing..." : "Complete Anyway | إكمال على أي حال"}
              </button>
              <button onClick={() => setShowForceComplete(false)} className="w-full bg-zinc-800 text-zinc-400 py-3 rounded-lg">Cancel | إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InspectPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>}>
      <InspectContent />
    </Suspense>
  );
}
