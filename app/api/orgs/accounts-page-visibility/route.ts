import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";

export async function GET(req: Request) {
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
  const supabase = authClient as any;

  let orgId = await getActiveOrgId(supabase, userId);
  if (!orgId) {
    orgId = await ensureActiveOrgForUser(userId);
  }

  const [{ data: org, error: oErr }, { data: mem, error: mErr }] = await Promise.all([
    supabase.from("orgs").select("accounts_page_visibility").eq("id", orgId).single(),
    supabase.from("org_memberships").select("role").eq("org_id", orgId).eq("user_id", userId).maybeSingle(),
  ]);

  if (oErr || !org) {
    return NextResponse.json(
      { error: safeErrorMessage(oErr?.message, "Failed to load workspace settings") },
      { status: 500 },
    );
  }
  if (mErr || !mem) {
    return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
  }

  const visibility = org.accounts_page_visibility === "restricted" ? "restricted" : "org";
  return NextResponse.json({
    visibility,
    canEdit: mem.role === "owner",
  });
}

export async function PATCH(req: Request) {
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
  const supabase = authClient as any;

  let orgId = await getActiveOrgId(supabase, userId);
  if (!orgId) {
    orgId = await ensureActiveOrgForUser(userId);
  }

  const { data: membership, error: mErr } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (mErr || !membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Only workspace owners can change this setting" }, { status: 403 });
  }

  let body: { visibility?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const v = body.visibility;
  if (v !== "org" && v !== "restricted") {
    return NextResponse.json({ error: "visibility must be org or restricted" }, { status: 400 });
  }

  const { error: uErr } = await supabase
    .from("orgs")
    .update({
      accounts_page_visibility: v,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  if (uErr) {
    return NextResponse.json(
      { error: safeErrorMessage(uErr.message, "Failed to update setting") },
      { status: 500 },
    );
  }

  return NextResponse.json({ visibility: v });
}
