import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { transactionUploadBodySchema } from "@/lib/validation/schemas";
import { normalizeVendor } from "@/lib/vendor-matching";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getPlanLimitsForUser } from "@/lib/billing/get-user-plan";
import { computeCsvAiEligibility } from "@/lib/billing/limits";
import { getActiveOrgId } from "@/lib/active-org";
import { runOrgRulesForIngest } from "@/lib/org-rules/executor";

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
    const flat = parsed.error.flatten();
    const firstField = flat.fieldErrors?.rows?.[0] ?? flat.formErrors[0];
    const msg = typeof firstField === "string"
      ? firstField
      : Array.isArray(firstField)
        ? firstField[0]
        : "Invalid request body. Check that each row has date, vendor, and a valid amount.";
    return NextResponse.json(
      { error: msg || "Invalid request body. Expected JSON with rows (date, vendor, amount) and optional taxYear, dataSourceId." },
      { status: 400 }
    );
  }

  const { rows, taxYear: bodyTaxYear, dataSourceId, suppressDuplicates } = parsed.data;
  const fallbackYear = bodyTaxYear ?? new Date().getFullYear();

  const dataSourceIdVal = dataSourceId ?? null;

  if (dataSourceIdVal) {
    const { data: ownedSource, error: dsLookupErr } = await supabase
      .from("data_sources")
      .select("id, source_type")
      .eq("id", dataSourceIdVal)
      .eq("user_id", userId)
      .maybeSingle();

    if (dsLookupErr) {
      return NextResponse.json(
        { error: safeErrorMessage(dsLookupErr.message, "Could not verify account") },
        { status: 500 },
      );
    }
    if (!ownedSource) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    const st = (ownedSource as { source_type?: string }).source_type;
    if (st !== "manual" && st !== "stripe") {
      return NextResponse.json(
        { error: "This account type does not support CSV upload." },
        { status: 400 },
      );
    }
  }

  // Normalize rows for duplicate detection (date + vendor)
  const normalizedRows = rows.map((row) => {
    const dateStr = new Date(row.date).toISOString().slice(0, 10);
    const normalizedVendor = normalizeVendor(row.vendor);
    return { row, dateStr, normalizedVendor };
  });

  let rowsToInsert = normalizedRows;

  if (suppressDuplicates) {
    const dateValues = Array.from(new Set(normalizedRows.map((r) => r.dateStr)));
    const vendorValues = Array.from(new Set(normalizedRows.map((r) => r.normalizedVendor)));

    if (dateValues.length > 0 && vendorValues.length > 0) {
      let existingQuery = supabase
        .from("transactions")
        .select("date,vendor_normalized,data_source_id")
        .eq("user_id", userId)
        .in("date", dateValues)
        .in("vendor_normalized", vendorValues);

      if (dataSourceIdVal) {
        existingQuery = existingQuery.eq("data_source_id", dataSourceIdVal);
      } else {
        existingQuery = existingQuery.is("data_source_id", null);
      }

      const { data: existing, error: existingError } = await existingQuery;
      if (existingError) {
        return NextResponse.json(
          { error: safeErrorMessage(existingError.message, "Failed to check for duplicate transactions") },
          { status: 500 }
        );
      }

      const existingPairs = new Set(
        (existing ?? []).map(
          (t: { date: string; vendor_normalized: string; data_source_id: string | null }) =>
            `${t.date}|${t.vendor_normalized}|${t.data_source_id ?? ""}`
        )
      );

      const seenNewPairs = new Set<string>();
      rowsToInsert = normalizedRows.filter(({ dateStr, normalizedVendor }) => {
        const key = `${dateStr}|${normalizedVendor}|${dataSourceIdVal ?? ""}`;
        if (existingPairs.has(key)) return false;
        if (seenNewPairs.has(key)) return false;
        seenNewPairs.add(key);
        return true;
      });
    } else {
      rowsToInsert = [];
    }
  }

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
    computeCsvAiEligibility(currentEligible, rowsToInsert.length, maxCsv);

  if (rowsToInsert.length === 0) {
    return NextResponse.json({
      imported: 0,
      transactionIds: [],
      needsReview: 0,
      overLimit: false,
      eligibleImported: 0,
      ineligibleImported: 0,
      maxCsvTransactionsForAi: maxCsv === Number.POSITIVE_INFINITY ? null : maxCsv,
    });
  }

  const inserts = rowsToInsert.map(({ row, dateStr, normalizedVendor }, index) => {
    const txType =
      row.transaction_type === "income" ? "income" : "expense";
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
      vendor_normalized: normalizedVendor,
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

  try {
    const orgId = await getActiveOrgId(supabase as any, userId);
    if (orgId && insertedIds.length > 0) {
      await runOrgRulesForIngest(supabase as any, orgId, insertedIds);
    }
  } catch (rulesErr) {
    console.warn("[transactions/upload] Org transaction rules failed", rulesErr);
  }

  // Update data source stats (full recount — works for manual + Direct Feed with mixed CSV + sync rows)
  if (dataSourceIdVal) {
    const { count: txCount, error: countErr } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("data_source_id", dataSourceIdVal)
      .eq("user_id", userId);

    if (countErr) {
      console.warn("[transactions/upload] Failed to recount transactions for data source", countErr);
    }

    await (supabase as any)
      .from("data_sources")
      .update({
        last_upload_at: new Date().toISOString(),
        transaction_count: txCount ?? 0,
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

