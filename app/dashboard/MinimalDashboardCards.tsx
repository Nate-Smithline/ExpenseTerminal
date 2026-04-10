import Link from "next/link";
import type { DashboardMetricSet } from "@/lib/dashboard-metrics";

function formatMoney(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function formatPct(p: number | null): string | null {
  if (p == null || !Number.isFinite(p)) return null;
  const sign = p > 0 ? "+" : "";
  return `${sign}${(p * 100).toFixed(0)}%`;
}

function deltaTone(p: number | null): string {
  if (p == null || !Number.isFinite(p)) return "text-mono-light";
  if (p > 0) return "text-[#16A34A]";
  if (p < 0) return "text-danger";
  return "text-mono-light";
}

function activityHref(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return qs ? `/activity?${qs}` : "/activity";
}

function card(
  title: string,
  value: string,
  subtitle: string,
  href: string,
  delta?: { text: string | null; toneClass: string },
) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-black/[0.06] bg-white px-4 py-3.5 transition hover:border-black/[0.10] hover:bg-[#fafafa]/80"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-mono-light">{title}</p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-mono-dark tabular-nums">
            {value}
          </p>
          <p className="mt-0.5 text-[11px] text-mono-medium">{subtitle}</p>
        </div>
        {delta?.text ? (
          <p className={`text-[11px] font-semibold tabular-nums shrink-0 ${delta.toneClass}`}>
            {delta.text}
          </p>
        ) : null}
      </div>
      <span className="mt-2 inline-block text-[11px] font-medium text-[#007aff] opacity-0 transition group-hover:opacity-100">
        View
      </span>
    </Link>
  );
}

function flowCardHref(
  metrics: DashboardMetricSet,
  kind: "income" | "spend" | "profit",
): string {
  const { range, pageScope } = metrics;
  if (pageScope) {
    return `/pages/${pageScope.id}`;
  }
  if (kind === "income") {
    return activityHref({
      transaction_type: "income",
      date_from: range.start,
      date_to: range.end,
    });
  }
  if (kind === "spend") {
    return activityHref({
      transaction_type: "expense",
      date_from: range.start,
      date_to: range.end,
    });
  }
  return activityHref({
    date_from: range.start,
    date_to: range.end,
  });
}

export function MinimalDashboardCards({ metrics }: { metrics: DashboardMetricSet }) {
  const { range, pageScope } = metrics;
  const subtitle = pageScope
    ? `${pageScope.title} · ${range.start} → ${range.end}`
    : `${range.start} → ${range.end}`;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {card(
        "Income",
        formatMoney(metrics.income),
        subtitle,
        flowCardHref(metrics, "income"),
        { text: formatPct(metrics.incomeDeltaPct), toneClass: deltaTone(metrics.incomeDeltaPct) },
      )}
      {card(
        "Spend",
        formatMoney(metrics.spend),
        subtitle,
        flowCardHref(metrics, "spend"),
        { text: formatPct(metrics.spendDeltaPct), toneClass: deltaTone(metrics.spendDeltaPct) },
      )}
      {card(
        "Profit",
        formatMoney(metrics.profit),
        subtitle,
        flowCardHref(metrics, "profit"),
        { text: formatPct(metrics.profitDeltaPct), toneClass: deltaTone(metrics.profitDeltaPct) },
      )}
      {card("Assets", formatMoney(metrics.assets), "Across included accounts", "/data-sources")}
      {card("Liabilities", formatMoney(metrics.liabilities), "Across included accounts", "/data-sources")}
      {card("Net worth", formatMoney(metrics.netWorth), "Assets − liabilities", "/data-sources")}
    </div>
  );
}

