import Link from "next/link";
import type { PageComparisonRow } from "@/lib/page-metrics";

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function PagesComparisonSection({
  rows,
  subtitle,
}: {
  rows: PageComparisonRow[];
  subtitle: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-mono-light">Pages</h2>
        <p className="text-[11px] text-mono-light">{subtitle}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-bg-tertiary/60 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-bg-tertiary/60 bg-bg-secondary/30 text-[11px] font-semibold uppercase tracking-wide text-mono-light">
              <th className="px-4 py-2.5 font-medium">Page</th>
              <th className="hidden px-2 py-2.5 text-right font-medium sm:table-cell">Expenses</th>
              <th className="hidden px-2 py-2.5 text-right font-medium md:table-cell">Income</th>
              <th className="px-4 py-2.5 text-right font-medium">Txns</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSummary = row.pageId == null;
              const nameCell =
                row.pageId != null ? (
                  <Link
                    href={`/pages/${row.pageId}`}
                    className="font-medium text-mono-dark underline-offset-2 hover:text-[#0071e3] hover:underline"
                  >
                    {row.title}
                  </Link>
                ) : (
                  <span className="font-semibold text-mono-dark">{row.title}</span>
                );

              const fmt = (v: number | null) =>
                v == null ? (
                  <span className="text-mono-light">—</span>
                ) : (
                  <span className="tabular-nums text-mono-dark">{formatUsd(v)}</span>
                );

              const fmtCount = (v: number | null) =>
                v == null ? <span className="text-mono-light">—</span> : <span className="tabular-nums">{v}</span>;

              return (
                <tr
                  key={row.pageId ?? "summary"}
                  className={
                    isSummary
                      ? "border-b border-bg-tertiary/40 bg-bg-secondary/20"
                      : "border-b border-bg-tertiary/40 last:border-b-0"
                  }
                >
                  <td className="px-4 py-3 align-middle">{nameCell}</td>
                  <td className="hidden px-2 py-3 text-right align-middle sm:table-cell">{fmt(row.expenses)}</td>
                  <td className="hidden px-2 py-3 text-right align-middle md:table-cell">{fmt(row.income)}</td>
                  <td className="px-4 py-3 text-right align-middle">{fmtCount(row.transactionCount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] leading-relaxed text-mono-light">
        Workspace totals include every non-personal transaction in this period. Per-page amounts are not tracked in the
        database yet; use each page for its saved activity view.
      </p>
    </section>
  );
}
