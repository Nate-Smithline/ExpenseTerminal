/* eslint-disable @typescript-eslint/no-explicit-any -- org rules run */
import { NextResponse } from "next/server";
import { createSupabaseRouteClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";
import { orgRuleRunBodySchema } from "@/lib/org-rules/schemas";
import {
  runOrgRulesDailyForOrg,
  runOrgRulesForTransactionIds,
  runOrgRulesOnceBackfill,
} from "@/lib/org-rules/executor";

async function resolveOrgId(supabase: any, userId: string): Promise<string | null> {
  const existing = await getActiveOrgId(supabase, userId);
  if (existing) return existing;
  try {
    return await ensureActiveOrgForUser(userId);
  } catch {
    return null;
  }
}

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

  const orgId = await resolveOrgId(authClient as any, userId);
  if (!orgId) {
    return NextResponse.json({ error: "No active org" }, { status: 400 });
  }

  // Verify the user is a member of the org (auth check via RLS-bound client)
  const { data: membership } = await (authClient as any)
    .from("org_memberships")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this org" }, { status: 403 });
  }

  // Use service client for rule execution — org rules are org-wide and must read/write
  // across all member transactions regardless of per-user RLS policies.
  let serviceDb: any;
  try {
    serviceDb = createSupabaseServiceClient();
  } catch {
    return NextResponse.json(
      { error: "Rule execution is not configured (missing service key)." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = orgRuleRunBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "Invalid body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { transactionIds, ruleId, scope } = parsed.data;

  try {
    if (scope === "once_backfill") {
      if (!ruleId) {
        return NextResponse.json({ error: "ruleId is required for once_backfill" }, { status: 400 });
      }
      const result = await runOrgRulesOnceBackfill(serviceDb, orgId, ruleId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (scope === "daily_window") {
      const result = await runOrgRulesDailyForOrg(serviceDb, orgId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (!transactionIds?.length) {
      return NextResponse.json({ error: "transactionIds required" }, { status: 400 });
    }
    const result = await runOrgRulesForTransactionIds(serviceDb, orgId, transactionIds);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: safeErrorMessage(message, "Failed to run rules") },
      { status: 500 },
    );
  }
}
