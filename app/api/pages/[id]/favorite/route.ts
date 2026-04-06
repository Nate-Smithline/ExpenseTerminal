/* eslint-disable @typescript-eslint/no-explicit-any -- pages/favorites tables not fully typed */
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

async function assertPageInOrg(supabase: any, orgId: string, pageId: string) {
  const { data, error } = await (supabase as any)
    .from("pages")
    .select("id")
    .eq("id", pageId)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false as const, status: 500, body: { error: safeErrorMessage(error.message) } };
  if (!data) return { ok: false as const, status: 404, body: { error: "Page not found" } };
  return { ok: true as const };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
    const { id: pageId } = await ctx.params;

    const access = await assertPageInOrg(supabase, orgId, pageId);
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });

    const now = new Date().toISOString();
    const { error } = await (supabase as any).from("page_favorites").insert({
      user_id: userId,
      page_id: pageId,
      created_at: now,
    });

    if (error) {
      const msg = String(error.message ?? "");
      if (msg.includes("duplicate") || msg.includes("unique") || error.code === "23505") {
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json(
        { error: safeErrorMessage(error.message, "Failed to favorite") },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to favorite" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
    const { id: pageId } = await ctx.params;

    const { error } = await (supabase as any)
      .from("page_favorites")
      .delete()
      .eq("user_id", userId)
      .eq("page_id", pageId);

    if (error) {
      return NextResponse.json(
        { error: safeErrorMessage(error.message, "Failed to unfavorite") },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to unfavorite" },
      { status: 500 }
    );
  }
}
