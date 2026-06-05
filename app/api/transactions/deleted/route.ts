import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

/**
 * GET /api/transactions/deleted
 * Lists the current user's recently deleted (recoverable) transactions.
 */
export async function GET() {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;
  const db = authClient as Supa;

  const { data, error } = await db
    .from("deleted_transactions")
    .select("id, vendor, amount, date, budget_line_id, deleted_at")
    .eq("user_id", userId)
    .order("deleted_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to load deleted transactions") },
      { status: 500 }
    );
  }

  return NextResponse.json({ transactions: data ?? [] });
}

/**
 * POST /api/transactions/deleted
 * Body: { id }
 * Restores a deleted transaction (re-inserts it and re-links its budget line).
 */
export async function POST(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;
  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const db = authClient as Supa;

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const id = body?.id;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { data: archived, error: fetchError } = await db
    .from("deleted_transactions")
    .select("id, snapshot, budget_line_id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !archived) {
    return NextResponse.json({ error: "Deleted transaction not found" }, { status: 404 });
  }

  // Re-insert the original row from the snapshot (preserves the original id).
  const snapshot = { ...(archived.snapshot as Record<string, unknown>), user_id: userId };
  const { error: insertError } = await db.from("transactions").insert(snapshot);

  if (insertError) {
    return NextResponse.json(
      { error: safeErrorMessage(insertError.message, "Failed to restore transaction") },
      { status: 500 }
    );
  }

  // Re-link the budget-line assignment if the line still exists.
  if (archived.budget_line_id) {
    const { data: line } = await db
      .from("budget_lines")
      .select("id")
      .eq("id", archived.budget_line_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (line) {
      await db
        .from("budget_line_transactions")
        .upsert(
          { user_id: userId, budget_line_id: archived.budget_line_id, transaction_id: id },
          { onConflict: "transaction_id" }
        );
    }
  }

  await db.from("deleted_transactions").delete().eq("id", id).eq("user_id", userId);

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/transactions/deleted
 * Body: { id }  — permanently purge a transaction from the trash.
 */
export async function DELETE(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;
  const db = authClient as Supa;

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const id = body?.id;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { error } = await db
    .from("deleted_transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to remove transaction") },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
