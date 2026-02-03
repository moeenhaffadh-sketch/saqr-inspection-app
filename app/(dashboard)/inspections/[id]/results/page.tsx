// LOCKED v0.1.0 - Do not modify without approval
// Completion dashboard with results and retake
"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2,
  Download,
  Share2,
  ClipboardCheck,
  Calendar,
  MapPin,
  Building2,
  Sparkles,
  Clock,
  RotateCcw,
  Camera,
} from "lucide-react";
import Link from "next/link";
import { generateInspectionPDF } from "@/lib/utils/generatePDF";

const VERSION = '0.2.0';

type FilterType = "ALL" | "PASS" | "FAIL" | "UNCERTAIN" | "PENDING";

const statusConfig = {
  PASS: {
    icon: CheckCircle2,
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    bgColor: "bg-green-500",
    label: "Pass",
    labelAr: "ناجح",
  },
  FAIL: {
    icon: XCircle,
    color: "bg-red-500/20 text-red-400 border-red-500/30",
    bgColor: "bg-red-500",
    label: "Fail",
    labelAr: "غير مرضي",
  },
  UNCERTAIN: {
    icon: HelpCircle,
    color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    bgColor: "bg-amber-500",
    label: "Uncertain",
    labelAr: "غير متأكد",
  },
};

export default function InspectionResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [filter, setFilter] = useState<FilterType>("ALL");

  const { data: inspection, isLoading } = trpc.inspection.getById.useQuery({ id });

  // Handle retake - navigate to inspection page with specific spec index
  const handleRetake = (specIndex: number) => {
    router.push(`/inspections/${id}?retake=${specIndex}`);
  };

  const handleDownloadPDF = async () => {
    if (!inspection) return;

    setIsGeneratingPDF(true);
    try {
      // Transform the inspection data for the PDF generator
      const pdfData = {
        id: inspection.id,
        status: inspection.status,
        startedAt: inspection.startedAt?.toString() || null,
        completedAt: inspection.completedAt?.toString() || null,
        passRate: inspection.passRate,
        totalItems: inspection.totalItems,
        passedItems: inspection.passedItems,
        failedItems: inspection.failedItems,
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
        // Include ALL specs, not just ones with results (for pending items)
        // SKIPPED is treated as pending (null status)
        results: inspection.category.specs.map((spec) => {
          const result = inspection.results.find((r) => r.specId === spec.id);
          const status = result?.status === "SKIPPED" ? null : result?.status;
          return {
            id: result?.id || spec.id,
            status: (status as "PASS" | "FAIL" | "UNCERTAIN" | null) || null,
            notes: result?.notes || null,
            photoUrl: result?.photoUrl || null,
            aiAnalyzed: result?.aiAnalyzed || false,
            aiConfidence: result?.aiConfidence || null,
            aiReasoning: result?.aiReasoning || null,
            aiReasoningAr: result?.aiReasoningAr || null,
            spec: {
              code: spec.code,
              requirement: spec.requirement,
              requirementAr: spec.requirementAr,
            },
          };
        }),
      };

      await generateInspectionPDF(pdfData);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleShare = async () => {
    if (!inspection) return;

    const shareUrl = window.location.href;
    const shareText = `Inspection Report: ${inspection.category.name} - ${Math.round(inspection.passRate || 0)}% Pass Rate`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Saqr Inspection Report",
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or share failed
        console.log("Share cancelled");
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        alert("Link copied to clipboard!");
      } catch (err) {
        alert("Failed to copy link");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-400">Inspection not found</p>
        <p className="text-zinc-400 text-sm mb-4" dir="rtl">التفتيش غير موجود</p>
        <Link href="/inspections" className="text-amber-400 hover:underline mt-2 inline-block">
          Back to inspections / العودة للتفتيشات
        </Link>
      </div>
    );
  }

  const results = inspection.results || [];
  const allSpecs = inspection.category.specs || [];
  const totalItems = allSpecs.length;

  // Count by status from results (SKIPPED treated as pending)
  const passCount = results.filter((r) => r.status === "PASS").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;
  const uncertainCount = results.filter((r) => r.status === "UNCERTAIN").length;
  const totalAnswered = passCount + failCount + uncertainCount;

  // Pending = specs without pass/fail/uncertain (including skipped)
  const pendingCount = totalItems - totalAnswered;

  // Completion rate = completed / total specs
  const completionRate = totalItems > 0 ? Math.round((totalAnswered / totalItems) * 100) : 0;

  // Pass rate = pass / (pass + fail) - definitive results only
  const definitiveItems = passCount + failCount;
  const passRate = definitiveItems > 0 ? Math.round((passCount / definitiveItems) * 100) : 0;

  const passRateColor =
    passRate >= 80 ? "text-green-400" : passRate >= 60 ? "text-amber-400" : "text-red-400";
  const passRateBg =
    passRate >= 80 ? "bg-green-500" : passRate >= 60 ? "bg-amber-500" : "bg-red-500";

  const completionColor =
    completionRate === 100 ? "text-green-400" : completionRate >= 50 ? "text-amber-400" : "text-red-400";
  const completionBg =
    completionRate === 100 ? "bg-green-500" : completionRate >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-2 sm:px-4 pb-6">
      {/* Header - Bilingual */}
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/inspections" className="p-2 rounded-lg hover:bg-zinc-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Inspection Results</h1>
            <p className="text-sm" dir="rtl">نتائج التفتيش</p>
          </div>
        </div>
        <Badge
          variant={inspection.status === "COMPLETED" ? "success" : "warning"}
          className="text-sm"
        >
          {inspection.status.replace("_", " ")}
        </Badge>
      </div>

      {/* Score Card - Bilingual */}
      <Card className="overflow-hidden">
        <div className={`h-2 ${completionBg}`} />
        <CardContent className="p-4 sm:p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8">
            {/* Two Rate Circles */}
            <div className="flex gap-4 sm:gap-6">
              {/* Completion Rate Circle */}
              <div className="flex flex-col items-center">
                <div className="relative w-24 h-24 sm:w-32 sm:h-32">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="none" className="text-zinc-800" />
                    <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="none"
                      strokeDasharray={`${(completionRate / 100) * 440} 440`} strokeLinecap="round" className={completionColor} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl sm:text-3xl font-bold ${completionColor}`}>{completionRate}%</span>
                    <span className="text-[10px] sm:text-xs text-zinc-400">Complete</span>
                    <span className="text-[8px] sm:text-[10px] text-zinc-400" dir="rtl">الإنجاز</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-1">{totalAnswered}/{totalItems} items</p>
                <p className="text-[10px] text-zinc-500" dir="rtl">{totalAnswered}/{totalItems} عناصر</p>
              </div>

              {/* Pass Rate Circle */}
              <div className="flex flex-col items-center">
                <div className="relative w-24 h-24 sm:w-32 sm:h-32">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="none" className="text-zinc-800" />
                    <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="none"
                      strokeDasharray={`${(passRate / 100) * 440} 440`} strokeLinecap="round" className={passRateColor} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl sm:text-3xl font-bold ${passRateColor}`}>{passRate}%</span>
                    <span className="text-[10px] sm:text-xs text-zinc-400">Pass Rate</span>
                    <span className="text-[8px] sm:text-[10px] text-zinc-400" dir="rtl">نسبة النجاح</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-1">{passCount} pass / {failCount} fail</p>
                <p className="text-[10px] text-zinc-500" dir="rtl">{passCount} ناجح / {failCount} غير مرضي</p>
              </div>
            </div>

            {/* Stats Grid - Bilingual */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 flex-1 w-full md:w-auto">
              {[
                { status: "PASS" as const, count: passCount, labelAr: "ناجح" },
                { status: "FAIL" as const, count: failCount, labelAr: "غير مرضي" },
                { status: "UNCERTAIN" as const, count: uncertainCount, labelAr: "غير متأكد" },
                { status: "PENDING" as const, count: pendingCount, labelAr: "معلّق" },
              ].map(({ status, count, labelAr }) => {
                const config = status === "PENDING"
                  ? { icon: Clock, color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Pending" }
                  : statusConfig[status];
                const Icon = config.icon;
                return (
                  <div
                    key={status}
                    className={`p-2 sm:p-3 rounded-xl border ${config.color}`}
                  >
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="font-medium text-xs sm:text-sm">{config.label}</span>
                    </div>
                    <p className="text-xs" dir="rtl">{labelAr}</p>
                    <p className="text-lg sm:text-xl font-bold mt-1">{count}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inspection Details - Bilingual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Inspection Details</CardTitle>
          <CardDescription dir="rtl">تفاصيل التفتيش</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
              <ClipboardCheck className="w-5 h-5 text-zinc-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-zinc-400">Category / الفئة</p>
                <p className="font-medium text-sm sm:text-base truncate">{inspection.category.name}</p>
                <p className="text-xs truncate" dir="rtl">{inspection.category.nameAr}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
              <Building2 className="w-5 h-5 text-zinc-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-zinc-400">Authority / الجهة</p>
                <p className="font-medium text-sm sm:text-base truncate">
                  {inspection.category.authority.code} - {inspection.category.authority.name}
                </p>
                <p className="text-xs truncate" dir="rtl">{inspection.category.authority.nameAr}</p>
              </div>
            </div>
            {inspection.site && (
              <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                <MapPin className="w-5 h-5 text-zinc-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-zinc-400">Site / الموقع</p>
                  <p className="font-medium text-sm sm:text-base truncate">{inspection.site.name}</p>
                  <p className="text-xs truncate" dir="rtl">{inspection.site.nameAr}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
              <Calendar className="w-5 h-5 text-zinc-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-zinc-400">Completed / مكتمل</p>
                <p className="font-medium text-sm sm:text-base">
                  {inspection.completedAt
                    ? new Date(inspection.completedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "In Progress / قيد التنفيذ"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results - Bilingual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Detailed Results</CardTitle>
          <CardDescription dir="rtl">النتائج التفصيلية</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filter Tabs - Bilingual */}
          <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-zinc-800">
            {[
              { key: "ALL" as FilterType, label: "All", labelAr: "الكل", count: inspection.category.specs.length },
              { key: "PASS" as FilterType, label: "Pass", labelAr: "ناجح", count: passCount, color: "bg-green-600" },
              { key: "FAIL" as FilterType, label: "Fail", labelAr: "غير مرضي", count: failCount, color: "bg-red-600" },
              { key: "UNCERTAIN" as FilterType, label: "Uncertain", labelAr: "غير متأكد", count: uncertainCount, color: "bg-amber-600" },
              { key: "PENDING" as FilterType, label: "Pending", labelAr: "معلّق", count: pendingCount, color: "bg-blue-600" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === tab.key
                    ? tab.color ? `${tab.color} text-white` : "bg-white text-black"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                <span className="inline-flex items-center gap-1"><span>{tab.label}</span><span>|</span><span>{tab.labelAr}</span></span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  filter === tab.key ? "bg-white/20" : "bg-zinc-700"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {inspection.category.specs
              .filter((spec) => {
                const result = results.find((r) => r.specId === spec.id);
                const status = result?.status;
                if (filter === "ALL") return true;
                // Treat SKIPPED as PENDING (needs evidence)
                if (filter === "PENDING") return !status || status === "SKIPPED";
                return status === filter;
              })
              .map((spec, filteredIndex) => {
              const result = results.find((r) => r.specId === spec.id);
              const status = result?.status;
              // Treat SKIPPED as pending (no config)
              const config = status && status !== "SKIPPED" ? statusConfig[status as keyof typeof statusConfig] : null;
              const Icon = config?.icon;
              // Get the actual index in the full specs array for navigation
              const specIndex = inspection.category.specs.findIndex((s) => s.id === spec.id);

              return (
                <div
                  key={spec.id}
                  className={`p-3 sm:p-4 rounded-lg border transition-colors ${
                    config ? config.color : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {spec.code}
                        </Badge>
                        {result?.aiAnalyzed && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            <Sparkles className="w-3 h-3 mr-1" />
                            AI
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-zinc-200">{spec.requirement}</p>
                      <p className="text-base text-zinc-200 mt-1" dir="rtl">
                        {spec.requirementAr}
                      </p>

                      {/* AI Reasoning - Bilingual */}
                      {result?.aiReasoning && (
                        <div className="mt-2 p-2 bg-black/30 rounded">
                          <div className="flex items-center gap-1 mb-1">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span className="text-xs text-amber-400 font-medium">SAQR AI</span>
                            {result.aiConfidence && (
                              <span className="text-xs text-zinc-500">({Math.round(result.aiConfidence * 100)}%)</span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-300">{result.aiReasoning}</p>
                          {result.aiReasoningAr && (
                            <p className="text-sm text-zinc-300 mt-1" dir="rtl">{result.aiReasoningAr}</p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      {config && Icon ? (
                        <Badge className={`${config.bgColor} text-white text-xs`}>
                          <Icon className="w-3 h-3 mr-1" />
                          <span className="inline-flex items-center gap-1"><span>{config.label}</span><span>|</span><span>{config.labelAr}</span></span>
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-500 text-white text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          <span className="inline-flex items-center gap-1"><span>Pending</span><span>|</span><span>معلّق</span></span>
                        </Badge>
                      )}
                      {/* Retake Button - Bilingual */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetake(specIndex)}
                        className="text-xs h-7 px-2 bg-zinc-800/50 border-zinc-600 hover:bg-zinc-700"
                      >
                        {status ? (
                          <>
                            <RotateCcw className="w-3 h-3 mr-1" />
                            <span className="inline-flex items-center gap-1"><span>Retake</span><span>|</span><span>إعادة</span></span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-3 h-3 mr-1" />
                            <span className="inline-flex items-center gap-1"><span>Inspect</span><span>|</span><span>فحص</span></span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions - Bilingual */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          className="flex-1 min-h-[48px] touch-manipulation"
          onClick={handleDownloadPDF}
          disabled={isGeneratingPDF}
        >
          {isGeneratingPDF ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              <span className="inline-flex items-center gap-1"><span>Generating...</span><span>|</span><span>جاري الإنشاء...</span></span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              <span className="inline-flex items-center gap-1"><span>Download Report</span><span>|</span><span>تحميل التقرير</span></span>
            </>
          )}
        </Button>
        <Button
          variant="outline"
          className="flex-1 min-h-[48px] touch-manipulation"
          onClick={handleShare}
        >
          <Share2 className="w-4 h-4 mr-2" />
          <span className="inline-flex items-center gap-1"><span>Share</span><span>|</span><span>مشاركة</span></span>
        </Button>
        <Button asChild variant="primary" className="flex-1 min-h-[48px] touch-manipulation">
          <Link href="/inspect">
            <ClipboardCheck className="w-4 h-4 mr-2" />
            <span className="inline-flex items-center gap-1"><span>New Inspection</span><span>|</span><span>تفتيش جديد</span></span>
          </Link>
        </Button>
      </div>

      {/* Footer - Version */}
      <div className="text-center text-xs text-zinc-600 pt-4">
        <span>Saqr v{VERSION}</span>
      </div>
    </div>
  );
}
