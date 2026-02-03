import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { TRPCProvider } from "@/lib/trpc/provider";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  ClipboardCheck,
  FileText,
  Settings,
  Building,
  Users
} from "lucide-react";

const navigation = [
  { name: "Dashboard", nameAr: "لوحة التحكم", href: "/dashboard", icon: LayoutDashboard },
  { name: "Inspections", nameAr: "التفتيشات", href: "/inspections", icon: ClipboardCheck },
  { name: "Reports", nameAr: "التقارير", href: "/reports", icon: FileText },
  { name: "Sites", nameAr: "المواقع", href: "/sites", icon: Building },
  { name: "Team", nameAr: "الفريق", href: "/team", icon: Users },
  { name: "Settings", nameAr: "الإعدادات", href: "/settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <TRPCProvider>
        <div className="min-h-screen bg-black text-white">
          {/* Sidebar - hidden on mobile */}
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-zinc-950 border-r border-zinc-800 hidden lg:block">
            {/* Logo */}
            <div className="h-16 flex flex-col justify-center px-6 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">Saqr</span>
                <Image
                  src="/landing-falcon.png"
                  alt="Saqr"
                  width={28}
                  height={28}
                  className="object-contain"
                />
                <span className="text-lg font-bold">صقر</span>
              </div>
              <p className="text-[10px] text-zinc-500">Field Inspector v0.4.0</p>
            </div>

            {/* Navigation */}
            <nav className="p-4 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors group"
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.name}</span>
                </Link>
              ))}
            </nav>

            {/* User section at bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-800">
              <div className="flex items-center gap-3">
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: "w-9 h-9",
                    },
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">Account</p>
                  <p className="text-xs text-zinc-500 truncate">Manage profile</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className="lg:pl-64">
            {/* Top bar */}
            <header className="h-16 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-sm sticky top-0 z-40">
              <div className="h-full px-8 flex items-center justify-between">
                <div>
                  {/* Breadcrumb or page title will go here */}
                </div>
                <div className="flex items-center gap-4">
                  <Link
                    href="/inspections/new"
                    className="bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    New Inspection
                  </Link>
                </div>
              </div>
            </header>

            {/* Page content */}
            <div className="p-8">
              {children}
            </div>
          </main>
        </div>
      </TRPCProvider>
    </ClerkProvider>
  );
}
