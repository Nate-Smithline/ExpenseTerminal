export type DashboardPeriod = "mtd" | "qtd" | "ytd";

export type DateRange = {
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
  prevStart: string; // previous period range start
  prevEnd: string; // previous period range end
  label: string;
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12, 0, 0));
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(d.getUTCFullYear(), q, 1, 12, 0, 0));
}

function startOfYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1, 12, 0, 0));
}

function addDaysUtc(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function daysBetweenInclusive(start: Date, end: Date): number {
  // Both dates represent midday UTC; safe to compute by days.
  const ms = end.getTime() - start.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  return days + 1;
}

function clampDayToMonth(year: number, month0: number, day1: number): number {
  const last = new Date(Date.UTC(year, month0 + 1, 0, 12, 0, 0)).getUTCDate();
  return Math.max(1, Math.min(last, day1));
}

export function computeDashboardDateRange(period: DashboardPeriod, now = new Date()): DateRange {
  // Normalize to midday UTC to avoid DST boundary issues.
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
  const end = today;

  const start =
    period === "mtd" ? startOfMonth(today) : period === "qtd" ? startOfQuarter(today) : startOfYear(today);

  const spanDays = daysBetweenInclusive(start, end);

  let prevStart: Date;
  if (period === "mtd") {
    const y = start.getUTCFullYear();
    const m = start.getUTCMonth();
    const prevMonth = m === 0 ? 11 : m - 1;
    const prevYear = m === 0 ? y - 1 : y;
    prevStart = new Date(Date.UTC(prevYear, prevMonth, 1, 12, 0, 0));
  } else if (period === "qtd") {
    const y = start.getUTCFullYear();
    const m = start.getUTCMonth();
    const prevQuarterMonth = m - 3;
    if (prevQuarterMonth >= 0) {
      prevStart = new Date(Date.UTC(y, prevQuarterMonth, 1, 12, 0, 0));
    } else {
      prevStart = new Date(Date.UTC(y - 1, 12 + prevQuarterMonth, 1, 12, 0, 0));
    }
  } else {
    prevStart = new Date(Date.UTC(start.getUTCFullYear() - 1, 0, 1, 12, 0, 0));
  }

  // Previous period end is prevStart + (spanDays - 1) days, but for MTD we clamp to month length.
  let prevEnd = addDaysUtc(prevStart, spanDays - 1);
  if (period === "mtd") {
    const day = end.getUTCDate();
    const clamped = clampDayToMonth(prevStart.getUTCFullYear(), prevStart.getUTCMonth(), day);
    prevEnd = new Date(Date.UTC(prevStart.getUTCFullYear(), prevStart.getUTCMonth(), clamped, 12, 0, 0));
  }

  const label =
    period === "mtd"
      ? "This month"
      : period === "qtd"
        ? "This quarter"
        : "Year to date";

  return {
    start: ymd(start),
    end: ymd(end),
    prevStart: ymd(prevStart),
    prevEnd: ymd(prevEnd),
    label,
  };
}

