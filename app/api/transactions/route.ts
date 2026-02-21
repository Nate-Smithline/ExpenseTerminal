import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import {
  parseQueryLimit,
  parseQueryOffset,
  parseQueryTaxYear,
  uuidSchema,
  transactionPostBodySchema,
} from "@/lib/validation/schemas";
import { normalizeVendor } from "@/lib/vendor-matching";
import { safeErrorMessage } from "@/lib/api/safe-error";

/**
 * GET: Fetch transactions with filters.
 * Query params: tax_year, status, transaction_type, limit, vendor_normalized
 */
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

  const { searchParams } = new URL(req.url);
  const taxYearParam = searchParams.get("tax_year");
  const taxYear = parseQueryTaxYear(taxYearParam) ?? (taxYearParam ? parseInt(taxYearParam, 10) : null);
  const status = searchParams.get("status");
  const txType = searchParams.get("transaction_type");
  const limit = parseQueryLimit(searchParams.get("limit"));
  const offset = parseQueryOffset(searchParams.get("offset"));
  const vendorNormalized = searchParams.get("vendor_normalized");
  const excludeIdRaw = searchParams.get("exclude_id");
  const excludeId = excludeIdRaw && uuidSchema.safeParse(excludeIdRaw).success ? excludeIdRaw : null;
  const countOnly = searchParams.get("count_only") === "true";
  const analyzedOnlyParam = searchParams.get("analyzed_only");
  const analyzedOnly = analyzedOnlyParam === "true" ? true : analyzedOnlyParam === "false" ? false : null;

  const transactionColumns =
    "id,user_id,date,vendor,description,amount,category,schedule_c_line,ai_confidence,ai_reasoning,ai_suggestions,status,business_purpose,quick_label,notes,vendor_normalized,auto_sort_rule_id,deduction_percent,is_meal,is_travel,tax_year,source,transaction_type,data_source_id,created_at,updated_at";
  let query = (supabase as any)
    .from("transactions")
    .select(countOnly ? "*" : transactionColumns, countOnly ? { count: "exact", head: true } : { count: "exact" })
    .eq("user_id", userId);

  if (taxYear != null) query = query.eq("tax_year", taxYear);
  if (status) query = query.eq("status", status);
  if (txType) query = query.eq("transaction_type", txType);
  if (vendorNormalized) query = query.eq("vendor_normalized", vendorNormalized);
  if (excludeId) query = query.neq("id", excludeId);
  if (analyzedOnly === true) query = query.not("ai_confidence", "eq", null);
  if (analyzedOnly === false) query = query.is("ai_confidence", null);

  if (!countOnly) {
    query = query.order("date", { ascending: false }).range(offset, offset + limit - 1);
  }

  if (countOnly) {
    const { count, error } = await query;
    if (error) return NextResponse.json({ error: safeErrorMessage(error.message, "Failed to count") }, { status: 500 });
    return NextResponse.json({ count: count ?? 0 });
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: safeErrorMessage(error.message, "Failed to load transactions") }, { status: 500 });
  return NextResponse.json({ data: data ?? [], count });
}

/**
 * POST: Log a single transaction (e.g. income).
 * Body: { date, vendor, amount, description?, transaction_type?: "income" | "expense" }
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
  const supabase = authClient;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = transactionPostBodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "Invalid request body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const { date, vendor, amount, description, transaction_type = "income" } = parsed.data;

  const taxYear = new Date(date).getFullYear();
  const insertCols = "id,user_id,date,vendor,description,amount,status,tax_year,source,transaction_type,vendor_normalized,created_at";
  const { data, error } = await (supabase as any)
    .from("transactions")
    .insert({
      user_id: userId,
      date: new Date(date).toISOString().slice(0, 10),
      vendor,
      description: description ?? null,
      amount,
      status: "completed",
      tax_year: taxYear,
      source: "manual",
      transaction_type,
      vendor_normalized: normalizeVendor(String(vendor)),
    })
    .select(insertCols)
    .single();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to save transaction") },
      { status: 500 }
    );
  }

  revalidatePath("/dashboard");
  return NextResponse.json(data);
}
