import type { DashboardMetrics } from "@/lib/dashboard-metrics";

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

type CardProps = {
  label: string;
  value: string;
  hint?: string;
};

function StatCard({ label, value, hint }: CardProps) {
  return (
    <div className="rounded-xl border border-bg-tertiary/60 bg-white px-4 py-3 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-mono-light">{label}</p>
      <p className="mt-1 font-display text-xl font-normal tabular-nums text-mono-dark">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-mono-light">{hint}</p> : null}
    </div>
  );
}

export function MinimalDashboardCards({ metrics }: { metrics: DashboardMetrics }) {
  const netFlow = metrics.totalIncome - metrics.totalExpenses;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Expenses" value={formatUsd(metrics.totalExpenses)} />
      <StatCard label="Income" value={formatUsd(metrics.totalIncome)} />
      <StatCard label="Transactions" value={String(metrics.transactionCount)} hint="In this period" />
      <StatCard
        label="Net (income − expenses)"
        value={formatUsd(netFlow)}
        hint={netFlow >= 0 ? "Positive cash flow" : "Spending exceeds income"}
      />
    </div>
  );
}
