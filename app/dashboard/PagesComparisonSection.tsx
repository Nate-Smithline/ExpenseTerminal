import Link from "next/link";
import type { PageComparisonMetricRow } from "@/lib/page-metrics";

function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function barWidth(value: number, maxAbs: number): string {
  if (maxAbs <= 0) return "0%";
  const pct = Math.min(100, Math.max(0, (Math.abs(value) / maxAbs) * 100));
  return `${pct.toFixed(2)}%`;
}

export function PagesComparisonSection({
  rows,
  subtitle,
}: {
  rows: PageComparisonMetricRow[];
  subtitle: string;
}) {
  if (!rows || rows.length === 0) return null;

  const maxAbsProfit = Math.max(...rows.map((r) => Math.abs(r.profit)), 0);

  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-black/[0.06]">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-semibold text-mono-dark">Pages overview</h2>
          <p className="text-[11px] text-mono-light">{subtitle}</p>
        </div>
        <p className="mt-0.5 text-[11px] text-mono-light">
          Income, spend, and profit by each page&apos;s filters.
        </p>
      </div>

      <div className="px-5 py-3">
        <div className="grid grid-cols-12 gap-3 text-[11px] font-semibold uppercase tracking-wider text-mono-light">
          <div className="col-span-5">Page</div>
          <div className="col-span-2 text-right">Income</div>
          <div className="col-span-2 text-right">Spend</div>
          <div className="col-span-3">Profit</div>
        </div>

        <div className="mt-3 space-y-3">
          {rows.map((r) => {
            const profitPositive = r.profit >= 0;
            return (
              <div key={r.id} className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-5 min-w-0">
                  <Link
                    href={`/pages/${encodeURIComponent(r.id)}`}
                    className="text-sm font-medium text-mono-dark hover:underline truncate block"
                    title={r.title}
                  >
                    {r.title}
                  </Link>
                </div>
                <div className="col-span-2 text-right text-sm text-mono-medium tabular-nums">
                  {money(r.income)}
                </div>
                <div className="col-span-2 text-right text-sm text-mono-medium tabular-nums">
                  {money(r.spend)}
                </div>
                <div className="col-span-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-black/[0.06] overflow-hidden">
                      <div
                        className={profitPositive ? "h-full bg-[#16A34A]" : "h-full bg-danger"}
                        style={{ width: barWidth(r.profit, maxAbsProfit) }}
                        aria-hidden
                      />
                    </div>
                    <div className={`text-xs font-semibold tabular-nums ${profitPositive ? "text-[#16A34A]" : "text-danger"}`}>
                      {money(r.profit)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

