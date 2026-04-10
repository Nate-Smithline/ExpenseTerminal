import Link from "next/link";
import type { DashboardSnapshotContext } from "@/lib/dashboard-snapshot-deltas";

function money(n: number | null | undefined, compact = false): string {
  const v = n != null && Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 0 : 2,
  }).format(v);
}

function moneyOrDash(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return money(n, true);
}

function formatPct(p: number | null): string {
  if (p == null || !Number.isFinite(p)) return "";
  const sign = p > 0 ? "+" : "";
  return `${sign}${(p * 100).toFixed(1)}%`;
}

function deltaClass(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "text-mono-light";
  if (n > 0) return "text-[#16A34A]";
  if (n < 0) return "text-danger";
  return "text-mono-medium";
}

function formatAsOf(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

export function DashboardHomeHero({
  netWorth,
  assets,
  liabilities,
  balanceAsOf,
  snapshot,
}: {
  netWorth: number;
  assets: number;
  liabilities: number;
  balanceAsOf: string | null;
  snapshot: DashboardSnapshotContext;
}) {
  const asOf = formatAsOf(balanceAsOf);
  const listed = snapshot.accounts.filter((a) => a.balance != null);

  return (
    <section className="rounded-2xl border border-black/[0.08] bg-white shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-black/[0.06]">
        <div className="p-6 md:p-8 space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-mono-light">Net worth</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-mono-dark tabular-nums">
              {money(netWorth)}
            </p>
            {asOf ? (
              <p className="mt-1 text-xs text-mono-light">Balances as of {asOf}</p>
            ) : (
              <p className="mt-1 text-xs text-mono-light">From connected and manual accounts</p>
            )}
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-mono-light">Assets</p>
              <p className="font-medium tabular-nums text-mono-dark">{money(assets, true)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-mono-light">Liabilities</p>
              <p className="font-medium tabular-nums text-mono-dark">{money(liabilities, true)}</p>
            </div>
          </div>

          <div className="space-y-3 border-t border-black/[0.06] pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-mono-light">Change vs snapshot</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] text-mono-medium">MTD</p>
                <p className={`text-sm font-semibold tabular-nums ${deltaClass(snapshot.netWorthMtd.amount)}`}>
                  {snapshot.netWorthMtd.amount == null ? "—" : money(snapshot.netWorthMtd.amount, true)}
                  {snapshot.netWorthMtd.pct != null ? (
                    <span className="ml-2 text-xs font-medium text-mono-medium">
                      {formatPct(snapshot.netWorthMtd.pct)}
                    </span>
                  ) : null}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-mono-medium">YTD</p>
                <p className={`text-sm font-semibold tabular-nums ${deltaClass(snapshot.netWorthYtd.amount)}`}>
                  {snapshot.netWorthYtd.amount == null ? "—" : money(snapshot.netWorthYtd.amount, true)}
                  {snapshot.netWorthYtd.pct != null ? (
                    <span className="ml-2 text-xs font-medium text-mono-medium">
                      {formatPct(snapshot.netWorthYtd.pct)}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-mono-light">
              Deltas use the latest daily snapshot before this month (MTD) or before this year (YTD). Run the nightly sync to record history.
            </p>
          </div>
        </div>

        <div className="p-6 md:p-8 flex flex-col min-h-[200px]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-mono-dark">Accounts</h3>
            <Link href="/data-sources" className="text-xs font-medium text-[#007aff] hover:underline">
              Manage
            </Link>
          </div>
          {listed.length === 0 ? (
            <p className="text-sm text-mono-medium">
              No balances yet.{" "}
              <Link href="/data-sources" className="text-[#007aff] font-medium hover:underline">
                Connect an account
              </Link>
              .
            </p>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0 -mx-1">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-wide text-mono-light border-b border-black/[0.06]">
                    <th className="py-2 pr-2 font-medium">Name</th>
                    <th className="py-2 px-2 text-right font-medium">Balance</th>
                    <th className="py-2 px-2 text-right font-medium hidden sm:table-cell">MTD</th>
                    <th className="py-2 pl-2 text-right font-medium hidden sm:table-cell">YTD</th>
                  </tr>
                </thead>
                <tbody>
                  {listed.map((a) => (
                    <tr key={a.data_source_id} className="border-b border-black/[0.04] last:border-0">
                      <td className="py-2.5 pr-2 font-medium text-mono-dark truncate max-w-[140px]" title={a.name}>
                        {a.name}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-mono-dark">
                        {moneyOrDash(a.balance)}
                      </td>
                      <td
                        className={`py-2.5 px-2 text-right tabular-nums text-xs hidden sm:table-cell ${deltaClass(a.mtdDelta)}`}
                      >
                        {a.mtdDelta == null ? "—" : money(a.mtdDelta, true)}
                      </td>
                      <td
                        className={`py-2.5 pl-2 text-right tabular-nums text-xs hidden sm:table-cell ${deltaClass(a.ytdDelta)}`}
                      >
                        {a.ytdDelta == null ? "—" : money(a.ytdDelta, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
