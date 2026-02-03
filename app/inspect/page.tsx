// SAQR Field Inspector v1.0.0 - Manual Spec-by-Spec
"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { trpc } from "@/lib/trpc/client";
import {
  ArrowLeft,
  ClipboardList,
  Building2,
  Shield,
  Loader2,
  ChevronRight,
  Download,
} from "lucide-react";
import { generateInspectionPDF } from "@/lib/utils/generatePDF";

// Dynamic import for SaqrInspector (no SSR for camera)
const SaqrInspector = dynamic(() => import("@/components/SaqrInspector"), { ssr: false });

const VERSION = "1.0.0";

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
  const [showInspector, setShowInspector] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

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

  // Navigation handlers
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

  // Build specs for SaqrInspector
  const specs = inspection?.category?.specs.map((spec) => ({
    id: spec.id,
    code: spec.code,
    text: spec.requirement,
    textAr: spec.requirementAr,
    category: spec.evidenceType,
  })) || [];

  // Handle SaqrInspector completion
  const handleInspectorComplete = async (results: Array<{
    specCode: string;
    specText: string;
    specTextAr?: string;
    status: string;
    evidence: Array<{
      id: string;
      image: string;
      thumbnail: string;
      timestamp: string;
      aiComment: string;
      aiCommentAr: string;
      result: "PASS" | "FAIL" | "NEEDS_REVIEW";
      confidence: number;
      severity: string;
      imageQuality: string;
    }>;
    overallFinding: string;
    overallFindingAr: string;
    overallSeverity: string;
    requiredCount: number;
    inspectedCount: number;
  }>) => {
    if (!inspectionId) return;

    // Save all results to database
    for (const result of results) {
      const spec = inspection?.category?.specs.find((s) => s.code === result.specCode);
      if (!spec) continue;

      // Get first evidence image as the main photo
      const mainPhoto = result.evidence[0]?.image || null;
      const status = result.status === "pass" ? "PASS" :
                     result.status === "fail" ? "FAIL" :
                     result.status === "needs_review" ? "UNCERTAIN" : null;

      if (status) {
        try {
          await saveResult.mutateAsync({
            inspectionId,
            specId: spec.id,
            status,
            photoUrl: mainPhoto,
            aiAnalyzed: true,
            aiConfidence: result.evidence[0]?.confidence || 0,
            aiReasoning: result.overallFinding,
            aiReasoningAr: result.overallFindingAr,
            notes: `SAQR Inspector | Evidence: ${result.evidence.length} photos | Severity: ${result.overallSeverity}`,
          });
        } catch (err) {
          console.error("[Inspector] Save error:", err);
        }
      }
    }

    // Close inspector and complete
    setShowInspector(false);
    completeInspection.mutate({ id: inspectionId });
  };

  const handleDownloadPDF = async () => {
    if (!inspection) return;

    const specResults = inspection.category.specs.map((spec) => ({
      ...spec,
      result: inspection.results.find((r) => r.specId === spec.id),
    }));

    const passCount = specResults.filter((s) => s.result?.status === "PASS").length;
    const failCount = specResults.filter((s) => s.result?.status === "FAIL").length;

    setIsGeneratingPDF(true);
    try {
      await generateInspectionPDF({
        id: inspection.id,
        status: inspection.status,
        startedAt: inspection.startedAt?.toISOString() || null,
        completedAt: inspection.completedAt?.toISOString() || null,
        passRate: inspection.passRate,
        totalItems: specResults.length,
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
        results: specResults.map((spec) => ({
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

  // ========== RENDER ==========

  if (!isReady) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  // ========== FULL SCREEN SAQR INSPECTOR ==========
  if (showInspector && inspectionId && inspection) {
    return (
      <SaqrInspector
        specs={specs}
        authorityName={inspection.category.authority.name}
        authorityNameAr={inspection.category.authority.nameAr}
        onComplete={handleInspectorComplete}
        onBack={() => {
          setShowInspector(false);
          refetchInspection();
        }}
      />
    );
  }

  // ========== MAIN DASHBOARD VIEW ==========
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
            3. Inspect | فحص
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
                        <div className="text-xs text-zinc-500 mt-1">{cat._count?.specs || 0} specs</div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-600" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Step 3: Inspection Ready */}
        {currentStep === 3 && (
          <section className="space-y-4">
            {loadingInspection ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
            ) : !inspection ? (
              <div className="text-center py-12 text-zinc-500">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Inspection not found | <span dir="rtl">لم يتم العثور على الفحص</span></p>
              </div>
            ) : (
              <div className="text-center py-8">
                {/* Authority + Category Info */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div className={`px-3 py-1.5 rounded-lg ${authorityColors[inspection.category.authority.code] || "bg-zinc-600"}`}>
                    <span className="text-white font-bold text-sm">{inspection.category.authority.code}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                  <span className="text-white">{inspection.category.name}</span>
                </div>

                {/* Specs count */}
                <div className="mb-8">
                  <div className="text-6xl font-bold text-amber-500 mb-2">{specs.length}</div>
                  <div className="text-zinc-400">specifications to inspect</div>
                  <div className="text-zinc-500" dir="rtl">مواصفات للفحص</div>
                </div>

                {/* Start button */}
                <button
                  onClick={() => setShowInspector(true)}
                  className="w-full max-w-md mx-auto py-5 rounded-xl font-bold text-xl flex items-center justify-center gap-3 shadow-lg"
                  style={{ backgroundColor: "#c8a84e", color: "#0a0f1a" }}
                >
                  <Shield className="w-6 h-6" />
                  <span>Start SAQR Inspection</span>
                </button>
                <p className="text-zinc-500 mt-2" dir="rtl">ابدأ فحص صقر</p>

                {/* Download PDF (if already has results) */}
                {inspection.results.length > 0 && (
                  <button
                    onClick={handleDownloadPDF}
                    disabled={isGeneratingPDF}
                    className="mt-6 px-6 py-3 rounded-lg bg-zinc-800 text-white flex items-center gap-2 mx-auto disabled:opacity-50"
                  >
                    {isGeneratingPDF ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Download Previous Report
                  </button>
                )}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 p-4 text-center text-xs text-zinc-600 flex items-center justify-center gap-2">
        <Shield className="w-3 h-3" />
        <span>Saqr v{VERSION}</span>
      </footer>
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
