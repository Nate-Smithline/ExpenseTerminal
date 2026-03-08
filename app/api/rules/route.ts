import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { normalizeRuleRow } from "@/lib/rules/engine";

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

  const [{ data: rules, error: rulesError }, { data: prefs, error: prefsError }] = await Promise.all([
    supabase.from("auto_sort_rules").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  if (rulesError) {
    return NextResponse.json(
      { error: safeErrorMessage(rulesError.message, "Failed to load rules") },
      { status: 500 },
    );
  }
  if (prefsError && prefsError.code !== "PGRST116") {
    return NextResponse.json(
      { error: safeErrorMessage(prefsError.message, "Failed to load notification preferences") },
      { status: 500 },
    );
  }

  return NextResponse.json({
    rules: (rules ?? []).map(normalizeRuleRow),
    notificationPreferences: prefs ?? null,
  });
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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, enabled = true, conditions, action } = body ?? {};

  if (!conditions || !conditions.match || typeof conditions.match.pattern !== "string") {
    return NextResponse.json({ error: "Condition pattern is required" }, { status: 400 });
  }
  if (conditions.match.pattern.trim() === "") {
    return NextResponse.json({ error: "Pattern cannot be empty" }, { status: 400 });
  }
  if (!action || (action.type !== "auto_categorize" && action.type !== "exclude")) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const supabase = authClient as any;
  const { data, error } = await supabase
    .from("auto_sort_rules")
    .insert({
      user_id: userId,
      vendor_pattern: conditions.match.pattern,
      quick_label: action.type === "auto_categorize" && action.category ? action.category : "Rule",
      business_purpose: null,
      category: action.type === "auto_categorize" ? action.category ?? null : null,
      name: name ?? null,
      enabled,
      conditions,
      action,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to create rule") },
      { status: 500 },
    );
  }

  return NextResponse.json({ rule: normalizeRuleRow(data) });
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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { id, name, enabled, conditions, action } = body ?? {};
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Rule id is required" }, { status: 400 });
  }

  const supabase = authClient as any;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name ?? null;
  if (enabled !== undefined) updates.enabled = !!enabled;
  if (conditions !== undefined) updates.conditions = conditions;
  if (action !== undefined) updates.action = action;

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabase
      .from("auto_sort_rules")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId);

    if (updateError) {
      return NextResponse.json(
        { error: safeErrorMessage(updateError.message, "Failed to update rule") },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
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

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Rule id is required" }, { status: 400 });
  }

  const supabase = authClient as any;
  const { error } = await supabase.from("auto_sort_rules").delete().eq("id", id).eq("user_id", userId);
  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to delete rule") },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

