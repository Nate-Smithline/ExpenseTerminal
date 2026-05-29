import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

/**
 * POST /api/budget/assign
 * Body: { transaction_id, budget_line_id }
 * Assigns a transaction to a budget line (upserts — replaces prior assignment).
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const { transaction_id, budget_line_id } = await req.json();
  if (!transaction_id || !budget_line_id) {
    return NextResponse.json({ error: "transaction_id and budget_line_id required" }, { status: 400 });
  }

  const db = supabase as Supa;

  // Verify line ownership and fetch its default marker
  const { data: line } = await db
    .from("budget_lines")
    .select("id, default_marker, default_business_pct")
    .eq("id", budget_line_id)
    .eq("user_id", userId)
    .single();
  if (!line) return NextResponse.json({ error: "Line not found" }, { status: 404 });

  // Upsert — if tx already assigned somewhere, move it
  const { error } = await db
    .from("budget_line_transactions")
    .upsert(
      { user_id: userId, budget_line_id, transaction_id },
      { onConflict: "transaction_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-apply the line's default marker to the transaction (if one is set)
  if (line.default_marker) {
    const marker = line.default_marker as string;
    const pct =
      marker === "Business" ? 100
      : marker === "Personal" ? 0
      : (line.default_business_pct ?? 50);

    await db
      .from("transactions")
      .update({
        marker,
        business_pct: pct,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction_id)
      .eq("user_id", userId);
  }

  return NextResponse.json({ ok: true, applied_marker: line.default_marker ?? null });
}

/**
 * DELETE /api/budget/assign
 * Body: { transaction_id }
 * Removes a transaction's budget line assignment.
 */
export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const { transaction_id } = await req.json();
  if (!transaction_id) {
    return NextResponse.json({ error: "transaction_id required" }, { status: 400 });
  }

  const db = supabase as Supa;
  const { error } = await db
    .from("budget_line_transactions")
    .delete()
    .eq("transaction_id", transaction_id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
