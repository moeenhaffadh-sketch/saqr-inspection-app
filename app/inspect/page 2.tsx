// LOCKED v0.1.0 - Do not modify without approval
// 3-step inspection flow: Authority → Category → Specs Review (with selection + individual inspection) → Dashboard
"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { trpc } from "@/lib/trpc/client";
import {
  Camera,
  ArrowLeft,
  ClipboardList,
  Building2,
  Shield,
  Loader2,
  ChevronRight,
  FileText,
  Video,
  QrCode,
  Barcode,
  Award,
  PenLine,
  ImageIcon,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  ZapOff,
  SkipForward,
} from "lucide-react";

const VERSION = '0.2.0';

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

type PreInspectionResult = {
  status: "PASS" | "FAIL";
  photoUrl?: string;
  aiAnalyzed?: boolean;
  aiConfidence?: number;
  aiReasoning?: string;
  aiReasoningAr?: string;
};

function InspectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const countryFromUrl = searchParams.get("country");

  const [selectedCountry, setSelectedCountry] = useState<string>("BH");
  const [selectedAuthority, setSelectedAuthority] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Spec selection state
  const [selectedSpecs, setSelectedSpecs] = useState<Set<string>>(new Set());

  // Pre-inspection results (before clicking Start Inspection)
  const [preInspectionResults, setPreInspectionResults] = useState<Map<string, PreInspectionResult>>(new Map());

  // Camera state for individual spec inspection
  const [activeInspectSpec, setActiveInspectSpec] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [saqrEnabled, setSaqrEnabled] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "detected">("idle");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isAnalyzingSpec, setIsAnalyzingSpec] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // Fetch specs for selected category
  const { data: specs, isLoading: loadingSpecs } = trpc.inspection.getSpecs.useQuery(
    { categoryId: selectedCategory! },
    { enabled: !!selectedCategory }
  );

  // Create inspection mutation
  const createInspection = trpc.inspection.create.useMutation();

  // Camera functions
  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Camera requires HTTPS. Use localhost or enable HTTPS.");
      return;
    }

    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
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

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setCapturedImage(null);
    setSaqrEnabled(false);
    setScanStatus("idle");
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(dataUrl);
    return dataUrl;
  }, []);

  const closeCameraView = useCallback(() => {
    stopCamera();
    setActiveInspectSpec(null);
  }, [stopCamera]);

  const handleMarkSpec = useCallback(async (status: "PASS" | "FAIL") => {
    if (!activeInspectSpec) return;

    // Capture photo if not already captured
    let photoUrl = capturedImage;
    if (!photoUrl && cameraReady) {
      photoUrl = capturePhoto();
    }

    // Get the active spec details for AI analysis
    const activeSpec = specs?.find(s => s.id === activeInspectSpec);

    // Call AI for analysis when we have a photo
    let aiReasoning: string | undefined;
    let aiReasoningAr: string | undefined;
    let aiConfidence: number | undefined;

    if (photoUrl && activeSpec) {
      setIsAnalyzingSpec(true);
      try {
        // Get English reasoning
        const enResponse = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: photoUrl,
            checklistItem: {
              code: activeSpec.code,
              description: activeSpec.requirement,
              category: activeSpec.evidenceType,
            },
            language: "en",
          }),
        });
        const enData = await enResponse.json();
        if (!enData.error) {
          aiReasoning = enData.reasoning;
          aiConfidence = enData.confidence;
        }

        // Get Arabic reasoning
        const arResponse = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: photoUrl,
            checklistItem: {
              code: activeSpec.code,
              description: activeSpec.requirement,
              category: activeSpec.evidenceType,
            },
            language: "ar",
          }),
        });
        const arData = await arResponse.json();
        if (!arData.error) {
          aiReasoningAr = arData.reasoning;
        }
      } catch (error) {
        console.error("AI analysis error:", error);
      } finally {
        setIsAnalyzingSpec(false);
      }
    }

    // Save pre-inspection result with AI data
    setPreInspectionResults(prev => {
      const newMap = new Map(prev);
      newMap.set(activeInspectSpec, {
        status,
        photoUrl: photoUrl || undefined,
        aiAnalyzed: !!aiReasoning,
        aiConfidence,
        aiReasoning,
        aiReasoningAr,
      });
      return newMap;
    });

    // Close camera and return to review
    closeCameraView();
  }, [activeInspectSpec, capturedImage, cameraReady, capturePhoto, closeCameraView, specs]);

  // Initialize all specs as selected when they load
  useEffect(() => {
    if (specs && specs.length > 0 && selectedSpecs.size === 0) {
      setSelectedSpecs(new Set(specs.map(s => s.id)));
    }
  }, [specs, selectedSpecs.size]);

  const handleAuthoritySelect = (id: string) => {
    setSelectedAuthority(id);
    setSelectedCategory(null); // Reset category when authority changes
  };

  const handleCategorySelect = (id: string) => {
    setSelectedCategory(id);
  };

  const handleStartInspection = async () => {
    if (!selectedCategory || isStarting || selectedSpecs.size === 0) return;

    setIsStarting(true);
    try {
      // Store selected spec IDs in localStorage for the dashboard to filter
      localStorage.setItem("saqr_selected_specs", JSON.stringify(Array.from(selectedSpecs)));

      // Store pre-inspection results for the dashboard to use
      const preResultsArray = Array.from(preInspectionResults.entries()).map(([specId, result]) => ({
        specId,
        ...result,
      }));
      localStorage.setItem("saqr_pre_inspection_results", JSON.stringify(preResultsArray));

      const inspection = await createInspection.mutateAsync({
        categoryId: selectedCategory,
      });
      router.push(`/inspect/${inspection.id}`);
    } catch (error) {
      console.error("Failed to create inspection:", error);
      setIsStarting(false);
    }
  };

  const selectedCountryData = GCC_COUNTRIES.find(c => c.code === selectedCountry);
  const selectedAuthorityData = authorities?.find(a => a.id === selectedAuthority);
  const selectedCategoryData = categories?.find(c => c.id === selectedCategory);

  // Current step: 1 = Authority, 2 = Category, 3 = Specs Review
  const currentStep = !selectedAuthority ? 1 : !selectedCategory ? 2 : 3;

  // Calculate stats for selected specs
  const selectedSpecsList = specs?.filter(s => selectedSpecs.has(s.id)) || [];
  const passCount = selectedSpecsList.filter(s => preInspectionResults.get(s.id)?.status === "PASS").length;
  const failCount = selectedSpecsList.filter(s => preInspectionResults.get(s.id)?.status === "FAIL").length;
  const pendingCount = selectedSpecsList.length - passCount - failCount;

  // PDF Download Function - English only (Arabic support coming soon)
  const handleDownloadPDF = useCallback(async () => {
    if (!specs || !selectedAuthorityData || !selectedCategoryData || isGeneratingPDF) return;

    setIsGeneratingPDF(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let pdfMake = (window as any).pdfMake;

      if (!pdfMake) {
        // Load pdfmake from CDN
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load pdfmake"));
          document.head.appendChild(script);
        });

        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.min.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load fonts"));
          document.head.appendChild(script);
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pdfMake = (window as any).pdfMake;
      }

      if (!pdfMake) throw new Error("pdfMake not loaded");

      // For now, skip Arabic font (will show as boxes) - Arabic font support coming in future update
      // The Amiri font has compatibility issues with pdfmake in this environment

      const now = new Date();
      const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      const countryData = GCC_COUNTRIES.find(c => c.code === selectedCountry) || GCC_COUNTRIES[0];
      const completionPercent = specs.length > 0 ? Math.round(((passCount + failCount) / specs.length) * 100) : 0;

      // Build table body with proper types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tableBody: any[][] = [
        [{ text: "Code", bold: true }, { text: "Requirement", bold: true }, { text: "Status", bold: true }, { text: "SAQR Comment", bold: true }],
      ];

      specs.forEach(spec => {
        const preResult = preInspectionResults.get(spec.id);
        const status = preResult?.status || "Pending";
        const statusAr = status === "PASS" ? "ناجح" : status === "FAIL" ? "غير مرضي" : "معلّق";
        tableBody.push([
          { text: spec.code, bold: true },
          {
            stack: [
              { text: spec.requirement.length > 50 ? spec.requirement.substring(0, 50) + "..." : spec.requirement, fontSize: 9 },
              { text: spec.requirementAr || "", fontSize: 8, color: "#666" },
            ],
          },
          {
            stack: [
              { text: status, bold: true, color: status === "PASS" ? "#22c55e" : status === "FAIL" ? "#ef4444" : "#ca8a04" },
              { text: statusAr, fontSize: 8, color: status === "PASS" ? "#22c55e" : status === "FAIL" ? "#ef4444" : "#ca8a04" },
            ],
          },
          preResult?.aiReasoning ? {
            stack: [
              { text: preResult.aiReasoning.length > 60 ? preResult.aiReasoning.substring(0, 60) + "..." : preResult.aiReasoning, fontSize: 8 },
              { text: preResult.aiReasoningAr ? (preResult.aiReasoningAr.length > 50 ? preResult.aiReasoningAr.substring(0, 50) + "..." : preResult.aiReasoningAr) : "", fontSize: 7, color: "#666" },
            ],
          } : { text: "-", fontSize: 8, color: "#999" },
        ]);
      });

      const docDefinition = {
        content: [
          // Header - Bilingual
          {
            columns: [
              { text: "SAQR", fontSize: 24, bold: true, color: "#f59e0b" },
              { text: "", width: "*" },
              { text: "صقر", fontSize: 20, bold: true, color: "#f59e0b", alignment: "right" },
            ],
          },
          {
            columns: [
              { text: "Inspection Report", fontSize: 14, color: "#444" },
              { text: "", width: "*" },
              { text: "تقرير التفتيش", fontSize: 14, color: "#444", alignment: "right" },
            ],
            margin: [0, 0, 0, 5],
          },
          { text: `${dateStr} | ${timeStr}`, fontSize: 9, color: "#888", margin: [0, 0, 0, 15] },
          // Authority
          {
            columns: [
              { text: `Authority: ${selectedAuthorityData.code} - ${selectedAuthorityData.name}`, fontSize: 11 },
              { text: selectedAuthorityData.nameAr || "", fontSize: 11, alignment: "right" },
            ],
          },
          // Category
          {
            columns: [
              { text: `Category: ${selectedCategoryData.name}`, fontSize: 11 },
              { text: selectedCategoryData.nameAr || "", fontSize: 11, alignment: "right" },
            ],
          },
          { text: `Country: ${countryData.flag} ${countryData.name} | ${countryData.nameAr}`, fontSize: 11, margin: [0, 0, 0, 10] },
          // Summary
          {
            columns: [
              { text: `Total: ${specs.length}`, alignment: "center" },
              { text: `Passed: ${passCount}`, alignment: "center", color: "#22c55e" },
              { text: `Failed: ${failCount}`, alignment: "center", color: "#ef4444" },
              { text: `Pending: ${pendingCount}`, alignment: "center", color: "#ca8a04" },
            ],
            margin: [0, 0, 0, 5],
          },
          { text: `Completion: ${completionPercent}%`, fontSize: 9, color: "#666", margin: [0, 0, 0, 15] },
          // Table
          {
            table: { headerRows: 1, widths: [40, "*", 50, "*"], body: tableBody },
            layout: "lightHorizontalLines",
          },
          { text: " " },
          {
            columns: [
              { text: `Generated by Saqr v${VERSION}`, fontSize: 8, color: "#999" },
              { text: "", width: "*" },
              { text: "تم إنشاؤه بواسطة صقر", fontSize: 8, color: "#999", alignment: "right" },
            ],
          },
        ],
        defaultStyle: { fontSize: 10 },
      };

      const filename = `Saqr_${selectedAuthorityData.code}_${selectedCategoryData.name.replace(/\s+/g, "_")}_${now.toISOString().split("T")[0]}.pdf`;
      pdfMake.createPdf(docDefinition).download(filename);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Failed to generate PDF: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [specs, selectedAuthorityData, selectedCategoryData, selectedCountry, preInspectionResults, passCount, failCount, pendingCount, isGeneratingPDF]);

  // Get active spec for camera view
  const activeSpec = specs?.find(s => s.id === activeInspectSpec);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  // Camera View for Individual Spec Inspection
  if (activeInspectSpec && activeSpec) {
    const evidenceCfg = evidenceTypes[activeSpec.evidenceType] || { icon: ImageIcon, labelEn: "Photo", labelAr: "صورة", color: "text-green-500" };
    const EvidenceIcon = evidenceCfg.icon;
    const existingResult = preInspectionResults.get(activeInspectSpec);

    return (
      <div className="fixed inset-0 bg-black text-white z-50">
        {/* Camera View - Full screen background layer */}
        <div className="absolute inset-0">
          {capturedImage ? (
            <img
              src={capturedImage}
              alt="Captured"
              className="w-full h-full object-cover"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {cameraError && (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-zinc-900 cursor-pointer"
                  onClick={startCamera}
                >
                  <div className="text-center p-4">
                    <Camera className="w-12 h-12 mx-auto mb-3 text-zinc-600" />
                    <p className="text-zinc-400">{cameraError}</p>
                  </div>
                </div>
              )}
              {!cameraReady && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                </div>
              )}
            </>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* TOP OVERLAY - Fixed height, max 140px */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-black/80 max-h-[140px] overflow-hidden">
          {/* Row 1: Back + SAQR */}
          <div className="flex items-center justify-between px-4 py-2">
            <button onClick={closeCameraView} className="flex items-center gap-2 text-white text-sm">
              <ArrowLeft className="w-5 h-5" />
              <span>Back | <span dir="rtl">رجوع</span></span>
            </button>
            <button
              onClick={() => setSaqrEnabled(!saqrEnabled)}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                saqrEnabled ? "bg-amber-500 text-black" : "bg-white/20 text-white"
              }`}
            >
              {saqrEnabled ? <Zap className="w-3 h-3" /> : <ZapOff className="w-3 h-3" />}
              SAQR
            </button>
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

        {/* BOTTOM CONTROLS - Fixed at bottom */}
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/80 p-4">
          {/* Previous result toast */}
          {existingResult && (
            <div className={`mb-3 px-3 py-1.5 rounded-full text-center text-xs ${
              existingResult.status === "PASS" ? "bg-green-500/30 text-green-400" : "bg-red-500/30 text-red-400"
            }`}>
              {existingResult.status === "PASS" ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : <XCircle className="w-3 h-3 inline mr-1" />}
              Previously: {existingResult.status} | <span dir="rtl">سابقاً: {existingResult.status === "PASS" ? "ناجح" : "غير مرضي"}</span>
            </div>
          )}

          {/* Capture button */}
          {!capturedImage ? (
            <div className="flex justify-center mb-3">
              <button
                onClick={capturePhoto}
                disabled={!cameraReady}
                className="w-14 h-14 rounded-full bg-white flex items-center justify-center disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-full border-4 border-black" />
              </button>
            </div>
          ) : (
            <div className="flex justify-center mb-3">
              <button onClick={() => setCapturedImage(null)} className="px-4 py-1.5 rounded-full bg-zinc-700 text-white text-sm">
                Retake | <span dir="rtl">إعادة</span>
              </button>
            </div>
          )}

          {/* Pass/Fail/Skip */}
          {isAnalyzingSpec ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <span className="text-sm text-zinc-300">
                Analyzing with SAQR AI... | <span dir="rtl">جاري التحليل مع صقر</span>
              </span>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => handleMarkSpec("PASS")}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-bold flex items-center justify-center gap-1"
              >
                <CheckCircle2 className="w-4 h-4" />
                Pass | <span dir="rtl">ناجح</span>
              </button>
              <button
                onClick={() => handleMarkSpec("FAIL")}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold flex items-center justify-center gap-1"
              >
                <XCircle className="w-4 h-4" />
                Fail | <span dir="rtl">غير مرضي</span>
              </button>
              <button onClick={closeCameraView} className="py-2.5 px-3 rounded-xl bg-zinc-700 text-white"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 p-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/landing-falcon.png" alt="Saqr" width={40} height={40} className="rounded-full" priority unoptimized />
          <div>
            <h1 className="text-lg font-bold">Saqr</h1>
            <p className="text-xs text-zinc-500">Field Inspector v{VERSION}</p>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700">
            <span className="text-lg">{selectedCountryData?.flag}</span>
            <span className="text-sm font-medium">{selectedCountryData?.name}</span>
          </div>
          <Link href="/" className="text-zinc-500 hover:text-white transition-colors p-2">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="border-b border-zinc-800 px-4 py-3 bg-zinc-900/50">
        <div className="flex items-center gap-2 text-sm overflow-x-auto">
          <span className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap ${currentStep === 1 ? "bg-amber-500 text-black" : currentStep > 1 ? "bg-amber-500/20 text-amber-400" : "bg-zinc-800 text-zinc-500"}`}>
            <span className="inline-flex items-center gap-1"><span>1. Authority</span><span>|</span><span>الجهة</span></span>
          </span>
          <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
          <span className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap ${currentStep === 2 ? "bg-amber-500 text-black" : currentStep > 2 ? "bg-amber-500/20 text-amber-400" : "bg-zinc-800 text-zinc-500"}`}>
            <span className="inline-flex items-center gap-1"><span>2. Category</span><span>|</span><span>الفئة</span></span>
          </span>
          <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
          <span className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap ${currentStep === 3 ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-500"}`}>
            <span className="inline-flex items-center gap-1"><span>3. Review</span><span>|</span><span>المراجعة</span></span>
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
            {/* Back to authorities */}
            <button
              onClick={() => setSelectedAuthority(null)}
              className="flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="inline-flex items-center gap-1 text-sm"><span>Back to Authorities</span><span>|</span><span>العودة للجهات</span></span>
            </button>

            {/* Selected Authority Badge */}
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

        {/* Step 3: Review Specs + Start */}
        {currentStep === 3 && selectedCategory && (
          <section className="space-y-4 pb-40">
            {/* Back to categories */}
            <button
              onClick={() => {
                setSelectedCategory(null);
                setSelectedSpecs(new Set());
                setPreInspectionResults(new Map());
              }}
              className="flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="inline-flex items-center gap-1 text-sm"><span>Back to Categories</span><span>|</span><span>العودة للفئات</span></span>
            </button>

            {/* Selected Authority & Category Summary */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800 mb-4">
              <div className={`w-10 h-10 rounded-lg ${authorityColors[selectedAuthorityData?.code || ""] || "bg-zinc-600"} flex items-center justify-center shrink-0`}>
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white inline-flex items-center gap-1">
                  <span>{selectedAuthorityData?.code}</span>
                  <span className="text-zinc-500">|</span>
                  <span className="text-base" dir="rtl">{selectedAuthorityData?.nameAr}</span>
                </div>
                <div className="text-xs text-zinc-500">{selectedAuthorityData?.name}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: (selectedCategoryData?.color || "#666") + "30" }}
              >
                <ClipboardList className="w-5 h-5" style={{ color: selectedCategoryData?.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white inline-flex items-center gap-1">
                  <span>{selectedCategoryData?.name}</span>
                  <span className="text-zinc-500">|</span>
                  <span className="text-base" dir="rtl">{selectedCategoryData?.nameAr}</span>
                </div>
              </div>
            </div>

            {loadingSpecs ? (
              <div className="flex flex-col items-center gap-2 py-12 text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="inline-flex items-center gap-1"><span>Loading specs...</span><span>|</span><span>جاري تحميل المواصفات...</span></span>
              </div>
            ) : specs?.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No specs available</p>
                <p className="text-sm mt-1" dir="rtl">لا توجد مواصفات متاحة</p>
              </div>
            ) : (
              <div className="space-y-2 mb-24">
                {specs?.map((spec) => {
                  const evidenceCfg = evidenceTypes[spec.evidenceType] || { icon: ImageIcon, labelEn: "Photo", labelAr: "صورة", color: "text-green-500" };
                  const EvidenceIcon = evidenceCfg.icon;
                  const preResult = preInspectionResults.get(spec.id);

                  // Status styles
                  const getStatusStyle = () => {
                    if (!preResult) return { icon: Clock, color: "text-amber-500", bg: "bg-amber-500/20", label: "Pending" };
                    if (preResult.status === "PASS") return { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/20", label: "Pass" };
                    return { icon: XCircle, color: "text-red-500", bg: "bg-red-500/20", label: "Fail" };
                  };
                  const statusStyle = getStatusStyle();
                  const StatusIcon = statusStyle.icon;

                  return (
                    <div
                      key={spec.id}
                      className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
                    >
                      {/* Header row: Code + Evidence + Status */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-mono bg-zinc-800 px-2 py-0.5 rounded text-amber-400">
                          {spec.code}
                        </span>
                        <div className="flex items-center gap-1">
                          <EvidenceIcon className={`w-3.5 h-3.5 ${evidenceCfg.color}`} />
                          <span className={`text-xs ${evidenceCfg.color} inline-flex items-center gap-0.5`}>
                            <span>{evidenceCfg.labelEn}</span>
                            <span>|</span>
                            <span dir="rtl">{evidenceCfg.labelAr}</span>
                          </span>
                        </div>
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded ${statusStyle.bg}`}>
                          <StatusIcon className={`w-3 h-3 ${statusStyle.color}`} />
                          <span className={`text-xs ${statusStyle.color}`}>
                            {statusStyle.label}
                          </span>
                        </div>
                      </div>

                      {/* Requirement English */}
                      <p className="text-sm text-zinc-200 mb-1">{spec.requirement}</p>

                      {/* Requirement Arabic */}
                      <p className="text-base text-zinc-200" dir="rtl">{spec.requirementAr}</p>

                      {/* AI Comment */}
                      {preResult?.aiReasoning && (
                        <div className="mt-3 pt-3 border-t border-zinc-700">
                          <div className="flex items-center gap-1 mb-1">
                            <Zap className="w-3 h-3 text-amber-400" />
                            <span className="text-xs text-amber-400 font-medium">SAQR AI Comment</span>
                            {preResult.aiConfidence && (
                              <span className="text-xs text-zinc-500 ml-1">({Math.round(preResult.aiConfidence * 100)}%)</span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-300">{preResult.aiReasoning}</p>
                          {preResult.aiReasoningAr && (
                            <p className="text-sm text-zinc-300 mt-1" dir="rtl">{preResult.aiReasoningAr}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sticky Summary Bar */}
            {specs && specs.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
                <div className="max-w-lg mx-auto">
                  {/* Button Row */}
                  <div className="flex items-center gap-3">
                    {/* Download PDF Button */}
                    <button
                      onClick={handleDownloadPDF}
                      disabled={isGeneratingPDF}
                      className="py-4 px-4 rounded-xl border border-zinc-600 bg-zinc-800/80 hover:bg-zinc-700 text-white font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {isGeneratingPDF ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <FileText className="w-5 h-5" />
                      )}
                      <span className="hidden sm:inline">PDF</span>
                    </button>

                    {/* Start Inspection Button */}
                    <button
                      onClick={handleStartInspection}
                      disabled={isStarting}
                      className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-black py-4 rounded-xl font-bold text-lg hover:from-amber-400 hover:to-orange-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                      {isStarting ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span className="inline-flex items-center gap-1"><span>Starting...</span><span>|</span><span>جاري البدء...</span></span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-6 h-6" />
                          <span className="inline-flex items-center gap-1">
                            <span>Start Inspection</span>
                            <span>|</span>
                            <span>ابدأ التفتيش</span>
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Footer - only show when not on step 3 to avoid overlap with sticky button */}
      {currentStep !== 3 && (
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
