/* eslint-disable @typescript-eslint/no-explicit-any -- new tables */
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";
import { transactionPropertyDefinitionPostSchema } from "@/lib/validation/schemas";

async function resolveOrgId(supabase: any, userId: string): Promise<string | null> {
  const existing = await getActiveOrgId(supabase, userId);
  if (existing) return existing;
  try {
    return await ensureActiveOrgForUser(userId);
  } catch {
    return null;
  }
}

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

  const orgId = await resolveOrgId(supabase, userId);
  if (!orgId) {
    return NextResponse.json({ properties: [] });
  }

  const { data, error } = await (supabase as any)
    .from("transaction_property_definitions")
    .select("id,org_id,name,type,config,position,created_at,updated_at")
    .eq("org_id", orgId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to load properties") },
      { status: 500 }
    );
  }

  return NextResponse.json({ properties: data ?? [] });
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
  const supabase = authClient;

  const orgId = await resolveOrgId(supabase, userId);
  if (!orgId) {
    return NextResponse.json({ error: "No active org" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = transactionPropertyDefinitionPostSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "Invalid request body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { name, type, config, position } = parsed.data;

  let nextPosition = position;
  if (nextPosition === undefined) {
    const { data: maxRow } = await (supabase as any)
      .from("transaction_property_definitions")
      .select("position")
      .eq("org_id", orgId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    nextPosition = typeof maxRow?.position === "number" ? maxRow.position + 1 : 0;
  }

  const row = {
    org_id: orgId,
    name,
    type,
    config: config ?? {},
    position: nextPosition,
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await (supabase as any)
    .from("transaction_property_definitions")
    .insert(row)
    .select("id,org_id,name,type,config,position,created_at,updated_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to create property") },
      { status: 500 }
    );
  }

  return NextResponse.json({ property: created });
}
