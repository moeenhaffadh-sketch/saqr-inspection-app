"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Shield,
  Loader2,
} from "lucide-react";
import Link from "next/link";

const authorityColors: Record<string, string> = {
  MOH: "bg-green-900/30 border-green-500/50 hover:bg-green-900/50",
  MOIC: "bg-blue-900/30 border-blue-500/50 hover:bg-blue-900/50",
  GDCD: "bg-red-900/30 border-red-500/50 hover:bg-red-900/50",
  NHRA: "bg-purple-900/30 border-purple-500/50 hover:bg-purple-900/50",
  MUN: "bg-amber-900/30 border-amber-500/50 hover:bg-amber-900/50",
};

const authorityTextColors: Record<string, string> = {
  MOH: "text-green-400",
  MOIC: "text-blue-400",
  GDCD: "text-red-400",
  NHRA: "text-purple-400",
  MUN: "text-amber-400",
};

export default function NewInspectionPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedAuthority, setSelectedAuthority] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: authorities, isLoading: loadingAuthorities } = trpc.inspection.getAuthorities.useQuery({
    country: "BH",
  });

  const createInspection = trpc.inspection.create.useMutation({
    onSuccess: (inspection) => {
      // Go directly to the unified Inspection Dashboard
      router.push(`/inspect?inspection=${inspection.id}`);
    },
    onError: (error) => {
      console.error("Failed to create inspection:", error);
      alert(`Error: ${error.message}`);
    },
  });

  const selectedAuthorityData = authorities?.find((a) => a.id === selectedAuthority) as any;
  const selectedCategoryData = selectedAuthorityData?.categories?.find(
    (c: any) => c.id === selectedCategory
  );

  const handleStartInspection = () => {
    if (!selectedCategory) return;

    createInspection.mutate({
      categoryId: selectedCategory,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/inspections"
          className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Inspection</h1>
          <p className="text-zinc-400">تفتيش جديد</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {[
          { num: 1, label: "Authority", labelAr: "الجهة" },
          { num: 2, label: "Category", labelAr: "الفئة" },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                step === s.num
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/50"
                  : step > s.num
                  ? "bg-green-500/20 text-green-400 border border-green-500/50"
                  : "bg-zinc-800 text-zinc-500 border border-zinc-700"
              }`}
            >
              {step > s.num ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <span className="w-4 h-4 flex items-center justify-center text-xs font-bold">
                  {s.num}
                </span>
              )}
              <span className="text-sm font-medium">{s.label}</span>
            </div>
            {i < 1 && (
              <ArrowRight className="w-4 h-4 mx-2 text-zinc-600" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select Authority */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              Select Regulatory Authority
            </CardTitle>
            <CardDescription>اختر الجهة التنظيمية</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAuthorities ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {authorities?.map((authority: any) => (
                  <button
                    key={authority.id}
                    onClick={() => setSelectedAuthority(authority.id)}
                    className={`p-6 rounded-xl border-2 text-left transition-all ${
                      selectedAuthority === authority.id
                        ? `${authorityColors[authority.code]} ring-2 ring-offset-2 ring-offset-black ring-amber-500`
                        : `bg-zinc-900 border-zinc-700 hover:border-zinc-600`
                    }`}
                  >
                    <p
                      className={`text-2xl font-bold ${
                        authorityTextColors[authority.code] || "text-white"
                      }`}
                    >
                      {authority.code}
                    </p>
                    <p className="text-sm text-zinc-300 mt-1">{authority.name}</p>
                    <p className="text-sm text-zinc-500" dir="rtl">
                      {authority.nameAr}
                    </p>
                    <p className="text-xs text-zinc-500 mt-2">
                      {authority.categories?.length || 0} categories
                    </p>
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end mt-6">
              <Button
                variant="primary"
                disabled={!selectedAuthority}
                onClick={() => setStep(2)}
              >
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Category */}
      {step === 2 && selectedAuthorityData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-400" />
                  Select Inspection Category
                </CardTitle>
                <CardDescription>اختر فئة التفتيش</CardDescription>
              </div>
              <Badge
                className={`${
                  authorityColors[selectedAuthorityData.code]
                } border ${authorityTextColors[selectedAuthorityData.code]}`}
              >
                {selectedAuthorityData.code}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedAuthorityData?.categories?.map((category: any) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`p-5 rounded-xl border-2 text-left transition-all ${
                    selectedCategory === category.id
                      ? "bg-amber-500/20 border-amber-500 ring-2 ring-offset-2 ring-offset-black ring-amber-500"
                      : "bg-zinc-900 border-zinc-700 hover:border-zinc-600"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{category.name}</p>
                      <p className="text-sm text-zinc-400" dir="rtl">
                        {category.nameAr}
                      </p>
                    </div>
                    <Badge variant="secondary" className="ml-2">
                      {category._count.specs} items
                    </Badge>
                  </div>
                  {category.description && (
                    <p className="text-xs text-zinc-500 mt-2 line-clamp-2">
                      {category.description}
                    </p>
                  )}
                </button>
              ))}
            </div>

            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button
                variant="primary"
                disabled={!selectedCategory || createInspection.isPending}
                onClick={handleStartInspection}
              >
                {createInspection.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    Start Inspection <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Preview */}
      {(selectedAuthority || selectedCategory) && (
        <Card className="bg-zinc-900/50">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
              Inspection Summary
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedAuthorityData && (
                <Badge
                  className={`${
                    authorityColors[selectedAuthorityData.code]
                  } border ${authorityTextColors[selectedAuthorityData.code]}`}
                >
                  {selectedAuthorityData.code}: {selectedAuthorityData.name}
                </Badge>
              )}
              {selectedCategoryData && (
                <Badge variant="secondary">
                  {selectedCategoryData.name} ({selectedCategoryData._count.specs}{" "}
                  items)
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
