"use client";

import { trpc } from "@/lib/trpc/client";
import {
  ClipboardList,
  Video,
  Building2,
  Users,
  Plus,
  Clock,
  FileBarChart
} from "lucide-react";

export default function AdminDashboardPage() {
  // Fetch stats
  const { data: stats, isLoading } = trpc.admin.getDashboardStats.useQuery();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-zinc-500">لوحة القيادة الإدارية</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Inspections"
          titleAr="إجمالي التفتيشات"
          value={stats?.totalInspections ?? "-"}
          icon={ClipboardList}
          loading={isLoading}
        />
        <StatCard
          title="Active Sessions"
          titleAr="الجلسات النشطة"
          value={stats?.activeSessions ?? "-"}
          icon={Video}
          loading={isLoading}
          highlight
        />
        <StatCard
          title="Organizations"
          titleAr="المؤسسات"
          value={stats?.totalOrganizations ?? "-"}
          icon={Building2}
          loading={isLoading}
        />
        <StatCard
          title="Users"
          titleAr="المستخدمون"
          value={stats?.totalUsers ?? "-"}
          icon={Users}
          loading={isLoading}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickAction
          title="Start Remote Session"
          titleAr="بدء جلسة عن بُعد"
          description="Create a new remote inspection session"
          href="/admin/remote-sessions/new"
          icon={Plus}
        />
        <QuickAction
          title="View Pending Inspections"
          titleAr="عرض التفتيشات المعلقة"
          description="Review inspections awaiting approval"
          href="/admin/inspections?status=pending"
          icon={Clock}
        />
        <QuickAction
          title="Generate Reports"
          titleAr="إنشاء التقارير"
          description="Download compliance reports"
          href="/admin/reports"
          icon={FileBarChart}
        />
      </div>

      {/* Recent Activity */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <div className="text-zinc-500 text-sm">
          Activity feed coming soon...
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  titleAr,
  value,
  icon: Icon,
  loading,
  highlight,
}: {
  title: string;
  titleAr: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-zinc-900/50 border rounded-lg p-6 ${highlight ? "border-amber-500/50" : "border-zinc-800"}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-zinc-500 text-sm">{title}</div>
          <div className="text-zinc-600 text-xs">{titleAr}</div>
        </div>
        <Icon className="w-6 h-6 text-zinc-600" />
      </div>
      <div className={`text-3xl font-bold mt-3 ${loading ? "animate-pulse" : ""}`}>
        {loading ? "..." : value}
      </div>
    </div>
  );
}

function QuickAction({
  title,
  titleAr,
  description,
  href,
  icon: Icon,
}: {
  title: string;
  titleAr: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <a
      href={href}
      className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 hover:border-zinc-700 transition-colors block"
    >
      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-amber-400" />
      </div>
      <div className="font-semibold">{title}</div>
      <div className="text-xs text-zinc-500 mb-2">{titleAr}</div>
      <div className="text-sm text-zinc-400">{description}</div>
    </a>
  );
}
