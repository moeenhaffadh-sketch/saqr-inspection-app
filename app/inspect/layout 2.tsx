import { TRPCProvider } from "@/lib/trpc/provider";

// Full-screen camera-optimized layout for field inspectors
export default function InspectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TRPCProvider>
      <div className="min-h-screen bg-black">
        {children}
      </div>
    </TRPCProvider>
  );
}
