import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { sendMonthlySummary } from "@/lib/email/send-monthly-summary";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://expenseterminal.com";

/**
 * Tax savings rate used for the "set aside" recommendation.
 * 30% covers SE tax (15.3%) + federal income tax for typical side hustle brackets.
 * Phase 2: replace with per-user effective rate derived from W-2 income + bracket.
 */
const SET_ASIDE_PCT = 30;

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Vercel Cron — runs at 9:00 AM EST on the 1st of every month.
 *
 * For each active user, calculates last month's side hustle income and
 * deductions, then sends a clean "here's what to set aside" email.
 *
 * The goal: the user's assistant already did the math before they had to think about it.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const today = new Date();

  // Last month date range
  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthStart = formatDate(lastMonthDate);
  const lastMonthEnd = formatDate(new Date(today.getFullYear(), today.getMonth(), 0)); // last day of prev month
  const monthLabel = lastMonthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }); // "April 2026"
  const periodKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

  // YTD start — January 1 of current tax year
  const ytdStart = `${today.getFullYear()}-01-01`;
  const ytdEnd = lastMonthEnd; // through end of last month

  const { data: profiles } = await (supabase as any)
    .from("profiles")
    .select("id, email, first_name");

  const sent: string[] = [];
  const skipped: string[] = [];
  const errors: { userId: string; error: string }[] = [];

  for (const profile of profiles ?? []) {
    const userId = profile.id as string;
    const email = profile.email as string | null;
    if (!email) continue;

    // Skip if we've already sent this period's summary
    const { data: alreadySent } = await (supabase as any)
      .from("monthly_summaries_sent")
      .select("id")
      .eq("user_id", userId)
      .eq("period", periodKey)
      .maybeSingle();
    if (alreadySent) {
      skipped.push(userId);
      continue;
    }

    // ── Last month: income ────────────────────────────────────────────────
    const { data: incomeTx } = await (supabase as any)
      .from("transactions")
      .select("amount")
      .eq("user_id", userId)
      .eq("transaction_type", "income")
      .neq("status", "personal")
      .gte("date", lastMonthStart)
      .lte("date", lastMonthEnd);

    const sideHustleIncome = (incomeTx ?? []).reduce(
      (sum: number, t: { amount: string | number }) => sum + Math.abs(Number(t.amount)),
      0
    );

    // Skip users with no side hustle income last month — nothing useful to say
    if (sideHustleIncome === 0) {
      skipped.push(userId);
      continue;
    }

    // ── Last month: deductions taken ─────────────────────────────────────
    const { data: expenseTx } = await (supabase as any)
      .from("transactions")
      .select("amount, deduction_percent, is_meal")
      .eq("user_id", userId)
      .eq("transaction_type", "expense")
      .in("status", ["completed", "auto_sorted"])
      .not("schedule_c_line", "is", null)
      .gte("date", lastMonthStart)
      .lte("date", lastMonthEnd);

    const deductionsTaken = (expenseTx ?? []).reduce(
      (sum: number, t: { amount: string | number; deduction_percent: number | null; is_meal: boolean | null }) => {
        const abs = Math.abs(Number(t.amount));
        const pct = (t.deduction_percent ?? 100) / 100;
        return sum + abs * pct;
      },
      0
    );

    const netIncome = Math.max(0, sideHustleIncome - deductionsTaken);
    const setAsideAmount = Math.round(netIncome * (SET_ASIDE_PCT / 100));

    // ── YTD totals ────────────────────────────────────────────────────────
    const { data: ytdIncomeTx } = await (supabase as any)
      .from("transactions")
      .select("amount")
      .eq("user_id", userId)
      .eq("transaction_type", "income")
      .neq("status", "personal")
      .gte("date", ytdStart)
      .lte("date", ytdEnd);

    const ytdIncome = (ytdIncomeTx ?? []).reduce(
      (sum: number, t: { amount: string | number }) => sum + Math.abs(Number(t.amount)),
      0
    );

    const { data: ytdExpenseTx } = await (supabase as any)
      .from("transactions")
      .select("amount, deduction_percent")
      .eq("user_id", userId)
      .eq("transaction_type", "expense")
      .in("status", ["completed", "auto_sorted"])
      .not("schedule_c_line", "is", null)
      .gte("date", ytdStart)
      .lte("date", ytdEnd);

    const ytdNet = Math.max(
      0,
      ytdIncome -
        (ytdExpenseTx ?? []).reduce(
          (sum: number, t: { amount: string | number; deduction_percent: number | null }) =>
            sum + Math.abs(Number(t.amount)) * ((t.deduction_percent ?? 100) / 100),
          0
        )
    );
    const ytdSetAside = Math.round(ytdNet * (SET_ASIDE_PCT / 100));

    const reviewUrl = `${APP_URL.replace(/\/$/, "")}/login?redirect=/dashboard`;

    try {
      await sendMonthlySummary(email, {
        firstName: (profile.first_name as string | null) ?? null,
        month: monthLabel,
        sideHustleIncome,
        deductionsTaken,
        netIncome,
        setAsideAmount,
        setAsidePct: SET_ASIDE_PCT,
        ytdIncome,
        ytdSetAside,
        reviewUrl,
      });

      await (supabase as any)
        .from("monthly_summaries_sent")
        .insert({ user_id: userId, period: periodKey, sent_at: new Date().toISOString() });

      sent.push(userId);
    } catch (e) {
      errors.push({ userId, error: e instanceof Error ? e.message : "Send failed" });
    }
  }

  return NextResponse.json({ ok: true, period: periodKey, sent: sent.length, skipped: skipped.length, errors: errors.length });
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
