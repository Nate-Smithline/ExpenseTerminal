import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { computeTrialStatus } from "@/lib/billing/trial";

type ProfileRow = {
  created_at?: string | null;
};

type SubscriptionRow = {
  status?: string | null;
  current_period_end?: string | null;
};

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/auth",
  "/terms",
  "/privacy",
  "/cookies",
  "/pricing",
  "/request-demo",
  "/brand",
];

const LOCKED_ALLOWED_PATHS = ["/settings/billing"];

const API_ALLOWED_WHEN_LOCKED = [
  "/api/auth",
  "/api/billing",
  "/api/cron",
  "/api/email/notify-signup",
  "/api/email/send-verification",
  "/api/onboarding",
  "/api/request-demo",
  "/api/webhooks",
];

function pathMatches(pathname: string, paths: string[]): boolean {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isPublicPath(pathname: string): boolean {
  return pathMatches(pathname, PUBLIC_PATHS);
}

function isLockedAllowedPath(pathname: string): boolean {
  return pathMatches(pathname, LOCKED_ALLOWED_PATHS);
}

function isAllowedLockedApi(pathname: string): boolean {
  return pathMatches(pathname, API_ALLOWED_WHEN_LOCKED);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (!isApi && (isPublicPath(pathname) || isLockedAllowedPath(pathname))) {
    return NextResponse.next();
  }
  if (isApi && isAllowedLockedApi(pathname)) {
    return NextResponse.next();
  }

  const response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return response;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return response;

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase
      .from("profiles")
      .select("created_at")
      .eq("id", user.id)
      .single<ProfileRow>(),
    supabase
      .from("subscriptions")
      .select("status,current_period_end")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<SubscriptionRow>(),
  ]);

  const trial = computeTrialStatus(
    profile?.created_at ?? "",
    subscription?.status ?? null,
    subscription?.current_period_end ?? null
  );

  if (trial.status === "trial" || trial.status === "subscribed") {
    return response;
  }

  if (isApi) {
    return NextResponse.json(
      { error: "Your free trial has ended. Choose a plan to continue." },
      { status: 402 }
    );
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/settings/billing";
  redirectUrl.search = "";
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|xt-icon.png|apple-icon|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map)$).*)",
  ],
};
