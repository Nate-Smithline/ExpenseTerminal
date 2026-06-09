import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { transactionDeleteBodySchema } from "@/lib/validation/schemas";
import { safeErrorMessage } from "@/lib/api/safe-error";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = transactionDeleteBodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "Invalid request body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { id } = parsed.data;
  const db = supabase as Supa;

  // Archive a full snapshot (plus any budget-line assignment) before deleting,
  // so the transaction can be recovered later. Read queries elsewhere are
  // unaffected because the live row is removed — only the archive retains it.
  const { data: txn, error: fetchError } = await db
    .from("transactions")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchError || !txn) {
    return NextResponse.json(
      { error: safeErrorMessage(fetchError?.message, "Transaction not found") },
      { status: 404 }
    );
  }

  const { data: assignment } = await db
    .from("budget_line_transactions")
    .select("budget_line_id")
    .eq("transaction_id", id)
    .eq("user_id", userId)
    .maybeSingle();

  // Best-effort archive for the "Recently deleted" trash. If the archive table
  // is missing (migration not applied) or the write otherwise fails, we must not
  // block the actual delete — the user's intent is to remove the transaction.
  const { error: archiveError } = await db
    .from("deleted_transactions")
    .upsert(
      {
        id,
        user_id: userId,
        snapshot: txn,
        budget_line_id: assignment?.budget_line_id ?? null,
        vendor: txn.vendor ?? null,
        amount: txn.amount ?? null,
        date: txn.date ?? null,
        deleted_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (archiveError) {
    console.error(
      "deleted_transactions archive failed; deleting without archive:",
      archiveError.message
    );
  }

  const { error } = await db
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to delete transaction") },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
