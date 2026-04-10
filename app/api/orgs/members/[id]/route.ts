import { NextResponse } from "next/server";
import { createSupabaseRouteClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";
import { uuidSchema } from "@/lib/validation/schemas";

async function resolveOrgId(supabase: any, userId: string): Promise<string | null> {
  let orgId = await getActiveOrgId(supabase, userId);
  if (orgId) return orgId;
  try {
    return await ensureActiveOrgForUser(userId);
  } catch {
    return null;
  }
}

/** DELETE: remove a member from the active workspace (owners only). */
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

    const { id: targetUserId } = await ctx.params;
    if (!uuidSchema.safeParse(targetUserId).success) {
      return NextResponse.json({ error: "Invalid member id" }, { status: 400 });
    }

    const orgId = await resolveOrgId(authClient as any, userId);
    if (!orgId) {
      return NextResponse.json({ error: "No active workspace" }, { status: 400 });
    }

    const { data: actorMem, error: actorErr } = await (authClient as any)
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (actorErr || actorMem?.role !== "owner") {
      return NextResponse.json({ error: "Only workspace owners can remove members" }, { status: 403 });
    }

    const svc = createSupabaseServiceClient();

    const { data: targetMem, error: tErr } = await (svc as any)
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (tErr || !targetMem) {
      return NextResponse.json({ error: "Member not found in this workspace" }, { status: 404 });
    }

    if (targetMem.role === "owner") {
      const { count, error: cErr } = await (svc as any)
        .from("org_memberships")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("role", "owner");

      if (cErr) {
        return NextResponse.json(
          { error: safeErrorMessage(cErr.message, "Could not verify owners") },
          { status: 500 }
        );
      }
      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the only workspace owner" },
          { status: 400 }
        );
      }
    }

    const { error: delErr } = await (svc as any)
      .from("org_memberships")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", targetUserId);

    if (delErr) {
      return NextResponse.json(
        { error: safeErrorMessage(delErr.message, "Could not remove member") },
        { status: 500 }
      );
    }

    if (targetUserId === userId) {
      await (svc as any)
        .from("profiles")
        .update({ active_org_id: null, updated_at: new Date().toISOString() })
        .eq("id", userId);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not remove member" },
      { status: 500 }
    );
  }
}

/** PATCH: change member role (owners only). */
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

    const { id: targetUserId } = await ctx.params;
    if (!uuidSchema.safeParse(targetUserId).success) {
      return NextResponse.json({ error: "Invalid member id" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const role = (body as { role?: string })?.role;
    if (role !== "owner" && role !== "member") {
      return NextResponse.json({ error: "role must be owner or member" }, { status: 400 });
    }

    const orgId = await resolveOrgId(authClient as any, userId);
    if (!orgId) {
      return NextResponse.json({ error: "No active workspace" }, { status: 400 });
    }

    const { data: actorMem, error: actorErr } = await (authClient as any)
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (actorErr || actorMem?.role !== "owner") {
      return NextResponse.json({ error: "Only workspace owners can change roles" }, { status: 403 });
    }

    const svc = createSupabaseServiceClient();

    const { data: targetMem, error: tErr } = await (svc as any)
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (tErr || !targetMem) {
      return NextResponse.json({ error: "Member not found in this workspace" }, { status: 404 });
    }

    if (targetMem.role === "owner" && role === "member") {
      const { count, error: cErr } = await (svc as any)
        .from("org_memberships")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("role", "owner");

      if (cErr) {
        return NextResponse.json(
          { error: safeErrorMessage(cErr.message, "Could not verify owners") },
          { status: 500 }
        );
      }
      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the only workspace owner" },
          { status: 400 }
        );
      }
    }

    const { error: upErr } = await (svc as any)
      .from("org_memberships")
      .update({ role })
      .eq("org_id", orgId)
      .eq("user_id", targetUserId);

    if (upErr) {
      return NextResponse.json(
        { error: safeErrorMessage(upErr.message, "Could not update role") },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, role });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not update role" },
      { status: 500 }
    );
  }
}
