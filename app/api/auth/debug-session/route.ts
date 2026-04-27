import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { requireWorkspaceIdServer } from "@/lib/workspaces/server";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = await createSupabaseRouteClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  const userId = await getCurrentUserId(supabase as any);

  let workspace:
    | { ok: true; workspaceId: string }
    | { ok: false; error: string; status?: number }
    | null = null;
  if (userId) {
    const res = await requireWorkspaceIdServer(supabase as any, userId);
    workspace =
      "error" in res
        ? { ok: false, error: res.error, status: res.status }
        : { ok: true, workspaceId: res.workspaceId };
  }

  const allCookies = cookieStore.getAll().map((c) => ({
    name: c.name,
    len: c.value?.length ?? 0,
  }));

  return NextResponse.json({
    now: new Date().toISOString(),
    env: {
      has_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      url_host: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
        : null,
      has_publishable_key: !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    },
    auth: {
      hasUser: !!user,
      userId: user?.id ?? null,
      email: user?.email ?? null,
      email_confirmed_at: (user as any)?.email_confirmed_at ?? null,
      user_metadata_email_confirm:
        (user?.user_metadata as any)?.email_confirm ?? null,
      error: userError?.message ?? null,
    },
    cookies: allCookies,
    app: {
      getCurrentUserId: userId,
      et_workspace_cookie: cookieStore.get("et_workspace")?.value ?? null,
      workspace,
    },
  });
}

