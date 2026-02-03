"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Download,
  Eye,
  Calendar,
  Building,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { generateInspectionPDF } from "@/lib/utils/generatePDF";

export default function ReportsPage() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: inspections, isLoading } = trpc.inspection.getCompletedForReports.useQuery();

  const utils = trpc.useUtils();

  const handleDownloadPDF = async (inspectionId: string) => {
    setDownloadingId(inspectionId);
    try {
      // Fetch full inspection data for PDF
      const inspection = await utils.inspection.getForPDF.fetch({ id: inspectionId });

      if (!inspection) {
        alert("Inspection not found");
        return;
      }

      // Transform data for PDF generator
      const pdfData = {
        id: inspection.id,
        status: inspection.status,
        startedAt: inspection.startedAt?.toISOString() || null,
        completedAt: inspection.completedAt?.toISOString() || null,
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
        results: inspection.results.map((r: any) => ({
          id: r.id,
          status: r.status as "PASS" | "FAIL" | "UNCERTAIN" | null,
          notes: r.notes,
          photoUrl: r.photoUrl,
          aiAnalyzed: r.aiAnalyzed,
          aiConfidence: r.aiConfidence,
          aiReasoning: r.aiReasoning,
          aiReasoningAr: r.aiReasoningAr || null,
          spec: {
            code: r.spec.code,
            requirement: r.spec.requirement,
            requirementAr: r.spec.requirementAr,
          },
        })),
      };

      await generateInspectionPDF(pdfData);
    } catch (error) {
      console.error("PDF generation error:", error);
      alert("Failed to generate PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  // Calculate stats
  const totalReports = inspections?.length || 0;
  const thisWeekReports = inspections?.filter((i) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return i.completedAt && new Date(i.completedAt) > weekAgo;
  }).length || 0;
  const uniqueSites = new Set(inspections?.map((i) => i.siteId).filter(Boolean)).size;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-zinc-400 mt-1">View and download inspection reports</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-900/30">
                <FileText className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalReports}</p>
                <p className="text-sm text-zinc-400">Total Reports</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-900/30">
                <Calendar className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{thisWeekReports}</p>
                <p className="text-sm text-zinc-400">This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-900/30">
                <Building className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{uniqueSites}</p>
                <p className="text-sm text-zinc-400">Sites Inspected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle>Completed Inspections</CardTitle>
          <CardDescription>PDF compliance reports ready for download</CardDescription>
        </CardHeader>
        <CardContent>
          {inspections && inspections.length > 0 ? (
            <div className="space-y-3">
              {inspections.map((inspection) => {
                const passRate = inspection.passRate ?? 0;
                const isDownloading = downloadingId === inspection.id;

                return (
                  <div
                    key={inspection.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        passRate >= 80 ? 'bg-green-900/30' :
                        passRate >= 60 ? 'bg-amber-900/30' : 'bg-red-900/30'
                      }`}>
                        {passRate >= 80 ? (
                          <CheckCircle2 className="w-6 h-6 text-green-400" />
                        ) : passRate >= 60 ? (
                          <AlertCircle className="w-6 h-6 text-amber-400" />
                        ) : (
                          <XCircle className="w-6 h-6 text-red-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{inspection.site?.name || "No Site"}</p>
                          <Badge variant="outline" className="text-xs">
                            {inspection.category.authority.code}
                          </Badge>
                        </div>
                        <p className="text-sm text-zinc-400 mt-0.5">
                          {inspection.category.name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Pass Rate */}
                      <div className="text-right">
                        <p className={`text-lg font-bold ${
                          passRate >= 80 ? 'text-green-400' :
                          passRate >= 60 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {Math.round(passRate)}%
                        </p>
                        <p className="text-xs text-zinc-500">Pass Rate</p>
                      </div>

                      {/* Date */}
                      <div className="text-right min-w-[140px]">
                        <p className="text-sm text-zinc-300">
                          {inspection.completedAt
                            ? new Date(inspection.completedAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "N/A"}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {inspection.completedAt
                            ? new Date(inspection.completedAt).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : ""}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Link href={`/inspections/${inspection.id}/results`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadPDF(inspection.id)}
                          disabled={isDownloading}
                        >
                          {isDownloading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 mr-2" />
                          )}
                          {isDownloading ? "Generating..." : "Download"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
              <p className="text-zinc-400">No completed inspections yet</p>
              <p className="text-zinc-500 text-sm mt-1">
                Complete an inspection to generate a report
              </p>
              <Link href="/inspections/new">
                <Button className="mt-4 bg-amber-500 hover:bg-amber-400 text-black">
                  Start New Inspection
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
