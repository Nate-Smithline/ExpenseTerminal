import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { transactionUploadBodySchema } from "@/lib/validation/schemas";
import { normalizeVendor } from "@/lib/vendor-matching";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getPlanLimitsForUser } from "@/lib/billing/get-user-plan";
import { computeCsvAiEligibility } from "@/lib/billing/limits";

type IncomingRow = {
  date: string;
  vendor: string;
  description?: string;
  amount: number;
  category?: string;
  notes?: string;
  transaction_type?: string;
};

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
    return NextResponse.json(
      { error: "Invalid request body. Expected JSON with { rows: [...], taxYear?: number }." },
      { status: 400 }
    );
  }

  const parsed = transactionUploadBodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "Invalid request body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { rows, taxYear: bodyTaxYear, dataSourceId } = parsed.data;
  const fallbackYear = bodyTaxYear ?? new Date().getFullYear();

  const dataSourceIdVal = dataSourceId ?? null;

  const limits = await getPlanLimitsForUser(supabase, userId);
  const maxCsv = limits.maxCsvTransactionsForAi === Number.POSITIVE_INFINITY
    ? Number.POSITIVE_INFINITY
    : limits.maxCsvTransactionsForAi;

  const { count: currentEligibleCount } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source", "csv_upload")
    .eq("eligible_for_ai", true);

  const currentEligible = currentEligibleCount ?? 0;
  const { eligibleCount: eligibleImported, ineligibleCount: ineligibleImported, overLimit } =
    computeCsvAiEligibility(currentEligible, rows.length, maxCsv);

  const inserts = rows.map((row, index) => {
    const txType =
      row.transaction_type === "income" ? "income" : "expense";
    const dateStr = new Date(row.date).toISOString().slice(0, 10);
    const rowYear = new Date(row.date).getFullYear();
    const taxYear = Number.isNaN(rowYear) ? fallbackYear : rowYear;
    const eligibleForAi = index < eligibleImported;
    return {
      user_id: userId,
      date: dateStr,
      vendor: row.vendor,
      description: row.description ?? null,
      amount: row.amount,
      category: row.category ?? null,
      notes: row.notes ?? null,
      status: "pending" as const,
      tax_year: taxYear,
      source: "csv_upload",
      vendor_normalized: normalizeVendor(row.vendor),
      transaction_type: txType,
      eligible_for_ai: eligibleForAi,
      ...(dataSourceIdVal ? { data_source_id: dataSourceIdVal } : {}),
    };
  });

  const { data: inserted, error: insertError } = await (supabase as any)
    .from("transactions")
    .insert(inserts)
    .select("id");

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: safeErrorMessage(insertError?.message, "Failed to insert transactions") },
      { status: 500 }
    );
  }

  // Return the inserted IDs so the client can request AI analysis separately
  const insertedIds = inserted.map((t: { id: string }) => t.id);

  // Update data source stats if provided
  if (dataSourceIdVal) {
    await (supabase as any)
      .from("data_sources")
      .update({
        last_upload_at: new Date().toISOString(),
        transaction_count: inserted.length,
      })
      .eq("id", dataSourceIdVal)
      .eq("user_id", userId);
  }

  return NextResponse.json({
    imported: inserted.length,
    transactionIds: insertedIds,
    needsReview: inserted.length,
    overLimit,
    eligibleImported,
    ineligibleImported,
    maxCsvTransactionsForAi: maxCsv === Number.POSITIVE_INFINITY ? null : maxCsv,
  });
}

