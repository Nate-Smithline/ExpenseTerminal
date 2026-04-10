import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";

async function assertOwner(supabase: any, orgId: string, userId: string) {
  const { data: m } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  return m?.role === "owner";
}

async function countOwnersInOrg(supabase: any, orgId: string): Promise<number> {
  const { count, error } = await supabase
    .from("org_memberships")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("role", "owner");
  if (error) return 0;
  return count ?? 0;
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId: targetUserId } = await context.params;
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const actorId = auth.userId;
  const { success: rlOk } = await rateLimitForRequest(req, actorId, generalApiLimit);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const supabase = authClient as any;

  let orgId = await getActiveOrgId(supabase, actorId);
  if (!orgId) orgId = await ensureActiveOrgForUser(actorId);

  if (!(await assertOwner(supabase, orgId, actorId))) {
    return NextResponse.json({ error: "Only workspace owners can change roles" }, { status: 403 });
  }

  let body: { role?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const role = body.role;
  if (role !== "member" && role !== "owner") {
    return NextResponse.json({ error: "role must be member or owner" }, { status: 400 });
  }

  const { data: targetRow, error: tErr } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (tErr || !targetRow) {
    return NextResponse.json({ error: "Member not found in this workspace" }, { status: 404 });
  }

  if (targetRow.role === "owner" && role === "member") {
    const owners = await countOwnersInOrg(supabase, orgId);
    if (owners <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last workspace owner. Promote another owner first." },
        { status: 400 },
      );
    }
  }

  const { error: uErr } = await supabase
    .from("org_memberships")
    .update({ role })
    .eq("org_id", orgId)
    .eq("user_id", targetUserId);

  if (uErr) {
    return NextResponse.json(
      { error: safeErrorMessage(uErr.message, "Failed to update role") },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, role });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId: targetUserId } = await context.params;
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const actorId = auth.userId;
  const { success: rlOk } = await rateLimitForRequest(req, actorId, generalApiLimit);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const supabase = authClient as any;

  let orgId = await getActiveOrgId(supabase, actorId);
  if (!orgId) orgId = await ensureActiveOrgForUser(actorId);

  if (!(await assertOwner(supabase, orgId, actorId))) {
    return NextResponse.json({ error: "Only workspace owners can remove members" }, { status: 403 });
  }

  const { data: targetRow, error: tErr } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (tErr || !targetRow) {
    return NextResponse.json({ error: "Member not found in this workspace" }, { status: 404 });
  }

  if (targetRow.role === "owner") {
    const owners = await countOwnersInOrg(supabase, orgId);
    if (owners <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last workspace owner." },
        { status: 400 },
      );
    }
  }

  const { error: dErr } = await supabase
    .from("org_memberships")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", targetUserId);

  if (dErr) {
    return NextResponse.json(
      { error: safeErrorMessage(dErr.message, "Failed to remove member") },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
