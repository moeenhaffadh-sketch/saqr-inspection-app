"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { TRPCProvider } from "@/lib/trpc/provider";
import {
  LayoutDashboard,
  ClipboardList,
  Video,
  Building2,
  Users,
  FolderTree,
  FileText,
  Globe,
  FileBarChart,
  Settings,
  ArrowLeft
} from "lucide-react";

// Sidebar navigation layout for admin dashboard
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { href: "/admin", label: "Dashboard", labelAr: "لوحة القيادة", icon: LayoutDashboard },
    { href: "/admin/inspections", label: "Inspections", labelAr: "التفتيشات", icon: ClipboardList },
    { href: "/admin/remote-sessions", label: "Remote Sessions", labelAr: "الجلسات عن بُعد", icon: Video },
    { href: "/admin/organizations", label: "Organizations", labelAr: "المؤسسات", icon: Building2 },
    { href: "/admin/users", label: "Users", labelAr: "المستخدمون", icon: Users },
    { href: "/admin/categories", label: "Categories", labelAr: "الفئات", icon: FolderTree },
    { href: "/admin/specs", label: "Specifications", labelAr: "المواصفات", icon: FileText },
    { href: "/admin/countries", label: "Countries", labelAr: "الدول", icon: Globe },
    { href: "/admin/reports", label: "Reports", labelAr: "التقارير", icon: FileBarChart },
    { href: "/admin/settings", label: "Settings", labelAr: "الإعدادات", icon: Settings },
  ];

  return (
    <TRPCProvider>
      <div className="min-h-screen bg-zinc-950 text-white flex">
        {/* Sidebar */}
        <aside className="w-64 bg-black border-r border-zinc-800 flex flex-col">
          {/* Logo */}
          <div className="p-4 border-b border-zinc-800">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-amber-500/50">
                <Image src="/landing-falcon.png" alt="Saqr" width={40} height={40} className="object-cover w-full h-full" />
              </div>
              <div>
                <h1 className="text-lg font-bold">Saqr Admin</h1>
                <p className="text-xs text-zinc-500">لوحة الإدارة</p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? "bg-amber-500/10 text-amber-400"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-xs text-zinc-600">{item.labelAr}</div>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-zinc-800">
            <Link
              href="/"
              className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Top Bar */}
          <header className="h-16 border-b border-zinc-800 px-6 flex items-center justify-between bg-black/50">
            <div className="text-sm text-zinc-500">
              GCC Compliance Platform
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-zinc-600">Admin Portal v0.1.0</span>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 p-6 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </TRPCProvider>
  );
}
