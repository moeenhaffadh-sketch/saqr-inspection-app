"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ClipboardCheck,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Loader2,
} from "lucide-react";

const statusConfig: Record<
  string,
  { label: string; variant: "success" | "warning" | "secondary" | "destructive" }
> = {
  COMPLETED: { label: "Completed", variant: "success" },
  IN_PROGRESS: { label: "In Progress", variant: "warning" },
  PENDING_REVIEW: { label: "Pending Review", variant: "secondary" },
  DRAFT: { label: "Draft", variant: "secondary" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
};

export default function InspectionsPage() {
  const { data, isLoading } = trpc.inspection.list.useQuery({ limit: 50 });

  const inspections = data?.inspections || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inspections</h1>
          <p className="text-zinc-400 mt-1">Manage and track all compliance inspections</p>
        </div>
        <Button asChild variant="primary">
          <Link href="/inspections/new">
            <Plus className="w-4 h-4 mr-2" />
            New Inspection
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search inspections..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-zinc-600"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Inspections List */}
      <Card>
        <CardHeader>
          <CardTitle>All Inspections</CardTitle>
          <CardDescription>جميع التفتيشات</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            </div>
          ) : inspections.length > 0 ? (
            <div className="space-y-3">
              {inspections.map((inspection) => {
                const progress =
                  inspection.totalItems > 0
                    ? (inspection.passedItems / inspection.totalItems) * 100
                    : 0;

                return (
                  <Link
                    key={inspection.id}
                    href={
                      inspection.status === "COMPLETED"
                        ? `/inspections/${inspection.id}/results`
                        : `/inspections/${inspection.id}`
                    }
                    className="block p-3 sm:p-4 rounded-lg border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/30 transition-colors group"
                  >
                    {/* Mobile & Desktop Layout */}
                    <div className="flex items-start gap-3">
                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        {/* Title Row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm sm:text-base group-hover:text-amber-400 transition-colors truncate">
                              {inspection.site?.name || inspection.category.name}
                            </p>
                            <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 truncate">
                              {inspection.category.name}
                            </p>
                          </div>

                          {/* Pass Rate - Top Right */}
                          {inspection.passRate !== null && (
                            <div className="text-right shrink-0">
                              <p
                                className={`text-lg sm:text-xl font-bold ${
                                  inspection.passRate >= 80
                                    ? "text-green-400"
                                    : inspection.passRate >= 60
                                    ? "text-amber-400"
                                    : "text-red-400"
                                }`}
                              >
                                {Math.round(inspection.passRate)}%
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Bottom Row - Status, Date, Progress */}
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant={statusConfig[inspection.status]?.variant || "secondary"}
                              className="text-[10px] sm:text-xs"
                            >
                              {statusConfig[inspection.status]?.label || inspection.status}
                            </Badge>
                            <span className="text-[10px] sm:text-xs text-zinc-500">
                              {new Date(inspection.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>

                          {/* Progress */}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] sm:text-xs text-zinc-400">
                              {inspection.passedItems}/{inspection.totalItems}
                            </span>
                            <div className="w-12 sm:w-16 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <ClipboardCheck className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
              <p className="text-zinc-400">No inspections yet</p>
              <p className="text-sm text-zinc-500 mt-1">
                Start your first inspection to see it here
              </p>
              <Button asChild className="mt-4" variant="primary">
                <Link href="/inspections/new">
                  <Plus className="w-4 h-4 mr-2" />
                  Start First Inspection
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
