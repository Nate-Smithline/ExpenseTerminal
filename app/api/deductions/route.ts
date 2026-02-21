import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { deductionPostSchema, parseQueryLimit, parseQueryOffset } from "@/lib/validation/schemas";

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
  const parsed = deductionPostSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "Invalid request body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const { type, tax_year, amount, tax_savings, metadata } = parsed.data;

  const cols = "id,user_id,type,tax_year,amount,tax_savings,metadata,created_at";
  const { data, error } = await (supabase as any)
    .from("deductions")
    .insert({
      user_id: userId,
      type,
      tax_year,
      amount,
      tax_savings,
      metadata: metadata ?? null,
    })
    .select(cols)
    .single();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to save deduction") },
      { status: 500 }
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/deductions/qbi");
  revalidatePath("/deductions/mileage");
  return NextResponse.json(data);
}

export async function GET(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;
  const { success: rlOkGet } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOkGet) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const supabase = authClient;

  const { searchParams } = new URL(req.url);
  const taxYear = searchParams.get("tax_year");
  const limit = parseQueryLimit(searchParams.get("limit"));
  const offset = parseQueryOffset(searchParams.get("offset"));

  const cols = "id,user_id,type,tax_year,amount,tax_savings,metadata,created_at";
  let query = (supabase as any)
    .from("deductions")
    .select(cols, { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (taxYear != null && taxYear !== "") {
    query = query.eq("tax_year", parseInt(taxYear, 10));
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to fetch deductions") },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: data ?? [], count: count ?? (data?.length ?? 0) });
}
