/* eslint-disable @typescript-eslint/no-explicit-any -- pages tables not fully typed */
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";
import { pageSharePatchSchema, pageShareInviteSchema } from "@/lib/validation/schemas";

async function resolveOrgId(supabase: any, userId: string): Promise<string> {
  const existing = await getActiveOrgId(supabase, userId);
  if (existing) return existing;
  return await ensureActiveOrgForUser(userId);
}

async function loadPage(supabase: any, orgId: string, pageId: string) {
  const { data, error } = await (supabase as any)
    .from("pages")
    .select("id, org_id, visibility, created_by")
    .eq("id", pageId)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { error: safeErrorMessage(error.message), data: null };
  if (!data) return { error: "Page not found", data: null };
  return { error: null, data };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

    const { data: page, error: pageErr } = await loadPage(supabase, orgId, pageId);
    if (pageErr || !page) {
      return NextResponse.json({ error: pageErr ?? "Page not found" }, { status: pageErr === "Page not found" ? 404 : 500 });
    }

    const { data: memberRows } = await (supabase as any)
      .from("page_members")
      .select("user_id, role, created_at")
      .eq("page_id", pageId);

    const ids = new Set<string>([page.created_by]);
    (memberRows ?? []).forEach((m: { user_id: string }) => ids.add(m.user_id));

    const { data: profiles } = await (supabase as any)
      .from("profiles")
      .select("id, email, display_name, avatar_url")
      .in("id", [...ids]);

    type Prof = {
      id: string;
      email: string | null;
      display_name: string | null;
      avatar_url: string | null;
    };
    const profById = new Map<string, Prof>((profiles ?? []).map((p: Prof) => [p.id, p]));

    const creatorProfile = profById.get(page.created_by);
    const people: Array<{
      user_id: string;
      role: string;
      email: string | null;
      display_name: string | null;
      is_creator: boolean;
    }> = [
      {
        user_id: page.created_by,
        role: "owner",
        email: creatorProfile?.email ?? null,
        display_name: creatorProfile?.display_name ?? null,
        is_creator: true,
      },
    ];

    for (const m of memberRows ?? []) {
      if (m.user_id === page.created_by) continue;
      const p = profById.get(m.user_id);
      people.push({
        user_id: m.user_id,
        role: m.role ?? "full_access",
        email: p?.email ?? null,
        display_name: p?.display_name ?? null,
        is_creator: false,
      });
    }

    return NextResponse.json({
      visibility: page.visibility,
      current_user_id: userId,
      people,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load share settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

    const { data: page, error: pageErr } = await loadPage(supabase, orgId, pageId);
    if (pageErr || !page) {
      return NextResponse.json({ error: pageErr ?? "Page not found" }, { status: pageErr === "Page not found" ? 404 : 500 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const parsed = pageSharePatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().formErrors[0] ?? "Invalid body" }, { status: 400 });
    }

    const { data: updated, error } = await (supabase as any)
      .from("pages")
      .update({
        visibility: parsed.data.visibility,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pageId)
      .eq("org_id", orgId)
      .select("id, visibility")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: safeErrorMessage(error.message, "Failed to update visibility") },
        { status: 500 }
      );
    }
    if (!updated) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    return NextResponse.json({ visibility: updated.visibility });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update share settings" },
      { status: 500 }
    );
  }
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

    const { data: page, error: pageErr } = await loadPage(supabase, orgId, pageId);
    if (pageErr || !page) {
      return NextResponse.json({ error: pageErr ?? "Page not found" }, { status: pageErr === "Page not found" ? 404 : 500 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const parsed = pageShareInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().formErrors[0] ?? "Invalid body" }, { status: 400 });
    }

    const rawIds: string[] = [];
    if (parsed.data.user_id) rawIds.push(parsed.data.user_id);
    if (parsed.data.user_ids?.length) rawIds.push(...parsed.data.user_ids);
    const inviteIds = [...new Set(rawIds)].filter((id) => id && id !== page.created_by);
    if (inviteIds.length === 0) {
      return NextResponse.json({ error: "user_id or user_ids required" }, { status: 400 });
    }

    const { data: memberships } = await (supabase as any)
      .from("org_memberships")
      .select("user_id")
      .eq("org_id", orgId)
      .in("user_id", inviteIds);

    const allowed = new Set((memberships ?? []).map((m: { user_id: string }) => m.user_id));
    const toAdd = inviteIds.filter((id) => allowed.has(id));
    if (toAdd.length === 0) {
      return NextResponse.json({ error: "No valid org members to invite" }, { status: 400 });
    }

    const now = new Date().toISOString();
    for (const uid of toAdd) {
      const { error: insErr } = await (supabase as any).from("page_members").insert({
        page_id: pageId,
        user_id: uid,
        role: "full_access",
        created_at: now,
      });
      if (insErr && (insErr as { code?: string }).code !== "23505") {
        return NextResponse.json(
          { error: safeErrorMessage(insErr.message, "Failed to invite") },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true, invited: toAdd });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to invite" },
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
    const orgId = await resolveOrgId(supabase, userId);
    const { id: pageId } = await ctx.params;

    const url = new URL(req.url);
    const targetUserId = url.searchParams.get("user_id");
    if (!targetUserId) {
      return NextResponse.json({ error: "user_id query required" }, { status: 400 });
    }

    const { data: page, error: pageErr } = await loadPage(supabase, orgId, pageId);
    if (pageErr || !page) {
      return NextResponse.json({ error: pageErr ?? "Page not found" }, { status: pageErr === "Page not found" ? 404 : 500 });
    }

    if (targetUserId === page.created_by) {
      return NextResponse.json({ error: "Cannot remove page owner" }, { status: 400 });
    }

    const { error } = await (supabase as any)
      .from("page_members")
      .delete()
      .eq("page_id", pageId)
      .eq("user_id", targetUserId);

    if (error) {
      return NextResponse.json(
        { error: safeErrorMessage(error.message, "Failed to remove access") },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to remove access" },
      { status: 500 }
    );
  }
}
