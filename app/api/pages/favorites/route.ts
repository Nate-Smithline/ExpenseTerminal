/* eslint-disable @typescript-eslint/no-explicit-any -- pages table not fully typed */
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

    const { data: favs, error: fErr } = await (supabase as any)
      .from("page_favorites")
      .select("page_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (fErr) {
      return NextResponse.json(
        { error: safeErrorMessage(fErr.message, "Failed to load favorites") },
        { status: 500 }
      );
    }

    const pageIds = (favs ?? []).map((f: { page_id: string }) => f.page_id);
    if (pageIds.length === 0) {
      return NextResponse.json({ pages: [] });
    }

    const { data: pages, error: pErr } = await (supabase as any)
      .from("pages")
      .select("id,title,icon_type,icon_value,icon_color,created_at,updated_at")
      .in("id", pageIds)
      .eq("org_id", orgId)
      .is("deleted_at", null);

    if (pErr) {
      return NextResponse.json(
        { error: safeErrorMessage(pErr.message, "Failed to load pages") },
        { status: 500 }
      );
    }

    const order = new Map<string, number>();
    pageIds.forEach((id: string, i: number) => order.set(id, i));
    const sorted = [...(pages ?? [])].sort(
      (a: { id: string }, b: { id: string }) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
    );

    return NextResponse.json({ pages: sorted });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load favorites" },
      { status: 500 }
    );
  }
}
