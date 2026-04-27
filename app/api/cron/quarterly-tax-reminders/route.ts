import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { calculateTaxSummary } from "@/lib/tax/form-calculations";
import { getResendClient, getFromAddress, RESEND_TIMEOUT_MS } from "@/lib/email/resend";
import {
  quarterlyTaxReminderHtml,
  quarterlyTaxReminderText,
} from "@/lib/email/templates/quarterly-tax-reminder";
import {
  calendarDateInTimeZone,
  isQuarterlyEstimatedTaxReminderDayNY,
  sameCalendarDateInNY,
} from "@/lib/time/america-new-york";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://expenseterminal.com";
const TZ = "America/New_York";

/**
 * Daily cron: on Mar 1, May 1, Aug 1, Dec 1 (America/New_York), email all profiles with
 * a quarterly tax reminder and deep link to dashboard estimated payment.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      {
        error:
          "CRON_SECRET is not configured. Set CRON_SECRET in Vercel Environment Variables (and .env.local for local runs).",
      },
      { status: 503 }
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  if (!isQuarterlyEstimatedTaxReminderDayNY(now, TZ)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Not a quarterly reminder send day in America/New_York",
      nyDate: calendarDateInTimeZone(now, TZ),
    });
  }

  const supabase = createSupabaseServiceClient();

  const { data: profiles, error: listErr } = await (supabase as any)
    .from("profiles")
    .select("id, email, first_name, last_quarterly_tax_reminder_sent_at")
    .not("email", "is", null);

  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const resend = getResendClient();
  const from = getFromAddress();
  const taxYear = now.getFullYear();

  const results: { id: string; sent: boolean; error?: string }[] = [];

  for (const row of profiles ?? []) {
    const userId = row.id as string;
    const email = row.email as string | null;
    const lastSent = row.last_quarterly_tax_reminder_sent_at as string | null;

    if (!email?.trim()) {
      results.push({ id: userId, sent: false, error: "no email" });
      continue;
    }

    if (lastSent && sameCalendarDateInNY(new Date(lastSent), now, TZ)) {
      results.push({ id: userId, sent: false, error: "already_sent_today" });
      continue;
    }

    const { data: mem } = await (supabase as any)
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const workspaceId = mem?.workspace_id ? String(mem.workspace_id) : null;
    if (!workspaceId) {
      results.push({ id: userId, sent: false, error: "no_workspace" });
      continue;
    }

    const { data: taxSettings } = await (supabase as any)
      .from("tax_year_settings")
      .select("tax_rate")
      .eq("user_id", userId)
      .eq("tax_year", taxYear)
      .single();

    const taxRate = taxSettings?.tax_rate != null ? Number(taxSettings.tax_rate) : 0.24;

    const txCols =
      "amount,transaction_type,schedule_c_line,category,is_meal,is_travel,deduction_percent,date,status,quick_label";
    const { data: allTransactions } = await (supabase as any)
      .from("transactions")
      .select(txCols)
      .eq("workspace_id", workspaceId)
      .eq("tax_year", taxYear)
      .in("status", ["completed", "auto_sorted"]);

    const { data: deductions } = await (supabase as any)
      .from("deductions")
      .select("type,amount")
      .eq("workspace_id", workspaceId)
      .eq("tax_year", taxYear);

    const summary = calculateTaxSummary(allTransactions ?? [], deductions ?? [], taxRate);
    const estimatedQuarterlyPayment = summary.estimatedQuarterlyPayment;

    const dashboardUrl = `${APP_URL.replace(/\/$/, "")}/dashboard?highlight=quarterly`;

    try {
      const sendPromise = resend.emails.send({
        from,
        to: email,
        subject: `Quarterly estimated taxes — plan for ${taxYear}`,
        html: quarterlyTaxReminderHtml({
          firstName: (row.first_name as string | null) ?? null,
          estimatedQuarterlyPayment,
          taxYear,
          dashboardUrl,
        }),
        text: quarterlyTaxReminderText({
          firstName: (row.first_name as string | null) ?? null,
          estimatedQuarterlyPayment,
          taxYear,
          dashboardUrl,
        }),
      });
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Resend timeout")), RESEND_TIMEOUT_MS)
      );
      await Promise.race([sendPromise, timeout]);

      await (supabase as any)
        .from("profiles")
        .update({ last_quarterly_tax_reminder_sent_at: new Date().toISOString() })
        .eq("id", userId);

      results.push({ id: userId, sent: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ id: userId, sent: false, error: msg });
    }
  }

  const sent = results.filter((r) => r.sent).length;
  return NextResponse.json({ ok: true, nyDate: calendarDateInTimeZone(now, TZ), sent, results });
}
