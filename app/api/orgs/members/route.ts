/* eslint-disable @typescript-eslint/no-explicit-any -- pages/orgs tables not fully typed */
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";

async function resolveOrgId(supabase: any, userId: string): Promise<string> {
  const existing = await getActiveOrgId(supabase, userId);
  if (existing) return existing;
  return await ensureActiveOrgForUser(userId);
}

export async function GET(req: Request) {
  try {
    const authClient = await createSupabaseRouteClient();
    const auth = await requireAuth(authClient);
    if (!auth.authorized) {
      return NextResponse.json(auth.body, { status: auth.status });
    }
    const userId = auth.userId;
    const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
    if (!rlOk) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const supabase = authClient;

    const orgId = await resolveOrgId(supabase, userId);

    const { data: rows, error } = await (supabase as any)
      .from("org_memberships")
      .select("user_id, role")
      .eq("org_id", orgId);

    if (error) {
      return NextResponse.json(
        { error: safeErrorMessage(error.message, "Failed to load members") },
        { status: 500 }
      );
    }

    const userIds = [...new Set((rows ?? []).map((r: { user_id: string }) => r.user_id))];
    if (userIds.length === 0) {
      return NextResponse.json({ members: [] });
    }

    const { data: profiles, error: pErr } = await (supabase as any)
      .from("profiles")
      .select("id, email, display_name, avatar_url")
      .in("id", userIds);

    if (pErr) {
      return NextResponse.json(
        { error: safeErrorMessage(pErr.message, "Failed to load profiles") },
        { status: 500 }
      );
    }

    const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const members = (rows ?? []).map((r: { user_id: string; role: string }) => {
      const p = profileById.get(r.user_id) as
        | { email?: string | null; display_name?: string | null; avatar_url?: string | null }
        | undefined;
      return {
        id: r.user_id,
        role: r.role,
        email: p?.email ?? null,
        display_name: p?.display_name ?? null,
        avatar_url: p?.avatar_url ?? null,
      };
    });

    return NextResponse.json({ members });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load members" },
      { status: 500 }
    );
  }
}
