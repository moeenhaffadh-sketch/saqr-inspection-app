import Link from "next/link";
import Image from "next/image";
import { TRPCProvider } from "@/lib/trpc/provider";

// Header + dashboard style layout for remote inspections
export default function RemoteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TRPCProvider>
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
        {/* Header */}
        <header className="border-b border-zinc-800 bg-black/50 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-blue-500/50">
                <Image src="/landing-falcon.png" alt="Saqr" width={40} height={40} className="object-cover w-full h-full" />
              </div>
              <div>
                <h1 className="text-lg font-bold">Saqr Remote</h1>
                <p className="text-xs text-zinc-500">Remote Inspection Portal</p>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-xs text-zinc-500">بوابة التفتيش عن بُعد</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-zinc-800 px-4 py-4 text-center text-xs text-zinc-600">
          Saqr Remote Inspection Portal v0.1.0
        </footer>
      </div>
    </TRPCProvider>
  );
}
