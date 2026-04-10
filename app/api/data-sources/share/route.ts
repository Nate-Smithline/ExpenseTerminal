import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { pageSharePatchSchema } from "@/lib/validation/schemas";

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
  const supabase = authClient;

  const orgId = await getActiveOrgId(supabase as any, userId);
  if (!orgId) {
    return NextResponse.json({
      visibility: "org" as const,
      current_user_id: userId,
      can_manage: true,
    });
  }

  const { data: org, error: orgErr } = await (supabase as any)
    .from("orgs")
    .select("accounts_page_visibility")
    .eq("id", orgId)
    .maybeSingle();

  if (orgErr) {
    return NextResponse.json(
      { error: safeErrorMessage(orgErr.message, "Failed to load share settings") },
      { status: 500 },
    );
  }

  const { data: mem } = await (supabase as any)
    .from("org_memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  const visibility =
    (org as { accounts_page_visibility?: string } | null)?.accounts_page_visibility === "restricted"
      ? "restricted"
      : "org";
  const canManage = (mem?.role as string | undefined) === "owner";

  return NextResponse.json({
    visibility,
    current_user_id: userId,
    can_manage: canManage,
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
  const supabase = authClient;

  const orgId = await getActiveOrgId(supabase as any, userId);
  if (!orgId) {
    return NextResponse.json({ error: "No active organization" }, { status: 400 });
  }

  const { data: mem } = await (supabase as any)
    .from("org_memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if ((mem?.role as string | undefined) !== "owner") {
    return NextResponse.json({ error: "Only an organization owner can change access" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const parsed = pageSharePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors[0] ?? "Invalid body" },
      { status: 400 },
    );
  }

  const { error } = await (supabase as any)
    .from("orgs")
    .update({
      accounts_page_visibility: parsed.data.visibility,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to update access") },
      { status: 500 },
    );
  }

  return NextResponse.json({ visibility: parsed.data.visibility });
}
