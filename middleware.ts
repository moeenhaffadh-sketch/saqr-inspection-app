import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// DEVELOPMENT MODE: Skip all auth for mobile testing
// TODO: Re-enable Clerk auth for production
export default function middleware(req: NextRequest) {
  // Allow all requests through without auth check
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
