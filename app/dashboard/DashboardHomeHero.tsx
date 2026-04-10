import type { DashboardSnapshotDeltas } from "@/lib/dashboard-snapshot-deltas";

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatSignedUsd(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${formatUsd(n)}`;
}

function formatSnapshotDate(ymd: string | null) {
  if (!ymd) return null;
  try {
    const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
    if (!y || !m || !d) return ymd;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return ymd;
  }
}

function formatBalanceAsOf(iso: string | null) {
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
  snapshot: DashboardSnapshotDeltas;
}) {
  const asOfLabel = formatBalanceAsOf(balanceAsOf);
  const snapLabel = formatSnapshotDate(snapshot.snapshotDate);

  return (
    <div className="overflow-hidden rounded-2xl border border-bg-tertiary/60 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      <div className="border-b border-bg-tertiary/50 bg-gradient-to-b from-bg-secondary/40 to-white px-5 py-5 sm:px-6 sm:py-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-mono-light">Net worth</p>
        <p className="mt-1 font-display text-3xl font-normal tracking-tight text-mono-dark sm:text-4xl tabular-nums">
          {formatUsd(netWorth)}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-mono-medium">
          <span>
            <span className="text-mono-light">Assets </span>
            <span className="font-medium tabular-nums text-mono-dark">{formatUsd(assets)}</span>
          </span>
          <span>
            <span className="text-mono-light">Liabilities </span>
            <span className="font-medium tabular-nums text-mono-dark">{formatUsd(liabilities)}</span>
          </span>
        </div>
        {asOfLabel ? (
          <p className="mt-2 text-[11px] text-mono-light">Balances as of {asOfLabel}</p>
        ) : (
          <p className="mt-2 text-[11px] text-mono-light">Based on connected and manual account balances</p>
        )}
      </div>

      {snapshot.hasBaseline && snapshot.netWorthDelta != null && snapLabel ? (
        <div className="space-y-3 px-5 py-4 sm:px-6">
          <p className="text-[13px] leading-snug text-mono-medium">
            <span className="font-medium text-mono-dark">Since {snapLabel}</span>
            <span className="text-mono-light"> (last saved snapshot)</span>
            {" · "}
            <span
              className={
                snapshot.netWorthDelta > 0
                  ? "font-semibold text-[#34c759]"
                  : snapshot.netWorthDelta < 0
                    ? "font-semibold text-[#ff3b30]"
                    : "font-semibold text-mono-dark"
              }
            >
              Net worth {formatSignedUsd(snapshot.netWorthDelta)}
            </span>
          </p>
          {snapshot.assetsDelta != null && snapshot.liabilitiesDelta != null ? (
            <p className="text-[12px] text-mono-light">
              Assets {formatSignedUsd(snapshot.assetsDelta)} · Liabilities{" "}
              {formatSignedUsd(snapshot.liabilitiesDelta)}
            </p>
          ) : null}
          {snapshot.topAccountDeltas.length > 0 ? (
            <ul className="space-y-1.5 text-[12px] text-mono-medium">
              {snapshot.topAccountDeltas.map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate text-mono-dark">{a.name}</span>
                  <span
                    className={
                      a.delta > 0
                        ? "shrink-0 tabular-nums text-[#34c759]"
                        : a.delta < 0
                          ? "shrink-0 tabular-nums text-[#ff3b30]"
                          : "shrink-0 tabular-nums text-mono-light"
                    }
                  >
                    {formatSignedUsd(a.delta)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="px-5 py-4 sm:px-6">
          <p className="text-[12px] leading-relaxed text-mono-light">
            Snapshot history will appear here once daily net worth snapshots are recorded for your workspace.
          </p>
        </div>
      )}
    </div>
  );
}
