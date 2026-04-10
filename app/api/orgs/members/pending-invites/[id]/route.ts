import { NextResponse } from "next/server";
import { createSupabaseRouteClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";
import { uuidSchema } from "@/lib/validation/schemas";

/** DELETE /api/orgs/members/pending-invites/[id] — owners only; cancel a pending invite. */
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

    const { id } = await ctx.params;
    if (!uuidSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    let orgId = await getActiveOrgId(authClient as any, userId);
    if (!orgId) {
      try {
        orgId = await ensureActiveOrgForUser(userId);
      } catch {
        orgId = null;
      }
    }
    if (!orgId) {
      return NextResponse.json({ error: "No active workspace" }, { status: 400 });
    }

    const { data: membership, error: memErr } = await (authClient as any)
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (memErr || membership?.role !== "owner") {
      return NextResponse.json({ error: "Only workspace owners can remove pending invites" }, { status: 403 });
    }

    const svc = createSupabaseServiceClient();
    const { error: delErr } = await (svc as any)
      .from("org_pending_invites")
      .delete()
      .eq("id", id)
      .eq("org_id", orgId);

    if (delErr) {
      return NextResponse.json(
        { error: safeErrorMessage(delErr.message, "Could not remove pending invite") },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not remove pending invite" },
      { status: 500 }
    );
  }
}
