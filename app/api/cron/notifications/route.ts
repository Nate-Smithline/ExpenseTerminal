/* eslint-disable @typescript-eslint/no-explicit-any -- cron uses service client typing */
import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { sendUnsortedReminder } from "@/lib/email/send-unsorted-reminder";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://expenseterminal.com";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function parseNotificationValue(
  type: string,
  value: string
): { threshold?: number; interval?: string } {
  if (type === "never") {
    return {};
  }
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
  const last = new Date(lastNotifiedAt).getTime();
  const now = Date.now();
  const ms = now - last;
  switch (interval) {
    case "daily":
      return ms >= 24 * 60 * 60 * 1000;
    case "weekly":
      return ms >= 7 * 24 * 60 * 60 * 1000;
    case "monthly":
      return ms >= 30 * 24 * 60 * 60 * 1000;
    case "quarterly":
      return ms >= 90 * 24 * 60 * 60 * 1000;
    default:
      return ms >= 7 * 24 * 60 * 60 * 1000;
  }
}

/**
 * EventBridge / Vercel Cron: evaluate notification preferences and send reminder emails.
 * Schedule: 2:00 AM EST.
 * Secured by CRON_SECRET: set in Vercel (and .env.local for local testing). Caller must send Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured. Set CRON_SECRET in Vercel Environment Variables (and .env.local for local runs)." },
      { status: 503 }
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const { data: prefs } = await (supabase as any)
    .from("notification_preferences")
    .select("user_id, type, value, last_notified_at");

  const sent: string[] = [];
  const errors: { userId: string; error: string }[] = [];

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
    if (pref.type === "never") {
      shouldSend = false;
    } else if (pref.type === "count_based" && parsed.threshold != null) {
      shouldSend = unsorted >= parsed.threshold;
    } else if (pref.type === "interval_based" && parsed.interval) {
      shouldSend = intervalElapsed(parsed.interval, lastNotified);
    }

    if (!shouldSend) continue;

    const now = new Date();
    const dateRange = `${now.getFullYear() - 1} – ${now.getFullYear()}`;
    const sortNowUrl = `${APP_URL.replace(/\/$/, "")}/login?redirect=/inbox`;

    try {
      await sendUnsortedReminder({
        to: email,
        unsortedCount: unsorted,
        dateRange,
        workspaceName,
        sortNowUrl,
      });
      await (supabase as any)
        .from("notification_preferences")
        .update({
          last_notified_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("user_id", userId)
        .eq("type", pref.type);
      sent.push(userId);
    } catch (e) {
      errors.push({ userId, error: e instanceof Error ? e.message : "Send failed" });
    }
  }

  return NextResponse.json({ ok: true, sent: sent.length, errors });
}
