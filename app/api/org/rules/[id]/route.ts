/* eslint-disable @typescript-eslint/no-explicit-any -- org tables */
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";
import { orgRulePatchSchema } from "@/lib/org-rules/schemas";
import { uuidSchema } from "@/lib/validation/schemas";

async function resolveOrgId(supabase: any, userId: string): Promise<string | null> {
  const existing = await getActiveOrgId(supabase, userId);
  if (existing) return existing;
  try {
    return await ensureActiveOrgForUser(userId);
  } catch {
    return null;
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
  if (!orgId) {
    return NextResponse.json({ error: "No active org" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = orgRulePatchSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "Invalid body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  const d = parsed.data;
  if (d.name !== undefined) updatePayload.name = d.name ?? "Untitled rule";
  if (d.enabled !== undefined) updatePayload.enabled = d.enabled;
  if (d.position !== undefined) updatePayload.position = d.position;
  if (d.conditions !== undefined) updatePayload.conditions_json = d.conditions;
  if (d.actions !== undefined) updatePayload.actions_json = d.actions;
  if (d.trigger_mode !== undefined) updatePayload.trigger_mode = d.trigger_mode;

  const { data: updated, error } = await (supabase as any)
    .from("org_transaction_rules")
    .update(updatePayload)
    .eq("id", idParsed.data)
    .eq("org_id", orgId)
    .select(
      "id,org_id,name,enabled,position,conditions_json,actions_json,trigger_mode,once_completed_at,created_at,updated_at",
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to update rule") },
      { status: 500 },
    );
  }
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ rule: updated });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
  if (!orgId) {
    return NextResponse.json({ error: "No active org" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const idParsed = uuidSchema.safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { error, count } = await (supabase as any)
    .from("org_transaction_rules")
    .delete({ count: "exact" })
    .eq("id", idParsed.data)
    .eq("org_id", orgId);

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to delete rule") },
      { status: 500 },
    );
  }
  if (!count) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
