import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const res = await updateSession(request);

  // v2 reboot: aggressively prune legacy surfaces.
  const p = request.nextUrl.pathname;

  // Always allow Next internals, public assets, and API routes.
  if (
    p.startsWith("/_next") ||
    p.startsWith("/api") ||
    p === "/favicon.ico" ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|map)$/.test(p)
  ) {
    return res;
  }

  const allowed = [
    "/", // marketing home
    "/about",
    "/how-it-works",
    "/pricing",
    "/login",
    "/signup",
    "/auth/callback",
    "/terms",
    "/privacy",
    "/cookies",
    "/onboarding",
    "/dashboard",
    "/transactions",
    "/deductions",
    "/tax-calendar",
    "/settings",
  ];

  const isAllowed = allowed.some((root) => p === root || p.startsWith(`${root}/`));
  if (!isAllowed) {
    return new NextResponse("Not found", { status: 404 });
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
