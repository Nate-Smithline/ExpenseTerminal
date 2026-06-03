import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { sendUnsortedReminder } from "@/lib/email/send-unsorted-reminder";
import { sendQuarterlyReminder } from "@/lib/email/send-quarterly-reminder";
import { getQuarterlyTaxEstimate } from "@/lib/tax/quarterly-estimate";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://expenseterminal.com";
const IRS_DIRECT_PAY_URL = "https://www.irs.gov/payments/direct-pay";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ─── Quarterly deadline logic ─────────────────────────────────────────────────

type QuarterSpec = {
  /** Internal key: e.g. "2026-Q1" */
  key: string;
  label: string;      // e.g. "Q1 2026"
  dueDate: Date;
  coversPeriod: string; // e.g. "January – March income"
  /** Tax year the covered income belongs to (Q4-prev uses the previous year). */
  taxYear: number;
  /** 1-indexed months the IRS estimated-tax period covers (e.g. Q2 = [4, 5]). */
  incomeMonths: number[];
};

/** Returns all quarterly deadlines for the current year + Q4 from the previous year (due Jan 15). */
function getQuarterlyDeadlines(today: Date): QuarterSpec[] {
  const year = today.getFullYear();
  return [
    // Q4 of previous year — due Jan 15 of current year
    {
      key: `${year}-Q4-prev`,
      label: `Q4 ${year - 1}`,
      dueDate: new Date(`${year}-01-15`),
      coversPeriod: `September – December ${year - 1} income`,
      taxYear: year - 1,
      incomeMonths: [9, 10, 11, 12],
    },
    // Q1 — due April 15
    {
      key: `${year}-Q1`,
      label: `Q1 ${year}`,
      dueDate: new Date(`${year}-04-15`),
      coversPeriod: `January – March income`,
      taxYear: year,
      incomeMonths: [1, 2, 3],
    },
    // Q2 — due June 15
    {
      key: `${year}-Q2`,
      label: `Q2 ${year}`,
      dueDate: new Date(`${year}-06-15`),
      coversPeriod: `April – May income`,
      taxYear: year,
      incomeMonths: [4, 5],
    },
    // Q3 — due September 15
    {
      key: `${year}-Q3`,
      label: `Q3 ${year}`,
      dueDate: new Date(`${year}-09-15`),
      coversPeriod: `June – August income`,
      taxYear: year,
      incomeMonths: [6, 7, 8],
    },
    // Q4 of current year — due Jan 15 next year
    {
      key: `${year}-Q4`,
      label: `Q4 ${year}`,
      dueDate: new Date(`${year + 1}-01-15`),
      coversPeriod: `September – December income`,
      taxYear: year,
      incomeMonths: [9, 10, 11, 12],
    },
  ];
}

const REMINDER_WINDOWS = [14, 3] as const;

/** Returns {quarter, daysUntilDue} if today is exactly a reminder window from a deadline. */
function getActiveReminder(
  today: Date,
  deadlines: QuarterSpec[]
): { quarter: QuarterSpec; daysUntilDue: number; periodKey: string } | null {
  const todayMs = today.setHours(0, 0, 0, 0);
  for (const quarter of deadlines) {
    const dueMs = new Date(quarter.dueDate).setHours(0, 0, 0, 0);
    const diff = Math.round((dueMs - todayMs) / (1000 * 60 * 60 * 24));
    if ((REMINDER_WINDOWS as readonly number[]).includes(diff)) {
      return { quarter, daysUntilDue: diff, periodKey: `${quarter.key}-${diff}d` };
    }
  }
  return null;
}

function formatDueDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ─── Unsorted reminder helpers ────────────────────────────────────────────────

function parseNotificationValue(
  type: string,
  value: string
): { threshold?: number; interval?: string } {
  if (type === "count_based") {
    const n = parseInt(value, 10);
    return { threshold: Number.isFinite(n) ? n : 10 };
  }
  if (type === "interval_based") {
    return { interval: value || "weekly" };
  }
  return { threshold: 10 };
}

function intervalElapsed(interval: string, lastNotifiedAt: string | null): boolean {
  if (!lastNotifiedAt) return true;
  const ms = Date.now() - new Date(lastNotifiedAt).getTime();
  switch (interval) {
    case "daily":    return ms >= 24 * 60 * 60 * 1000;
    case "weekly":   return ms >= 7 * 24 * 60 * 60 * 1000;
    case "monthly":  return ms >= 30 * 24 * 60 * 60 * 1000;
    case "quarterly": return ms >= 90 * 24 * 60 * 60 * 1000;
    default:         return ms >= 7 * 24 * 60 * 60 * 1000;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

/**
 * Vercel Cron — runs at 2:00 AM EST (07:00 UTC) every night.
 *
 * Two jobs in one:
 *  A) Unsorted transaction reminders — count-based or interval-based.
 *  B) Quarterly estimated tax deadline reminders — 14 days and 3 days before each due date.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 }
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const today = new Date();

  // ── A: Unsorted reminders ─────────────────────────────────────────────────
  const { data: prefs } = await (supabase as any)
    .from("notification_preferences")
    .select("user_id, type, value, last_notified_at");

  const unsortedSent: string[] = [];
  const unsortedErrors: { userId: string; error: string }[] = [];

  for (const pref of prefs ?? []) {
    const userId = pref.user_id as string;
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();
    const email = profile?.email as string | null;
    if (!email) continue;

    const { data: org } = await (supabase as any)
      .from("org_settings")
      .select("business_name")
      .eq("user_id", userId)
      .maybeSingle();
    const workspaceName = (org?.business_name as string) || "Your workspace";

    const { count: unsortedCount } = await (supabase as any)
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending");

    const unsorted = unsortedCount ?? 0;
    if (unsorted === 0) continue;

    const parsed = parseNotificationValue(pref.type, pref.value);
    const lastNotified = pref.last_notified_at as string | null;
    let shouldSend = false;

    if (pref.type === "count_based" && parsed.threshold != null) {
      shouldSend = unsorted >= parsed.threshold;
    } else if (pref.type === "interval_based" && parsed.interval) {
      shouldSend = intervalElapsed(parsed.interval, lastNotified);
    }

    if (!shouldSend) continue;

    const now = new Date();
    const dateRange = `${now.getFullYear() - 1} – ${now.getFullYear()}`;
    const sortNowUrl = `${APP_URL.replace(/\/$/, "")}/login?redirect=/inbox`;

    try {
      await sendUnsortedReminder({ to: email, unsortedCount: unsorted, dateRange, workspaceName, sortNowUrl });
      await (supabase as any)
        .from("notification_preferences")
        .update({ last_notified_at: now.toISOString(), updated_at: now.toISOString() })
        .eq("user_id", userId)
        .eq("type", pref.type);
      unsortedSent.push(userId);
    } catch (e) {
      unsortedErrors.push({ userId, error: e instanceof Error ? e.message : "Send failed" });
    }
  }

  // ── B: Quarterly deadline reminders ───────────────────────────────────────
  const quarterlyDeadlines = getQuarterlyDeadlines(today);
  const activeReminder = getActiveReminder(today, quarterlyDeadlines);
  const quarterlySent: string[] = [];
  const quarterlyErrors: { userId: string; error: string }[] = [];

  if (activeReminder) {
    const { quarter, daysUntilDue, periodKey } = activeReminder;

    // Get all users who have notification preferences (or all profiles — quarterly applies to everyone)
    const { data: allProfiles } = await (supabase as any)
      .from("profiles")
      .select("id, email, first_name");

    for (const profile of allProfiles ?? []) {
      const userId = profile.id as string;
      const email = profile.email as string | null;
      if (!email) continue;

      // Check if we already sent this specific period+window reminder to this user
      const { data: alreadySent } = await (supabase as any)
        .from("quarterly_reminders")
        .select("id")
        .eq("user_id", userId)
        .eq("period", periodKey)
        .maybeSingle();
      if (alreadySent) continue;

      const reviewUrl = `${APP_URL.replace(/\/$/, "")}/login?redirect=/dashboard`;

      // Estimate the tax owed for this period from the user's categorized
      // transactions. Returns null (no amount shown) when there's no activity.
      let estimatedAmount: number | null = null;
      try {
        estimatedAmount = await getQuarterlyTaxEstimate(
          supabase,
          userId,
          quarter.taxYear,
          quarter.incomeMonths
        );
      } catch (e) {
        console.warn("[cron/notifications] estimate failed for", userId, e instanceof Error ? e.message : e);
      }

      try {
        await sendQuarterlyReminder(email, {
          firstName: (profile.first_name as string | null) ?? null,
          quarter: quarter.label,
          dueDate: formatDueDate(quarter.dueDate),
          daysUntilDue,
          estimatedAmount,
          coversPeriod: quarter.coversPeriod,
          irsPayUrl: IRS_DIRECT_PAY_URL,
          reviewUrl,
        });

        // Record that this reminder was sent
        await (supabase as any)
          .from("quarterly_reminders")
          .insert({ user_id: userId, period: periodKey, sent_at: new Date().toISOString() });

        quarterlySent.push(userId);
      } catch (e) {
        quarterlyErrors.push({ userId, error: e instanceof Error ? e.message : "Send failed" });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    unsorted: { sent: unsortedSent.length, errors: unsortedErrors.length },
    quarterly: {
      activeReminder: activeReminder
        ? { quarter: activeReminder.quarter.label, daysUntilDue: activeReminder.daysUntilDue, periodKey: activeReminder.periodKey }
        : null,
      sent: quarterlySent.length,
      errors: quarterlyErrors.length,
    },
  });
}
