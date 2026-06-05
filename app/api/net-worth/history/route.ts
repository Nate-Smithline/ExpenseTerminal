import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

interface SnapshotRow {
  data_source_id: string | null;
  captured_on: string; // YYYY-MM-DD
  balance_cents: number;
}

/**
 * GET /api/net-worth/history?months=12
 *
 * Returns the net-worth time series built from net_worth_snapshots.
 * Each snapshot is a signed per-account balance on a given date; net worth on
 * any date is the sum of the most recent balance for every account up to that
 * date (carry-forward), so accounts that snapshot on different days still
 * contribute their last known balance.
 *
 * months: how many months back to include (1-120). Omit / 0 = all available.
 */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const rawMonths = parseInt(req.nextUrl.searchParams.get("months") ?? "0", 10);
  const monthsBack = Number.isFinite(rawMonths) ? Math.min(120, Math.max(0, rawMonths)) : 0;

  const db = supabase as Supa;
  const { data, error } = await db
    .from("net_worth_snapshots")
    .select("data_source_id,captured_on,balance_cents")
    .eq("user_id", userId)
    .order("captured_on", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as SnapshotRow[];

  // Group snapshots by date, preserving ascending date order.
  const byDate = new Map<string, SnapshotRow[]>();
  for (const r of rows) {
    const bucket = byDate.get(r.captured_on);
    if (bucket) bucket.push(r);
    else byDate.set(r.captured_on, [r]);
  }

  // Carry-forward: walk dates in order, keeping the latest balance per account.
  const latestBySource = new Map<string, number>();
  const allPoints: { date: string; netWorth: number }[] = [];
  for (const [date, snapshots] of byDate) {
    for (const s of snapshots) {
      latestBySource.set(s.data_source_id ?? "__unassigned__", s.balance_cents);
    }
    let totalCents = 0;
    for (const cents of latestBySource.values()) totalCents += cents;
    allPoints.push({ date, netWorth: Math.round(totalCents) / 100 });
  }

  // Optionally trim to the requested window.
  let points = allPoints;
  if (monthsBack > 0 && allPoints.length > 0) {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setMonth(cutoff.getMonth() - monthsBack);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const windowed = allPoints.filter(p => p.date >= cutoffStr);
    // Seed the window with the last point before the cutoff so the line has a
    // starting balance even if no snapshot lands exactly in range.
    if (windowed.length === 0) {
      points = allPoints.slice(-1);
    } else if (windowed[0].date !== allPoints[0].date) {
      const firstIdx = allPoints.indexOf(windowed[0]);
      points = firstIdx > 0 ? [allPoints[firstIdx - 1], ...windowed] : windowed;
    } else {
      points = windowed;
    }
  }

  const first = points[0]?.netWorth ?? 0;
  const last = points[points.length - 1]?.netWorth ?? 0;
  const changeAbs = Math.round((last - first) * 100) / 100;
  const changePct = first !== 0 ? Math.round((changeAbs / Math.abs(first)) * 1000) / 10 : null;

  return NextResponse.json(
    {
      points,
      change: { absolute: changeAbs, pct: changePct },
      current: last,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
