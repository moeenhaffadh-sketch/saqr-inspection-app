// SAQR Inspector v1.0.0 - Manual Spec-by-Spec Inspection
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Shield,
  ArrowLeft,
  ArrowRight,
  Camera,
  Upload,
  ScanLine,
  X,
  Circle,
  CircleDot,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Trash2,
  FileText,
  Image as ImageIcon,
} from "lucide-react";

// ==================== TYPES ====================

interface SpecInput {
  id: string;
  code: string;
  text: string;
  textAr?: string;
  category?: string;
}

interface EvidencePhoto {
  id: string;
  image: string;
  thumbnail: string;
  timestamp: string;
  aiComment: string;
  aiCommentAr: string;
  result: "PASS" | "FAIL" | "NEEDS_REVIEW";
  confidence: number;
  severity: "OK" | "MINOR" | "MAJOR" | "CRITICAL";
  imageQuality: "clear" | "blurry" | "dark" | "obstructed";
}

interface SpecInspectionResult {
  specCode: string;
  specText: string;
  specTextAr?: string;
  status: "not_started" | "in_progress" | "pass" | "fail" | "needs_review";
  evidence: EvidencePhoto[];
  overallFinding: string;
  overallFindingAr: string;
  overallSeverity: "OK" | "MINOR" | "MAJOR" | "CRITICAL";
  requiredCount: number;
  inspectedCount: number;
}

interface LayoutAnalysis {
  rooms: { name: string; nameAr: string; count: number }[];
  windows: number;
  doors: number;
  bathrooms: number;
  kitchens: number;
  exits: number;
  storageRooms: number;
  floors: number;
  ceilings: number;
  walls: number;
  totalArea?: string;
  notes?: string;
  notesAr?: string;
}

interface SaqrInspectorProps {
  specs: SpecInput[];
  authorityName: string;
  authorityNameAr: string;
  onComplete: (results: SpecInspectionResult[]) => void;
  onBack: () => void;
  lang?: "en" | "ar";
}

// ==================== CONSTANTS ====================

const DOC_KEYWORDS = [
  "license", "licence", "certificate", "permit", "record", "log",
  "contract", "insurance", "training", "document", "registration",
  "schedule", "policy", "form", "report", "receipt",
  "رخصة", "شهادة", "تصريح", "سجل", "عقد", "تأمين", "تدريب", "وثيقة", "تسجيل",
];

function isDocumentSpec(spec: { code: string; text: string }): boolean {
  const textLower = spec.text.toLowerCase();
  return DOC_KEYWORDS.some((kw) => textLower.includes(kw));
}

function getRequiredCount(spec: SpecInput, layoutData: LayoutAnalysis | null): number {
  const text = spec.text.toLowerCase();
  if (!layoutData) return 1;

  if (text.includes("window") || text.includes("نافذ")) return layoutData.windows || 1;
  if (text.includes("door") || text.includes("باب")) return layoutData.doors || 1;
  if (text.includes("bathroom") || text.includes("restroom") || text.includes("toilet") ||
      text.includes("حمام") || text.includes("دورة مياه")) return layoutData.bathrooms || 1;
  if (text.includes("kitchen") || text.includes("مطبخ")) return layoutData.kitchens || 1;
  if (text.includes("exit") || text.includes("مخرج")) return layoutData.exits || 1;
  if (text.includes("ceiling") || text.includes("سقف")) return layoutData.ceilings || 1;
  if (text.includes("floor") || text.includes("أرضية") || text.includes("أرض")) return layoutData.floors || 1;
  if (text.includes("wall") || text.includes("جدار") || text.includes("جدران")) return layoutData.walls || 1;
  if (text.includes("storage") || text.includes("تخزين") || text.includes("مخزن")) {
    return layoutData.rooms?.filter(r => r.name.toLowerCase().includes("storage")).reduce((sum, r) => sum + r.count, 0) || 1;
  }
  return 1;
}

function createThumbnail(base64Image: string, maxSize: number = 88): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(maxSize / img.width, maxSize / img.height);
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

// ==================== MAIN COMPONENT ====================

export default function SaqrInspector({
  specs,
  authorityName,
  authorityNameAr,
  onComplete,
  onBack,
  lang = "en",
}: SaqrInspectorProps) {
  // Phase state
  const [phase, setPhase] = useState<"layout_upload" | "spec_list" | "camera" | "photo_review" | "results">("layout_upload");
  const [currentSpecIndex, setCurrentSpecIndex] = useState(0);
  const [specResults, setSpecResults] = useState<Map<string, SpecInspectionResult>>(new Map());
  const [layoutData, setLayoutData] = useState<LayoutAnalysis | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<{ specId: string; photoIndex: number } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploadingLayout, setIsUploadingLayout] = useState(false);

  // Camera state
  const [documentScanMode, setDocumentScanMode] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraRequested, setCameraRequested] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const layoutInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);

  // Initialize spec results
  useEffect(() => {
    const initialResults = new Map<string, SpecInspectionResult>();
    specs.forEach((spec) => {
      initialResults.set(spec.id, {
        specCode: spec.code,
        specText: spec.text,
        specTextAr: spec.textAr,
        status: "not_started",
        evidence: [],
        overallFinding: "",
        overallFindingAr: "",
        overallSeverity: "OK",
        requiredCount: getRequiredCount(spec, layoutData),
        inspectedCount: 0,
      });
    });
    setSpecResults(initialResults);
  }, [specs, layoutData]);

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

  // ==================== CAMERA FUNCTIONS ====================

  // Start camera - MUST be called from user gesture (button click)
  const startCamera = useCallback(async () => {
    // Already have a stream
    if (streamRef.current) {
      setCameraReady(true);
      setCameraError(null);
      return;
    }

    setCameraRequested(true);
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
        setCameraError(null);
      }
    } catch (err: unknown) {
      const error = err as Error & { name?: string };
      console.error("[Camera] Error:", error.name, error.message);

      // Ignore AbortError (React StrictMode)
      if (error.name === "AbortError") {
        return;
      }

      // Handle specific error types
      if (error.name === "NotAllowedError") {
        setCameraError("Camera permission denied. Please allow camera access in your browser settings.");
      } else if (error.name === "NotFoundError") {
        setCameraError("No camera found on this device.");
      } else if (error.name === "NotReadableError") {
        setCameraError("Camera is in use by another application.");
      } else {
        // Try fallback with basic constraints
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
            setCameraError(null);
          }
        } catch (err2: unknown) {
          const error2 = err2 as Error & { name?: string };
          console.error("[Camera] Fallback failed:", error2.name, error2.message);
          if (error2.name === "NotAllowedError") {
            setCameraError("Camera permission denied. Please allow camera access in your browser settings.");
          } else if (error2.name === "NotFoundError") {
            setCameraError("No camera found on this device.");
          } else {
            setCameraError(`Camera error: ${error2.message || "Unknown error"}`);
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
    setCameraRequested(false);
  }, []);

  // Cleanup camera when leaving camera phase (but don't auto-start!)
  useEffect(() => {
    if (phase !== "camera") {
      stopCamera();
    }
  }, [phase, stopCamera]);

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
    spec: SpecInput,
    isDocument: boolean
  ): Promise<{
    result: "PASS" | "FAIL" | "NEEDS_REVIEW";
    confidence: number;
    finding: string;
    findingAr: string;
    severity: "OK" | "MINOR" | "MAJOR" | "CRITICAL";
    imageQuality: "clear" | "blurry" | "dark" | "obstructed";
  }> => {
    try {
      const endpoint = isDocument ? "/api/ai/analyze-doc" : "/api/ai/analyze-spec";
      const body = isDocument
        ? { image: imageBase64.replace(/^data:image\/\w+;base64,/, ""), specs: [{ id: spec.id, code: spec.code, text: spec.text }] }
        : { image: imageBase64.replace(/^data:image\/\w+;base64,/, ""), specs: [{ code: spec.code, text: spec.text }] };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();

      if (isDocument) {
        const specResult = data.specResults?.[0];
        return {
          result: specResult?.result || "NEEDS_REVIEW",
          confidence: specResult?.confidence || 50,
          finding: specResult?.finding || data.extractedText || "Document analyzed",
          findingAr: specResult?.findingAr || "تم تحليل الوثيقة",
          severity: specResult?.severity || "OK",
          imageQuality: data.imageQuality || "clear",
        };
      } else {
        const specResult = data.results?.[0];
        return {
          result: specResult?.result || "NEEDS_REVIEW",
          confidence: specResult?.confidence || 50,
          finding: specResult?.finding || "Analysis complete",
          findingAr: specResult?.findingAr || "تم التحليل",
          severity: specResult?.severity || "OK",
          imageQuality: specResult?.imageQuality || "clear",
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
        imageQuality: "clear",
      };
    }
  }, []);

  const handleCapture = useCallback(async () => {
    if (!cameraReady || isAnalyzing) return;

    const spec = specs[currentSpecIndex];
    if (!spec) return;

    // Flash effect
    const flashEl = document.getElementById("capture-flash");
    if (flashEl) {
      flashEl.style.opacity = "1";
      setTimeout(() => { flashEl.style.opacity = "0"; }, 100);
    }

    // Vibrate
    if (navigator.vibrate) navigator.vibrate(50);

    const isDoc = documentScanMode || isDocumentSpec(spec);
    const imageBase64 = captureFrame(isDoc);
    if (!imageBase64) return;

    setIsAnalyzing(true);

    const thumbnail = await createThumbnail(imageBase64);
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });

    // Add placeholder evidence immediately
    const placeholderId = `${spec.id}-${Date.now()}`;
    setSpecResults((prev) => {
      const next = new Map(prev);
      const existing = next.get(spec.id);
      if (existing) {
        const newEvidence: EvidencePhoto = {
          id: placeholderId,
          image: imageBase64,
          thumbnail,
          timestamp,
          aiComment: "Analyzing...",
          aiCommentAr: "جارٍ التحليل...",
          result: "NEEDS_REVIEW",
          confidence: 0,
          severity: "OK",
          imageQuality: "clear",
        };
        next.set(spec.id, {
          ...existing,
          status: "in_progress",
          evidence: [...existing.evidence, newEvidence],
          inspectedCount: existing.inspectedCount + 1,
        });
      }
      return next;
    });

    // Analyze in background
    const analysis = await analyzeImage(imageBase64, spec, isDoc);

    // Update with real analysis
    setSpecResults((prev) => {
      const next = new Map(prev);
      const existing = next.get(spec.id);
      if (existing) {
        const updatedEvidence = existing.evidence.map((e) =>
          e.id === placeholderId
            ? {
                ...e,
                aiComment: analysis.finding,
                aiCommentAr: analysis.findingAr,
                result: analysis.result,
                confidence: analysis.confidence,
                severity: analysis.severity,
                imageQuality: analysis.imageQuality,
              }
            : e
        );

        // Determine overall status from all evidence
        const hasPass = updatedEvidence.some((e) => e.result === "PASS");
        const hasFail = updatedEvidence.some((e) => e.result === "FAIL");
        const hasReview = updatedEvidence.some((e) => e.result === "NEEDS_REVIEW");

        let newStatus: SpecInspectionResult["status"] = "in_progress";
        if (hasFail) newStatus = "fail";
        else if (hasPass && !hasReview) newStatus = "pass";
        else if (hasReview) newStatus = "needs_review";

        // Get worst severity
        const severities: SpecInspectionResult["overallSeverity"][] = ["OK", "MINOR", "MAJOR", "CRITICAL"];
        const worstSeverity = updatedEvidence.reduce((worst, e) => {
          const idx = severities.indexOf(e.severity);
          const worstIdx = severities.indexOf(worst);
          return idx > worstIdx ? e.severity : worst;
        }, "OK" as SpecInspectionResult["overallSeverity"]);

        next.set(spec.id, {
          ...existing,
          status: newStatus,
          evidence: updatedEvidence,
          overallFinding: analysis.finding,
          overallFindingAr: analysis.findingAr,
          overallSeverity: worstSeverity,
        });
      }
      return next;
    });

    setIsAnalyzing(false);
    setDocumentScanMode(false);
  }, [cameraReady, isAnalyzing, specs, currentSpecIndex, documentScanMode, captureFrame, analyzeImage]);

  // ==================== FILE UPLOAD ====================

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const spec = specs[currentSpecIndex];
    if (!spec) return;

    setIsAnalyzing(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const isPdf = file.type === "application/pdf";
      const isDoc = isPdf || isDocumentSpec(spec);

      const thumbnail = isPdf
        ? "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0NCIgaGVpZ2h0PSI0NCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNjOGE4NGUiIHN0cm9rZS13aWR0aD0iMiI+PHBhdGggZD0iTTE0IDJINmEyIDIgMCAwIDAtMiAydjE2YTIgMiAwIDAgMCAyIDJoMTJhMiAyIDAgMCAwIDItMlY4eiIvPjxwb2x5bGluZSBwb2ludHM9IjE0IDIgMTQgOCAyMCA4Ii8+PC9zdmc+"
        : await createThumbnail(base64);

      const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
      const placeholderId = `${spec.id}-${Date.now()}`;

      // Add placeholder
      setSpecResults((prev) => {
        const next = new Map(prev);
        const existing = next.get(spec.id);
        if (existing) {
          const newEvidence: EvidencePhoto = {
            id: placeholderId,
            image: base64,
            thumbnail,
            timestamp,
            aiComment: "Analyzing...",
            aiCommentAr: "جارٍ التحليل...",
            result: "NEEDS_REVIEW",
            confidence: 0,
            severity: "OK",
            imageQuality: "clear",
          };
          next.set(spec.id, {
            ...existing,
            status: "in_progress",
            evidence: [...existing.evidence, newEvidence],
            inspectedCount: existing.inspectedCount + 1,
          });
        }
        return next;
      });

      // Analyze
      try {
        const endpoint = "/api/ai/analyze-doc";
        const body = isPdf
          ? { pdf: base64.replace(/^data:application\/pdf;base64,/, ""), specs: [{ id: spec.id, code: spec.code, text: spec.text }] }
          : { image: base64.replace(/^data:image\/\w+;base64,/, ""), specs: [{ id: spec.id, code: spec.code, text: spec.text }] };

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await response.json();
        const specResult = data.specResults?.[0];

        setSpecResults((prev) => {
          const next = new Map(prev);
          const existing = next.get(spec.id);
          if (existing) {
            const updatedEvidence = existing.evidence.map((e) =>
              e.id === placeholderId
                ? {
                    ...e,
                    aiComment: specResult?.finding || data.extractedText || "Document analyzed",
                    aiCommentAr: specResult?.findingAr || "تم تحليل الوثيقة",
                    result: specResult?.result || "NEEDS_REVIEW",
                    confidence: specResult?.confidence || 50,
                    severity: specResult?.severity || "OK",
                    imageQuality: data.imageQuality || "clear",
                  }
                : e
            );

            const hasFail = updatedEvidence.some((e) => e.result === "FAIL");
            const hasPass = updatedEvidence.some((e) => e.result === "PASS");
            let newStatus: SpecInspectionResult["status"] = hasFail ? "fail" : hasPass ? "pass" : "needs_review";

            next.set(spec.id, {
              ...existing,
              status: newStatus,
              evidence: updatedEvidence,
              overallFinding: specResult?.finding || "",
              overallFindingAr: specResult?.findingAr || "",
            });
          }
          return next;
        });
      } catch (err) {
        console.error("[Upload] Analysis error:", err);
      }

      setIsAnalyzing(false);
    };

    reader.readAsDataURL(file);
    e.target.value = "";
  }, [specs, currentSpecIndex]);

  // ==================== LAYOUT UPLOAD ====================

  const handleLayoutUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLayout(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/ai/analyze-layout", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(`Layout API error: ${response.status}`);

      const data = await response.json();
      setLayoutData(data);

      // Update required counts for all specs
      setSpecResults((prev) => {
        const next = new Map(prev);
        specs.forEach((spec) => {
          const existing = next.get(spec.id);
          if (existing) {
            next.set(spec.id, {
              ...existing,
              requiredCount: getRequiredCount(spec, data),
            });
          }
        });
        return next;
      });
    } catch (err) {
      console.error("[Layout] Upload error:", err);
    }

    setIsUploadingLayout(false);
    e.target.value = "";
  }, [specs]);

  const handleSkipLayout = useCallback(() => {
    setPhase("spec_list");
  }, []);

  const handleConfirmLayout = useCallback(() => {
    setPhase("spec_list");
  }, []);

  // ==================== NAVIGATION ====================

  const goToSpec = useCallback((index: number) => {
    if (index >= 0 && index < specs.length) {
      setCurrentSpecIndex(index);
    }
  }, [specs.length]);

  const goToNextSpec = useCallback(() => {
    if (currentSpecIndex < specs.length - 1) {
      setCurrentSpecIndex(currentSpecIndex + 1);
    }
  }, [currentSpecIndex, specs.length]);

  const goToPrevSpec = useCallback(() => {
    if (currentSpecIndex > 0) {
      setCurrentSpecIndex(currentSpecIndex - 1);
    }
  }, [currentSpecIndex]);

  // Open camera for spec - user gesture triggers camera request
  const openCameraForSpec = useCallback((specIndex: number) => {
    setCurrentSpecIndex(specIndex);
    setCameraError(null);
    setPhase("camera");
    // Start camera immediately from user gesture
    startCamera();
  }, [startCamera]);

  const backToSpecList = useCallback(() => {
    setPhase("spec_list");
    setDocumentScanMode(false);
  }, []);

  // ==================== PHOTO MANAGEMENT ====================

  const deletePhoto = useCallback((specId: string, photoIndex: number) => {
    setSpecResults((prev) => {
      const next = new Map(prev);
      const existing = next.get(specId);
      if (existing && existing.evidence[photoIndex]) {
        const newEvidence = [...existing.evidence];
        newEvidence.splice(photoIndex, 1);

        // Recalculate status
        const hasFail = newEvidence.some((e) => e.result === "FAIL");
        const hasPass = newEvidence.some((e) => e.result === "PASS");
        let newStatus: SpecInspectionResult["status"] = newEvidence.length === 0
          ? "not_started"
          : hasFail ? "fail" : hasPass ? "pass" : "needs_review";

        next.set(specId, {
          ...existing,
          status: newStatus,
          evidence: newEvidence,
          inspectedCount: newEvidence.length,
        });
      }
      return next;
    });
    setSelectedPhoto(null);
  }, []);

  // ==================== GENERATE REPORT ====================

  const handleGenerateReport = useCallback(() => {
    const allResults = Array.from(specResults.values());
    const incomplete = allResults.filter((r) => r.status === "not_started");

    if (incomplete.length > 0) {
      const confirm = window.confirm(
        `${incomplete.length} specs not inspected. Continue anyway?\n${incomplete.length} بند لم يتم فحصه. هل تريد المتابعة؟`
      );
      if (!confirm) return;
    }

    setPhase("results");
  }, [specResults]);

  const handleCompleteInspection = useCallback(() => {
    onComplete(Array.from(specResults.values()));
  }, [onComplete, specResults]);

  // ==================== COMPUTED VALUES ====================

  const currentSpec = specs[currentSpecIndex];
  const currentResult = currentSpec ? specResults.get(currentSpec.id) : null;

  const stats = {
    total: specs.length,
    completed: Array.from(specResults.values()).filter((r) => r.status !== "not_started").length,
    pass: Array.from(specResults.values()).filter((r) => r.status === "pass").length,
    fail: Array.from(specResults.values()).filter((r) => r.status === "fail").length,
    review: Array.from(specResults.values()).filter((r) => r.status === "needs_review").length,
  };

  // ==================== RENDER: LAYOUT UPLOAD ====================

  if (phase === "layout_upload") {
    return (
      <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: "#0a0f1a" }}>
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <button onClick={onBack} className="p-2 rounded-lg" style={{ color: "#94a3b8" }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" style={{ color: "#c8a84e" }} />
            <span className="font-bold" style={{ color: "#f1f5f9" }}>SAQR</span>
          </div>
          <div style={{ width: 36 }} />
        </header>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
          <div className="text-center">
            <FileText className="w-16 h-16 mx-auto mb-4" style={{ color: "#c8a84e" }} />
            <h2 className="text-xl font-bold mb-2" style={{ color: "#f1f5f9" }}>
              Upload Floor Plan
            </h2>
            <p className="text-lg" style={{ color: "#94a3b8" }} dir="rtl">
              رفع المخطط
            </p>
            <p className="text-sm mt-4 max-w-xs" style={{ color: "#64748b" }}>
              Upload a floor plan to automatically adjust inspection quantities for windows, doors, rooms, etc.
            </p>
          </div>

          {isUploadingLayout ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#c8a84e" }} />
              <p style={{ color: "#c8a84e" }}>SAQR is reading your floor plan...</p>
              <p style={{ color: "#94a3b8" }} dir="rtl">صقر يقرأ المخطط...</p>
            </div>
          ) : layoutData ? (
            <div className="w-full max-w-sm p-4 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <h3 className="font-bold mb-3" style={{ color: "#c8a84e" }}>Layout Detected:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm" style={{ color: "#f1f5f9" }}>
                {layoutData.windows > 0 && <div>Windows: {layoutData.windows}</div>}
                {layoutData.doors > 0 && <div>Doors: {layoutData.doors}</div>}
                {layoutData.bathrooms > 0 && <div>Bathrooms: {layoutData.bathrooms}</div>}
                {layoutData.kitchens > 0 && <div>Kitchens: {layoutData.kitchens}</div>}
                {layoutData.exits > 0 && <div>Exits: {layoutData.exits}</div>}
                {layoutData.floors > 0 && <div>Floors: {layoutData.floors}</div>}
                {layoutData.ceilings > 0 && <div>Ceilings: {layoutData.ceilings}</div>}
                {layoutData.walls > 0 && <div>Walls: {layoutData.walls}</div>}
              </div>
              <button
                onClick={handleConfirmLayout}
                className="w-full mt-4 py-3 rounded-xl font-bold"
                style={{ backgroundColor: "#c8a84e", color: "#0a0f1a" }}
              >
                Confirm | تأكيد
              </button>
            </div>
          ) : (
            <>
              <input
                ref={layoutInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleLayoutUpload}
                className="hidden"
              />
              <button
                onClick={() => layoutInputRef.current?.click()}
                className="px-8 py-4 rounded-xl font-bold text-lg"
                style={{ backgroundColor: "#c8a84e", color: "#0a0f1a" }}
              >
                Upload Floor Plan | رفع المخطط
              </button>
              <button
                onClick={handleSkipLayout}
                className="text-sm underline"
                style={{ color: "#64748b" }}
              >
                Skip - No Layout | تخطي - بدون مخطط
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ==================== RENDER: SPEC LIST ====================

  if (phase === "spec_list") {
    return (
      <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: "#0a0f1a" }}>
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <button onClick={onBack} className="p-2 rounded-lg" style={{ color: "#94a3b8" }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <div className="flex items-center gap-2 justify-center">
              <Shield className="w-4 h-4" style={{ color: "#c8a84e" }} />
              <span className="font-bold" style={{ color: "#f1f5f9" }}>SAQR</span>
            </div>
            <p className="text-xs" style={{ color: "#64748b" }}>{stats.completed}/{stats.total} specs</p>
          </div>
          <div style={{ width: 36 }} />
        </header>

        {/* Progress bar */}
        <div className="h-1" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full transition-all"
            style={{
              width: `${(stats.completed / stats.total) * 100}%`,
              backgroundColor: "#c8a84e",
            }}
          />
        </div>

        {/* Spec List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {specs.map((spec, index) => {
            const result = specResults.get(spec.id);
            const status = result?.status || "not_started";
            const evidence = result?.evidence || [];
            const requiredCount = result?.requiredCount || 1;
            const isDoc = isDocumentSpec(spec);

            const statusIcon = {
              not_started: <Circle className="w-5 h-5" style={{ color: "#475569" }} />,
              in_progress: <CircleDot className="w-5 h-5" style={{ color: "#c8a84e" }} />,
              pass: <CheckCircle className="w-5 h-5" style={{ color: "#22c55e" }} />,
              fail: <XCircle className="w-5 h-5" style={{ color: "#ef4444" }} />,
              needs_review: <AlertTriangle className="w-5 h-5" style={{ color: "#eab308" }} />,
            }[status];

            const borderColor = {
              not_started: "#475569",
              in_progress: "#c8a84e",
              pass: "#22c55e",
              fail: "#ef4444",
              needs_review: "#eab308",
            }[status];

            const bgColor = {
              not_started: "transparent",
              in_progress: "transparent",
              pass: "rgba(34,197,94,0.03)",
              fail: "rgba(239,68,68,0.03)",
              needs_review: "transparent",
            }[status];

            return (
              <div
                key={spec.id}
                className="rounded-xl overflow-hidden"
                style={{
                  backgroundColor: bgColor,
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderLeftWidth: 3,
                  borderLeftColor: borderColor,
                }}
              >
                <div className="p-4">
                  {/* Top row: Status, Code, Required count */}
                  <div className="flex items-center gap-3 mb-2">
                    {statusIcon}
                    <span className="font-mono font-bold" style={{ color: "#c8a84e" }}>{spec.code}</span>
                    {requiredCount > 1 && (
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ backgroundColor: "#c8a84e", color: "#0a0f1a" }}
                      >
                        ×{requiredCount}
                      </span>
                    )}
                    {isDoc && (
                      <FileText className="w-4 h-4" style={{ color: "#64748b" }} />
                    )}
                  </div>

                  {/* Spec text */}
                  <p className="text-sm mb-1" style={{ color: "#f1f5f9" }}>{spec.text}</p>
                  {spec.textAr && (
                    <p className="text-sm" style={{ color: "#94a3b8" }} dir="rtl">{spec.textAr}</p>
                  )}

                  {/* Evidence thumbnails */}
                  {evidence.length > 0 && (
                    <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
                      {evidence.map((e, i) => (
                        <button
                          key={e.id}
                          onClick={() => setSelectedPhoto({ specId: spec.id, photoIndex: i })}
                          className="w-11 h-11 rounded-lg overflow-hidden shrink-0"
                          style={{
                            border: `2px solid ${e.result === "PASS" ? "#22c55e" : e.result === "FAIL" ? "#ef4444" : "#eab308"}`,
                          }}
                        >
                          <img src={e.thumbnail} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                      <span className="text-xs whitespace-nowrap" style={{ color: "#64748b" }}>
                        {evidence.length}/{requiredCount} captured
                      </span>
                    </div>
                  )}

                  {/* Open Camera button */}
                  <button
                    onClick={() => openCameraForSpec(index)}
                    className="mt-3 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                    style={{ border: "1px solid #c8a84e", color: "#c8a84e" }}
                  >
                    <Camera className="w-4 h-4" />
                    Open Camera
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom bar */}
        <div className="p-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(255,255,255,0.02)" }}>
          <div className="flex items-center justify-between text-sm mb-3" style={{ color: "#94a3b8" }}>
            <span>Completed: {stats.completed}/{stats.total}</span>
            <span style={{ color: "#22c55e" }}>Pass: {stats.pass}</span>
            <span style={{ color: "#ef4444" }}>Fail: {stats.fail}</span>
            <span style={{ color: "#eab308" }}>Review: {stats.review}</span>
          </div>
          <button
            onClick={handleGenerateReport}
            disabled={stats.completed === 0}
            className="w-full py-4 rounded-xl font-bold text-lg disabled:opacity-50"
            style={{ backgroundColor: "#c8a84e", color: "#0a0f1a" }}
          >
            Generate Report | إنشاء التقرير
          </button>
        </div>
      </div>
    );
  }

  // ==================== RENDER: CAMERA ====================

  if (phase === "camera" && currentSpec) {
    const isDoc = isDocumentSpec(currentSpec);

    return (
      <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: "#0a0f1a" }}>
        {/* Flash overlay */}
        <div
          id="capture-flash"
          className="fixed inset-0 pointer-events-none z-50 transition-opacity duration-100"
          style={{ backgroundColor: "white", opacity: 0 }}
        />

        {/* Top navigation */}
        <header className="flex items-center justify-between p-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <button onClick={backToSpecList} className="flex items-center gap-1" style={{ color: "#94a3b8" }}>
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">Back</span>
          </button>
          <div className="text-center">
            <span className="font-mono font-bold" style={{ color: "#c8a84e" }}>{currentSpec.code}</span>
            <span className="text-sm ml-2" style={{ color: "#64748b" }}>({currentSpecIndex + 1}/{specs.length})</span>
          </div>
          <button
            onClick={goToNextSpec}
            disabled={currentSpecIndex >= specs.length - 1}
            className="flex items-center gap-1 disabled:opacity-30"
            style={{ color: "#94a3b8" }}
          >
            <span className="text-sm">Next</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </header>

        {/* Camera view */}
        <div className="relative flex-1" style={{ minHeight: "50vh" }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Document scan overlay */}
          {documentScanMode && (
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
                <p style={{ color: "#c8a84e" }}>Align document in frame</p>
                <p style={{ color: "#94a3b8" }} dir="rtl">ضع الوثيقة في الإطار</p>
              </div>
            </div>
          )}

          {/* Camera loading or error state */}
          {!cameraReady && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "#0a0f1a" }}>
              {cameraError ? (
                <div className="text-center p-6 max-w-sm">
                  {/* Camera with lock icon */}
                  <div className="relative inline-block mb-4">
                    <Camera className="w-16 h-16" style={{ color: "#64748b" }} />
                    <div
                      className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: "#ef4444" }}
                    >
                      <X className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <h3 className="font-bold text-lg mb-2" style={{ color: "#f1f5f9" }}>
                    Camera access required
                  </h3>
                  <p className="text-lg mb-3" style={{ color: "#94a3b8" }} dir="rtl">
                    مطلوب الوصول للكاميرا
                  </p>
                  <p className="text-sm mb-4" style={{ color: "#64748b" }}>
                    {cameraError}
                  </p>
                  <p className="text-sm mb-6" style={{ color: "#64748b" }} dir="rtl">
                    يرجى السماح بإذن الكاميرا في إعدادات المتصفح
                  </p>
                  <button
                    onClick={() => {
                      setCameraError(null);
                      startCamera();
                    }}
                    className="px-6 py-3 rounded-xl font-bold"
                    style={{ backgroundColor: "#c8a84e", color: "#0a0f1a" }}
                  >
                    Try Again | حاول مرة أخرى
                  </button>
                </div>
              ) : (
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#c8a84e" }} />
              )}
            </div>
          )}
        </div>

        {/* Spec info */}
        <div className="p-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <p className="text-sm mb-1" style={{ color: "#f1f5f9" }}>{currentSpec.text}</p>
          {currentSpec.textAr && (
            <p className="text-sm" style={{ color: "#94a3b8" }} dir="rtl">{currentSpec.textAr}</p>
          )}

          {/* Evidence thumbnails */}
          {currentResult && currentResult.evidence.length > 0 && (
            <div className="flex items-center gap-2 mt-3 overflow-x-auto">
              {currentResult.evidence.map((e, i) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedPhoto({ specId: currentSpec.id, photoIndex: i })}
                  className="w-11 h-11 rounded-lg overflow-hidden shrink-0 relative"
                  style={{
                    border: `2px solid ${e.result === "PASS" ? "#22c55e" : e.result === "FAIL" ? "#ef4444" : "#eab308"}`,
                  }}
                >
                  <img src={e.thumbnail} alt="" className="w-full h-full object-cover" />
                  {e.confidence === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                      <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#c8a84e" }} />
                    </div>
                  )}
                </button>
              ))}
              <span className="text-xs whitespace-nowrap" style={{ color: "#64748b" }}>
                {currentResult.evidence.length}/{currentResult.requiredCount} captured
              </span>
            </div>
          )}
        </div>

        {/* Capture controls */}
        <div className="p-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between">
            {/* Upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-1 px-4 py-2"
              style={{ color: "#94a3b8" }}
            >
              <Upload className="w-5 h-5" />
              <span className="text-xs">Upload</span>
            </button>

            {/* Capture button */}
            <button
              onClick={handleCapture}
              disabled={!cameraReady || isAnalyzing}
              className="w-18 h-18 rounded-full flex items-center justify-center disabled:opacity-50"
              style={{
                width: 72,
                height: 72,
                border: "4px solid #c8a84e",
                backgroundColor: isAnalyzing ? "#0a0f1a" : "white",
              }}
            >
              {isAnalyzing ? (
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#c8a84e" }} />
              ) : (
                <Camera className="w-6 h-6" style={{ color: "#0a0f1a" }} />
              )}
            </button>

            {/* Document scan button (only for document specs) */}
            {isDoc ? (
              <button
                onClick={() => setDocumentScanMode(!documentScanMode)}
                className="flex flex-col items-center gap-1 px-4 py-2"
                style={{ color: documentScanMode ? "#c8a84e" : "#94a3b8" }}
              >
                <ScanLine className="w-5 h-5" />
                <span className="text-xs">Scan Doc</span>
              </button>
            ) : (
              <div style={{ width: 70 }} />
            )}
          </div>
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

  // ==================== RENDER: PHOTO REVIEW ====================

  if (selectedPhoto) {
    const spec = specs.find((s) => s.id === selectedPhoto.specId);
    const result = specResults.get(selectedPhoto.specId);
    const photo = result?.evidence[selectedPhoto.photoIndex];

    if (!spec || !result || !photo) {
      setSelectedPhoto(null);
      return null;
    }

    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "rgba(0,0,0,0.95)" }}>
        {/* Header */}
        <header className="flex items-center justify-between p-4">
          <button onClick={() => setSelectedPhoto(null)} style={{ color: "#f1f5f9" }}>
            <X className="w-6 h-6" />
          </button>
          <div className="text-center">
            <span className="font-mono" style={{ color: "#c8a84e" }}>{spec.code}</span>
            <span className="ml-2" style={{ color: "#64748b" }}>
              {selectedPhoto.photoIndex + 1}/{result.evidence.length}
            </span>
          </div>
          <div style={{ width: 24 }} />
        </header>

        {/* Image */}
        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
          <img
            src={photo.image}
            alt=""
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>

        {/* Details */}
        <div className="p-4 space-y-3">
          {/* AI Comment */}
          <div className="rounded-lg p-3" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
            <p className="text-sm font-medium mb-1" style={{ color: "#c8a84e" }}>AI Comment:</p>
            <p className="text-sm" style={{ color: "#f1f5f9" }}>{photo.aiComment}</p>
            {photo.aiCommentAr && (
              <p className="text-sm mt-1" style={{ color: "#94a3b8" }} dir="rtl">{photo.aiCommentAr}</p>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-sm" style={{ color: "#94a3b8" }}>
            <span>
              Result:{" "}
              <span
                style={{
                  color: photo.result === "PASS" ? "#22c55e" : photo.result === "FAIL" ? "#ef4444" : "#eab308",
                }}
              >
                {photo.result}
              </span>
            </span>
            <span>Confidence: {photo.confidence}%</span>
            <span>Quality: {photo.imageQuality}</span>
          </div>
          <div className="text-sm" style={{ color: "#64748b" }}>
            Time: {photo.timestamp}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() =>
                setSelectedPhoto({
                  ...selectedPhoto,
                  photoIndex: Math.max(0, selectedPhoto.photoIndex - 1),
                })
              }
              disabled={selectedPhoto.photoIndex === 0}
              className="px-4 py-2 rounded-lg disabled:opacity-30"
              style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#f1f5f9" }}
            >
              <ChevronLeft className="w-5 h-5 inline" /> Prev
            </button>

            <button
              onClick={() => {
                if (window.confirm("Delete this photo?")) {
                  deletePhoto(selectedPhoto.specId, selectedPhoto.photoIndex);
                }
              }}
              className="px-4 py-2 rounded-lg"
              style={{ border: "1px solid #ef4444", color: "#ef4444" }}
            >
              <Trash2 className="w-4 h-4 inline mr-1" /> Delete
            </button>

            <button
              onClick={() =>
                setSelectedPhoto({
                  ...selectedPhoto,
                  photoIndex: Math.min(result.evidence.length - 1, selectedPhoto.photoIndex + 1),
                })
              }
              disabled={selectedPhoto.photoIndex >= result.evidence.length - 1}
              className="px-4 py-2 rounded-lg disabled:opacity-30"
              style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#f1f5f9" }}
            >
              Next <ChevronRight className="w-5 h-5 inline" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== RENDER: RESULTS ====================

  if (phase === "results") {
    const allResults = Array.from(specResults.values());
    const passRate = stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : 0;

    return (
      <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: "#0a0f1a" }}>
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <button onClick={() => setPhase("spec_list")} className="p-2" style={{ color: "#94a3b8" }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" style={{ color: "#c8a84e" }} />
            <span className="font-bold" style={{ color: "#f1f5f9" }}>SAQR Results</span>
          </div>
          <div style={{ width: 36 }} />
        </header>

        {/* Score circle */}
        <div className="p-6 flex flex-col items-center">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" stroke="#1e293b" strokeWidth="8" fill="none" />
              <circle
                cx="50" cy="50" r="40"
                stroke={passRate >= 80 ? "#22c55e" : passRate >= 50 ? "#eab308" : "#ef4444"}
                strokeWidth="8" fill="none"
                strokeDasharray={`${(passRate / 100) * 251} 251`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold" style={{ color: "#f1f5f9" }}>{passRate}%</span>
            </div>
          </div>
          <p className="mt-2 text-sm" style={{ color: "#64748b" }}>Pass Rate</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-2 px-4 mb-4">
          {[
            { label: "Pass", count: stats.pass, color: "#22c55e" },
            { label: "Fail", count: stats.fail, color: "#ef4444" },
            { label: "Review", count: stats.review, color: "#eab308" },
            { label: "Pending", count: stats.total - stats.completed, color: "#64748b" },
          ].map((s) => (
            <div key={s.label} className="p-3 rounded-lg text-center" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</div>
              <div className="text-xs" style={{ color: "#94a3b8" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">
          {allResults.map((result) => (
            <div
              key={result.specCode}
              className="rounded-xl p-4"
              style={{
                backgroundColor: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderLeftWidth: 3,
                borderLeftColor:
                  result.status === "pass" ? "#22c55e" :
                  result.status === "fail" ? "#ef4444" :
                  result.status === "needs_review" ? "#eab308" : "#475569",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                {result.status === "pass" && <CheckCircle className="w-5 h-5" style={{ color: "#22c55e" }} />}
                {result.status === "fail" && <XCircle className="w-5 h-5" style={{ color: "#ef4444" }} />}
                {result.status === "needs_review" && <AlertTriangle className="w-5 h-5" style={{ color: "#eab308" }} />}
                {result.status === "not_started" && <Circle className="w-5 h-5" style={{ color: "#475569" }} />}
                {result.status === "in_progress" && <CircleDot className="w-5 h-5" style={{ color: "#c8a84e" }} />}
                <span className="font-mono font-bold" style={{ color: "#c8a84e" }}>{result.specCode}</span>
                {result.overallSeverity !== "OK" && (
                  <span
                    className="px-2 py-0.5 rounded text-xs font-bold"
                    style={{
                      backgroundColor:
                        result.overallSeverity === "CRITICAL" ? "#ef4444" :
                        result.overallSeverity === "MAJOR" ? "#f97316" : "#eab308",
                      color: "#0a0f1a",
                    }}
                  >
                    {result.overallSeverity}
                  </span>
                )}
              </div>

              <p className="text-sm mb-1" style={{ color: "#f1f5f9" }}>{result.specText}</p>
              {result.specTextAr && (
                <p className="text-sm mb-2" style={{ color: "#94a3b8" }} dir="rtl">{result.specTextAr}</p>
              )}

              {/* Evidence grid */}
              {result.evidence.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {result.evidence.map((e, i) => (
                    <button
                      key={e.id}
                      onClick={() => setSelectedPhoto({ specId: specs.find((s) => s.code === result.specCode)?.id || "", photoIndex: i })}
                      className="aspect-square rounded-lg overflow-hidden"
                      style={{
                        border: `2px solid ${e.result === "PASS" ? "#22c55e" : e.result === "FAIL" ? "#ef4444" : "#eab308"}`,
                      }}
                    >
                      <img src={e.thumbnail} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Finding */}
              {result.overallFinding && (
                <p className="text-sm mt-2" style={{ color: "#64748b" }}>{result.overallFinding}</p>
              )}
            </div>
          ))}
        </div>

        {/* Generate PDF button */}
        <div className="p-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <button
            onClick={handleCompleteInspection}
            className="w-full py-4 rounded-xl font-bold text-lg"
            style={{ backgroundColor: "#c8a84e", color: "#0a0f1a" }}
          >
            Complete Inspection | إتمام الفحص
          </button>
        </div>
      </div>
    );
  }

  return null;
}
