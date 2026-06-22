import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getStripeClient, type StripeMode } from "@/lib/stripe";
import { sendTrialEnding } from "@/lib/email/send-trial-ending";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://expenseterminal.com";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Send the reminder once the trial has this many days (or fewer) remaining. */
const REMINDER_WINDOW_DAYS = 3;

function daysUntil(iso: string, now: Date): number {
  const end = new Date(iso).getTime();
  return Math.ceil((end - now.getTime()) / 86_400_000);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Best-effort human price label (e.g. "$180/year") from the Stripe price. */
async function resolvePriceLabel(
  stripePriceId: string | null,
  mode: StripeMode
): Promise<string | null> {
  if (!stripePriceId) return null;
  try {
    const stripe = getStripeClient(mode);
    const price = await stripe.prices.retrieve(stripePriceId);
    if (price.unit_amount == null) return null;
    const amount = (price.unit_amount / 100).toLocaleString("en-US", {
      style: "currency",
      currency: (price.currency ?? "usd").toUpperCase(),
      maximumFractionDigits: 0,
    });
    const interval = price.recurring?.interval;
    if (interval === "year") return `${amount}/year`;
    if (interval === "month") return `${amount}/month`;
    return amount;
  } catch {
    return null;
  }
}

/**
 * Vercel Cron — runs daily. Emails users whose card-required free trial is
 * within REMINDER_WINDOW_DAYS of ending, so they aren't surprised by the first
 * charge. Each trial is reminded at most once (guarded by
 * subscriptions.trial_ending_email_sent_at).
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
  const now = new Date();
  const mode: StripeMode = process.env.NODE_ENV === "production" ? "live" : "test";

  // Trialing subscriptions that haven't been reminded yet and won't already be
  // canceled at period end (a canceled trial won't convert to a charge).
  const { data: subs, error } = await (supabase as any)
    .from("subscriptions")
    .select("user_id, current_period_end, stripe_price_id, cancel_at_period_end, trial_ending_email_sent_at")
    .eq("status", "trialing")
    .is("trial_ending_email_sent_at", null);

  if (error) {
    console.error("[cron/trial-ending] query error", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const sent: string[] = [];
  const errors: { userId: string; error: string }[] = [];
  let considered = 0;

  for (const sub of subs ?? []) {
    const userId = sub.user_id as string;
    const periodEnd = sub.current_period_end as string | null;
    if (!periodEnd) continue;
    if (sub.cancel_at_period_end) continue;

    const daysLeft = daysUntil(periodEnd, now);
    // Only remind inside the window, and not once it's already ended.
    if (daysLeft > REMINDER_WINDOW_DAYS || daysLeft < 0) continue;

    considered++;

    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("email, first_name")
      .eq("id", userId)
      .single();
    const email = profile?.email as string | null;
    if (!email) continue;

    const priceLabel = await resolvePriceLabel(
      sub.stripe_price_id as string | null,
      mode
    );

    try {
      await sendTrialEnding(email, {
        firstName: (profile?.first_name as string | null) ?? null,
        daysLeft: Math.max(0, daysLeft),
        trialEndsAt: formatDate(periodEnd),
        priceLabel,
        manageUrl: `${APP_URL.replace(/\/$/, "")}/login?redirect=/settings/billing`,
      });

      await (supabase as any)
        .from("subscriptions")
        .update({
          trial_ending_email_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      sent.push(userId);
    } catch (e) {
      errors.push({ userId, error: e instanceof Error ? e.message : "Send failed" });
    }
  }

  return NextResponse.json({
    ok: true,
    considered,
    sent: sent.length,
    errors: errors.length,
  });
}
