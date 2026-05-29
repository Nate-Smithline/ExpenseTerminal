"use client";

import { useCallback, useEffect, useState } from "react";
import { IExport, ITrendUp, ITrendDn } from "@/components/ui/icons";

// ─── Types ─────────────────────────────────────────────────────────────────

interface MonthData {
  month: string; // YYYY-MM
  income: number;
  expenses: number;
  net: number;
}

interface CashFlowData {
  months: MonthData[];
  totals: {
    income: number;
    expenses: number;
    net: number;
    savingsRate: number | null;
  };
  topCategories: { category: string; amount: number }[];
}

type Range = "1M" | "3M" | "6M" | "12M" | "24M";
const RANGE_MONTHS: Record<Range, number> = { "1M": 1, "3M": 3, "6M": 6, "12M": 12, "24M": 24 };

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function monthLabel(key: string): string {
  const d = new Date(key + "-01T12:00:00");
  return d.toLocaleString("en-US", { month: "short" });
}

// Mini bar chart rendered in SVG
function BarChart({ months }: { months: MonthData[] }) {
  if (months.length === 0) return null;
  const maxVal = Math.max(...months.flatMap(m => [m.income, m.expenses]), 1);
  const h = 200;
  const gap = 8;

  // Fixed viewBox width so the SVG always scales proportionally at width="100%"
  // regardless of how many months are shown. Bars are distributed evenly.
  const viewW = 600;
  const slotW = viewW / months.length;
  const bw = Math.max(6, Math.min(30, Math.floor((slotW - gap) / 2) - 6));
  const groupW = bw * 2 + gap;

  return (
    <svg viewBox={`0 0 ${viewW} ${h + 32}`} className="cf__chart" width="100%" style={{ overflow: "visible" }}>
      {months.map((m, i) => {
        const x = i * slotW + (slotW - groupW) / 2;
        const incH = Math.round((m.income / maxVal) * h);
        const expH = Math.round((m.expenses / maxVal) * h);
        return (
          <g key={m.month} transform={`translate(${x}, 0)`}>
            <rect x={0} y={h - incH} width={bw} height={incH} fill="var(--forest)" rx={3} opacity={0.85} />
            <rect x={bw + gap} y={h - expH} width={bw} height={expH} fill="var(--clay)" rx={3} opacity={0.7} />
            <text x={bw + gap / 2} y={h + 20} textAnchor="middle" fontSize={11} fill="var(--ink-3)" fontFamily="var(--font-sans)">
              {monthLabel(m.month)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function CashFlowPageClient() {
  const [range, setRange] = useState<Range>("6M");
  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (r: Range) => {
    setLoading(true);
    try {
      const months = RANGE_MONTHS[r];
      const res = await fetch(`/api/cashflow?months=${months}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  const totals = data?.totals;
  const months = data?.months ?? [];
  const topCats = data?.topCategories ?? [];
  const maxCatAmt = topCats[0]?.amount ?? 1;
  const hasData = months.some(m => m.income > 0 || m.expenses > 0);

  // Period label
  const now = new Date();
  const periodLabel = `Last ${range}`;

  return (
    <div className="page-anim">
      {/* Page header */}
      <header className="pagehead">
        <div>
          <div className="pagehead__eyebrow">
            Cash Flow · <span style={{ color: "var(--ink-3)" }}>{periodLabel.toLowerCase()}</span>
          </div>
          <h1 className="pagehead__title">
            Cash Flow <em>{now.toLocaleString("en-US", { month: "long", year: "numeric" })}</em>
          </h1>
          <div className="pagehead__sub">
            What came in, what went out, and what stayed put.
          </div>
        </div>
        <div className="pagehead__right">
          <div className="seg">
            {(["1M", "3M", "6M", "12M", "24M"] as Range[]).map(r => (
              <button
                key={r}
                className={`seg__btn${range === r ? " is-active" : ""}`}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
          <button className="btn btn--ghost">
            <IExport size={14} /> Export
          </button>
        </div>
      </header>

      <div className="cf">
        {/* Hero stats */}
        <div className="cf__hero">
          <div className="cf__stat">
            <div className="uppercase-label">Income</div>
            <div className="cf__stat-val cf__stat-val--forest">
              {loading ? "—" : fmtMoney(totals?.income ?? 0)}
            </div>
            <div className="cf__stat-sub">
              <ITrendUp size={12} /> {periodLabel}
            </div>
          </div>
          <div className="cf__stat">
            <div className="uppercase-label">Expenses</div>
            <div className="cf__stat-val">
              {loading ? "—" : fmtMoney(totals?.expenses ?? 0)}
            </div>
            <div className="cf__stat-sub">{periodLabel}</div>
          </div>
          <div className="cf__stat cf__stat--big">
            <div className="uppercase-label">Net cash</div>
            <div className="cf__stat-val">
              {loading ? "—" : (
                <>
                  {(totals?.net ?? 0) >= 0 ? "+" : "−"}
                  {fmtMoney(Math.abs(totals?.net ?? 0))}
                </>
              )}
            </div>
            <div className="cf__stat-sub">{periodLabel}</div>
          </div>
          <div className="cf__stat">
            <div className="uppercase-label">Savings rate</div>
            <div className="cf__stat-val cf__stat-val--wheat">
              {loading ? "—" : totals?.savingsRate != null ? `${totals.savingsRate}%` : "—"}
            </div>
            <div className="cf__stat-sub">of income kept</div>
          </div>
        </div>

        {/* Chart */}
        <div className="cf__chart-card card">
          <div className="cf__chart-head">
            <div>
              <div className="uppercase-label">Monthly inflow vs outflow</div>
              {hasData && (
                <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4 }}>
                  {months.length} months · {fmtMoney(totals?.income ?? 0)} in, {fmtMoney(totals?.expenses ?? 0)} out
                </div>
              )}
            </div>
            <div className="cf__legend">
              <span><span className="cf__dot" style={{ background: "var(--forest)" }} /> Income</span>
              <span><span className="cf__dot" style={{ background: "var(--clay)" }} /> Expenses</span>
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--border-soft)", paddingTop: 20 }}>
            {!hasData ? (
              <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-4)", fontSize: 13.5 }}>
                No transactions yet — connect accounts in the Accounts tab
              </div>
            ) : (
              <BarChart months={months} />
            )}
          </div>
        </div>

        {/* Bottom: income mix + top categories */}
        <div className="cf__bottom">
          {/* Income mix */}
          <div className="card cf__split">
            <div className="cf__split-head">
              <div>
                <div className="uppercase-label">Income sources</div>
                <div style={{ marginTop: 4, fontSize: 14, color: "var(--ink-3)" }}>
                  {loading ? "Loading…" : hasData ? `${fmtMoney(totals?.income ?? 0)} total` : "No income data"}
                </div>
              </div>
            </div>

            {hasData && (totals?.income ?? 0) > 0 ? (
              <div className="cf__bar2" style={{ background: "var(--bone-2)" }}>
                <div
                  className="cf__bar2-fill"
                  style={{ background: "var(--forest-tint)", width: "100%", minWidth: 60 }}
                >
                  <div className="cf__bar2-lbl">Income</div>
                  <div className="cf__bar2-val">{fmtMoney(totals?.income ?? 0)}</div>
                </div>
              </div>
            ) : (
              <div style={{ height: 64, background: "var(--bone-2)", borderRadius: "var(--r-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-4)", fontSize: 13 }}>
                No income data
              </div>
            )}
          </div>

          {/* Top categories */}
          <div className="card cf__cats">
            <div className="cf__split-head">
              <div className="uppercase-label">Top spend categories</div>
            </div>
            {topCats.length === 0 ? (
              <div style={{ color: "var(--ink-4)", fontSize: 13, paddingTop: 8 }}>
                No spending data yet
              </div>
            ) : (
              <div className="cf__catlist">
                {topCats.map(({ category, amount }) => (
                  <div key={category} className="cf__cat">
                    <div style={{ fontWeight: 500, fontSize: 13.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {category}
                    </div>
                    <div className="cf__cat-bar">
                      <div
                        className="cf__cat-bar-fill"
                        style={{ width: `${Math.round((amount / maxCatAmt) * 100)}%` }}
                      />
                    </div>
                    <div className="cf__cat-amt">{fmtMoney(amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
