import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

const ALLOWED_REDIRECT_PATHS = [
  "/inbox",
  "/dashboard",
  "/reports",
  "/settings",
  "/profile",
  "/preferences",
  "/",
];

function isAllowedRedirect(next: string): boolean {
  const path = next.startsWith("/") ? next : `/${next}`;
  return ALLOWED_REDIRECT_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

/**
 * Supabase redirects here after email confirmation (or OAuth).
 * Exchange the code for a session and send the user to the app.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextParam = requestUrl.searchParams.get("next") ?? "/dashboard";
  const nextNormalized = nextParam.startsWith("/") ? nextParam : `/${nextParam}`;
  const next =
    isAllowedRedirect(nextParam) && !nextNormalized.startsWith("/inbox")
      ? nextParam
      : "/dashboard";

  if (code) {
    const supabase = await createSupabaseRouteClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next.startsWith("/") ? next : `/${next}`, requestUrl.origin));
    }
    console.error("[auth/callback] exchangeCodeForSession error:", error.message);
    return NextResponse.redirect(new URL("/login?error=session_exchange_failed", requestUrl.origin));
  }

  return NextResponse.redirect(new URL("/login", requestUrl.origin));
}
