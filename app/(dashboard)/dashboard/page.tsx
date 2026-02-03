"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ClipboardCheck,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowRight,
  Building,
  Calendar,
  Loader2,
} from "lucide-react";

const statusColors: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  COMPLETED: "success",
  IN_PROGRESS: "warning",
  PENDING_REVIEW: "secondary",
  DRAFT: "secondary",
};

const authorityColors: Record<string, { bg: string; border: string; text: string }> = {
  MOH: { bg: "bg-green-900/30", border: "border-green-900/50", text: "text-green-400" },
  MOIC: { bg: "bg-blue-900/30", border: "border-blue-900/50", text: "text-blue-400" },
  GDCD: { bg: "bg-red-900/30", border: "border-red-900/50", text: "text-red-400" },
  NHRA: { bg: "bg-purple-900/30", border: "border-purple-900/50", text: "text-purple-400" },
  MUN: { bg: "bg-amber-900/30", border: "border-amber-900/50", text: "text-amber-400" },
};

export default function DashboardPage() {
  const { data: stats, isLoading: loadingStats } = trpc.inspection.getStats.useQuery();
  const { data: recent, isLoading: loadingRecent } = trpc.inspection.getRecent.useQuery({
    limit: 5,
  });
  const { data: authorities, isLoading: loadingAuthorities } = trpc.inspection.getAuthorities.useQuery({
    country: "BH",
  });

  const statCards = [
    {
      label: "Total Inspections",
      labelAr: "إجمالي التفتيشات",
      value: stats?.total ?? 0,
      icon: ClipboardCheck,
      color: "text-blue-400",
    },
    {
      label: "Completed",
      labelAr: "مكتمل",
      value: stats?.completed ?? 0,
      icon: CheckCircle2,
      color: "text-green-400",
    },
    {
      label: "In Progress",
      labelAr: "قيد التنفيذ",
      value: stats?.inProgress ?? 0,
      icon: Clock,
      color: "text-amber-400",
    },
    {
      label: "Pass Rate",
      labelAr: "معدل النجاح",
      value: `${stats?.passRate ?? 0}%`,
      icon: TrendingUp,
      color: "text-emerald-400",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-zinc-400 mt-1">Welcome back. Here&apos;s your inspection overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">{stat.label}</p>
                  {loadingStats ? (
                    <Loader2 className="w-6 h-6 animate-spin text-zinc-500 mt-2" />
                  ) : (
                    <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  )}
                </div>
                <div className={`p-3 rounded-lg bg-zinc-800 ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-amber-900/20 to-amber-950/20 border-amber-900/30">
          <CardContent className="p-6">
            <h3 className="font-semibold text-amber-400">Start New Inspection</h3>
            <p className="text-sm text-zinc-400 mt-1">Begin a compliance check at any registered site</p>
            <Button asChild className="mt-4" variant="primary">
              <Link href="/inspections/new">
                Start Now <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-900/20 to-blue-950/20 border-blue-900/30">
          <CardContent className="p-6">
            <h3 className="font-semibold text-blue-400">Register Site</h3>
            <p className="text-sm text-zinc-400 mt-1">Add a new location for inspections</p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/sites/new">
                Add Site <Building className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/20 to-purple-950/20 border-purple-900/30">
          <CardContent className="p-6">
            <h3 className="font-semibold text-purple-400">Schedule Inspection</h3>
            <p className="text-sm text-zinc-400 mt-1">Plan upcoming compliance reviews</p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/inspections/schedule">
                Schedule <Calendar className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Inspections */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Inspections</CardTitle>
              <CardDescription>Your latest compliance checks</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/inspections">
                View All <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingRecent ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : recent && recent.length > 0 ? (
            <div className="space-y-4">
              {recent.map((inspection) => {
                const authorityCode = inspection.category.authority.code;
                const colors = authorityColors[authorityCode] || authorityColors.MUN;

                return (
                  <Link
                    key={inspection.id}
                    href={
                      inspection.status === "COMPLETED"
                        ? `/inspections/${inspection.id}/results`
                        : `/inspections/${inspection.id}`
                    }
                    className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors.bg} ${colors.border} border`}
                      >
                        <span className={`text-sm font-bold ${colors.text}`}>
                          {authorityCode.substring(0, 2)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">
                          {inspection.site?.name || inspection.category.name}
                        </p>
                        <p className="text-sm text-zinc-400">
                          {inspection.category.name} • {authorityCode}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {inspection.passRate !== null && (
                        <div className="text-right">
                          <p
                            className={`text-lg font-bold ${
                              inspection.passRate >= 80
                                ? "text-green-400"
                                : inspection.passRate >= 60
                                ? "text-amber-400"
                                : "text-red-400"
                            }`}
                          >
                            {Math.round(inspection.passRate)}%
                          </p>
                          <p className="text-xs text-zinc-500">Pass Rate</p>
                        </div>
                      )}
                      <Badge variant={statusColors[inspection.status] || "secondary"}>
                        {inspection.status.replace("_", " ")}
                      </Badge>
                      <span className="text-sm text-zinc-500 w-24 text-right">
                        {new Date(inspection.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <ClipboardCheck className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
              <p className="text-zinc-400">No inspections yet</p>
              <p className="text-sm text-zinc-500 mt-1">Start your first inspection to see it here</p>
              <Button asChild className="mt-4" variant="primary">
                <Link href="/inspections/new">Start First Inspection</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bahrain Authorities Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Bahrain Regulatory Authorities</CardTitle>
          <CardDescription>الجهات التنظيمية في البحرين</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAuthorities ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {authorities?.map((auth: any) => {
                const colors = authorityColors[auth.code] || authorityColors.MUN;
                const categories = auth.categories || [];
                const totalSpecs = categories.reduce(
                  (acc: number, cat: any) => acc + (cat._count?.specs || 0),
                  0
                );

                return (
                  <div
                    key={auth.id}
                    className={`p-4 rounded-lg border ${colors.bg} ${colors.border} text-center`}
                  >
                    <p className={`font-bold text-lg ${colors.text}`}>{auth.code}</p>
                    <p className="text-xs text-zinc-400 mt-1">{auth.name}</p>
                    <p className="text-xs text-zinc-500" dir="rtl">
                      {auth.nameAr}
                    </p>
                    <div className="mt-2 pt-2 border-t border-zinc-700/50">
                      <p className="text-xs text-zinc-500">
                        {categories.length} categories • {totalSpecs} items
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
