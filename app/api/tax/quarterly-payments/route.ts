import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

const QUARTERLY_DUE: Record<number, string> = {
  1: "Apr 15",
  2: "Jun 15",
  3: "Sep 15",
  4: "Jan 15",
};

const patchSchema = z.object({
  tax_year: z.number().int().min(2020).max(2035),
  quarter: z.number().int().min(1).max(4),
  paid: z.boolean(),
  amount_paid: z.number().min(0).optional(),
});

/**
 * GET /api/tax/quarterly-payments?tax_year=2026&estimated_per_quarter=1234.56
 * Returns quarterly rows with estimate + paid state.
 */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const taxYear = parseInt(req.nextUrl.searchParams.get("tax_year") ?? "", 10);
  if (!Number.isFinite(taxYear)) {
    return NextResponse.json({ error: "tax_year required" }, { status: 400 });
  }

  const estimatedParam = req.nextUrl.searchParams.get("estimated_per_quarter");
  const estimatedPerQuarter = estimatedParam ? Number(estimatedParam) : 0;

  const db = supabase as Supa;
  const { data: rows, error } = await db
    .from("quarterly_tax_payments")
    .select("quarter, amount_paid, paid_at")
    .eq("user_id", userId)
    .eq("tax_year", taxYear);

  if (error) return NextResponse.json({ error: safeErrorMessage(error.message, "Failed to load payments") }, { status: 500 });

  const byQuarter = new Map((rows ?? []).map((r: { quarter: number }) => [r.quarter, r]));

  const payments = [1, 2, 3, 4].map((quarter) => {
    const row = byQuarter.get(quarter) as { amount_paid?: number | null; paid_at?: string | null } | undefined;
    const amountPaid = row?.amount_paid != null ? Number(row.amount_paid) : 0;
    const paid = !!row?.paid_at || amountPaid > 0;
    return {
      quarter,
      dueDate: QUARTERLY_DUE[quarter],
      amount: estimatedPerQuarter,
      paid,
      amountPaid: paid ? amountPaid : 0,
    };
  });

  return NextResponse.json({ payments });
}

/**
 * PATCH /api/tax/quarterly-payments
 * Body: { tax_year, quarter, paid, amount_paid? }
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().formErrors[0] ?? "Invalid body" }, { status: 400 });
  }

  const { tax_year, quarter, paid, amount_paid } = parsed.data;
  const db = supabase as Supa;
  const now = new Date().toISOString();

  const payload = paid
    ? {
        user_id: userId,
        tax_year,
        quarter,
        amount_paid: amount_paid ?? 0,
        paid_at: now,
        updated_at: now,
      }
    : {
        user_id: userId,
        tax_year,
        quarter,
        amount_paid: null,
        paid_at: null,
        updated_at: now,
      };

  const { error } = await db
    .from("quarterly_tax_payments")
    .upsert(payload, { onConflict: "user_id,tax_year,quarter" });

  if (error) {
    return NextResponse.json({ error: safeErrorMessage(error.message, "Failed to update payment") }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
