/* eslint-disable @typescript-eslint/no-explicit-any -- supabase generated row shapes */
import { NextResponse } from "next/server";
import { createSupabaseRouteClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";

const DEFAULT_WORKSPACE_NAME = "My workspace";

/**
 * POST /api/orgs/create — create a new org, add caller as owner, set as active workspace.
 */
export async function POST(req: Request) {
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

  let body: { name?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const rawName = typeof body.name === "string" ? body.name.trim() : "";
  const name = rawName.length > 0 ? rawName.slice(0, 200) : DEFAULT_WORKSPACE_NAME;

  const svc = createSupabaseServiceClient();
  const now = new Date().toISOString();

  const { data: org, error: orgErr } = await (svc as any)
    .from("orgs")
    .insert({
      name,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (orgErr || !org?.id) {
    return NextResponse.json(
      { error: safeErrorMessage(orgErr?.message, "Failed to create workspace") },
      { status: 500 }
    );
  }

  const orgId = org.id as string;

  const { error: memErr } = await (svc as any).from("org_memberships").insert({
    org_id: orgId,
    user_id: userId,
    role: "owner",
    created_at: now,
  });

  if (memErr) {
    await (svc as any).from("orgs").delete().eq("id", orgId);
    return NextResponse.json(
      { error: safeErrorMessage(memErr.message, "Failed to create membership") },
      { status: 500 }
    );
  }

  const { error: profErr } = await (svc as any)
    .from("profiles")
    .update({ active_org_id: orgId, updated_at: now })
    .eq("id", userId);

  if (profErr) {
    return NextResponse.json(
      { error: safeErrorMessage(profErr.message, "Failed to set active workspace") },
      { status: 500 }
    );
  }

  return NextResponse.json({ org_id: orgId, active_org_id: orgId, name });
}
