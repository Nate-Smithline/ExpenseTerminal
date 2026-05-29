"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IExport, IChevronD, IChevronR } from "@/components/ui/icons";
import { SCHEDULE_C_LINES } from "@/lib/tax/schedule-c-lines";

// ─── Types ─────────────────────────────────────────────────────────────────

interface TaxSummary {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  selfEmploymentTax: number;
  estimatedFederalTax: number;
  totalTaxDue: number;
  effectiveRate: number;
  quarterlyPayments: QuarterlyPayment[];
  scheduleC: ScheduleCSection;
  taxRate: number;
}

interface QuarterlyPayment {
  quarter: number;
  dueDate: string;
  amount: number;
  paid: boolean;
  amountPaid?: number;
}

interface ScheduleCSection {
  income: ScheduleCLine[];
  expenses: ScheduleCLine[];
}

interface ScheduleCLine {
  line: string;
  label: string;
  amount: number;
  transactionCount: number;
  transactions?: ScheduleCTxn[];
}

interface ScheduleCTxn {
  id: string;
  date: string;
  vendor: string;
  amount: number;
  deduction_percent?: number;
}

const QUARTERLY_LABELS: Record<number, string> = { 1: "Q1", 2: "Q2", 3: "Q3", 4: "Q4" };
const QUARTERLY_DUE: Record<number, string> = {
  1: "Apr 15",
  2: "Jun 15",
  3: "Sep 15",
  4: "Jan 15",
};

function fmtMoney(n: number): string {
  return Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function currentYear(): number {
  return new Date().getFullYear();
}

function normalizeTaxSummary(raw: Record<string, unknown>): TaxSummary {
  const grossIncome = Number(raw.grossIncome ?? raw.totalIncome ?? 0);
  const totalExpenses = Number(raw.totalExpenses ?? 0);
  const netProfit = Number(raw.netProfit ?? 0);
  const selfEmploymentTax = Number(raw.selfEmploymentTax ?? 0);
  const perQuarter = Number(raw.estimatedQuarterlyPayment ?? 0);
  const totalTaxDue = perQuarter * 4;
  const rawRate = Number(raw.taxRate ?? 0.24);
  const taxRatePct = rawRate <= 1 ? Math.round(rawRate * 100) : rawRate;

  return {
    totalIncome: grossIncome,
    totalExpenses,
    netProfit,
    selfEmploymentTax,
    estimatedFederalTax: Math.max(0, totalTaxDue - selfEmploymentTax),
    totalTaxDue,
    effectiveRate: Number(raw.effectiveTaxRate ?? 0),
    taxRate: taxRatePct,
    quarterlyPayments: [],
    scheduleC: { income: [], expenses: [] },
  };
}

// ─── Main component ─────────────────────────────────────────────────────────

export function TaxPageClient() {
  const [year, setYear] = useState(currentYear);
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [qPayments, setQPayments] = useState<QuarterlyPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingQuarter, setMarkingQuarter] = useState<number | null>(null);
  const [openParts, setOpenParts] = useState<Set<string>>(new Set(["income", "expenses"]));
  const [openLines, setOpenLines] = useState<Set<string>>(new Set());

  const loadQuarterly = useCallback(async (y: number, estimatedPerQuarter: number) => {
    const res = await fetch(
      `/api/tax/quarterly-payments?tax_year=${y}&estimated_per_quarter=${estimatedPerQuarter}`
    );
    if (!res.ok) {
      setQPayments([1, 2, 3, 4].map((quarter) => ({
        quarter,
        dueDate: QUARTERLY_DUE[quarter],
        amount: estimatedPerQuarter,
        paid: false,
      })));
      return;
    }
    const { payments } = await res.json();
    setQPayments(payments ?? []);
  }, []);

  const load = useCallback(async (y: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tax-details/summary?tax_year=${y}`);
      const raw = await res.json();
      if (!res.ok) {
        setSummary(null);
        setQPayments([]);
        return;
      }
      const normalized = normalizeTaxSummary(raw);
      setSummary(normalized);
      await loadQuarterly(y, normalized.totalTaxDue / 4);
    } catch {
      setSummary(null);
      setQPayments([]);
    } finally {
      setLoading(false);
    }
  }, [loadQuarterly]);

  useEffect(() => { load(year); }, [year, load]);

  async function toggleQuarterPaid(quarter: number, paid: boolean, estimate: number) {
    setMarkingQuarter(quarter);
    try {
      const res = await fetch("/api/tax/quarterly-payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tax_year: year,
          quarter,
          paid,
          amount_paid: paid ? estimate : undefined,
        }),
      });
      if (res.ok) await loadQuarterly(year, estimate);
    } finally {
      setMarkingQuarter(null);
    }
  }

  function togglePart(part: string) {
    setOpenParts(prev => {
      const next = new Set(prev);
      next.has(part) ? next.delete(part) : next.add(part);
      return next;
    });
  }

  function toggleLine(line: string) {
    setOpenLines(prev => {
      const next = new Set(prev);
      next.has(line) ? next.delete(line) : next.add(line);
      return next;
    });
  }

  const netProfit = summary?.netProfit ?? 0;
  const income = summary?.totalIncome ?? 0;
  const expenses = summary?.totalExpenses ?? 0;
  const seTax = summary?.selfEmploymentTax ?? 0;
  const fedTax = summary?.estimatedFederalTax ?? 0;
  const totalTax = summary?.totalTaxDue ?? 0;
  const seTaxPct = income > 0 ? ((seTax / income) * 100).toFixed(1) : "14.13";
  const fedTaxPct = summary?.taxRate ? `${summary.taxRate}` : "22";

  const incomeLines = summary?.scheduleC?.income ?? [];
  const expenseLines = summary?.scheduleC?.expenses ?? [];

  return (
    <div className="page-anim">
      {/* Page header */}
      <header className="pagehead">
        <div>
          <div className="pagehead__eyebrow">Tax · Schedule C</div>
          <h1 className="pagehead__title">Tax <em>{year}</em></h1>
          <div className="pagehead__sub">
            Your live Schedule C, built automatically from Business and Partial transactions.
          </div>
        </div>
        <div className="pagehead__right">
          <div className="period">
            <button className="period__btn" onClick={() => setYear(y => y - 1)}>‹</button>
            <div className="period__label">{year}</div>
            <button className="period__btn" onClick={() => setYear(y => y + 1)}>›</button>
          </div>
          <button className="btn btn--ghost">
            <IExport size={14} /> Export PDF
          </button>
          <button className="btn btn--primary">Send to accountant</button>
        </div>
      </header>

      <div className="tax">
        {/* Hero — dark left + white estimate right */}
        <div className="tax__hero">
          <div className="tax__hero-l">
            <div className="uppercase-label">Estimated net profit YTD</div>
            <div className="money money--xl" style={{ marginTop: 6, color: "var(--bone)" }}>
              {loading ? "—" : fmtMoney(netProfit)}
            </div>
            {netProfit === 0 && !loading && (
              <div className="tax__hero-sub">
                Start tagging transactions as Business to build your Schedule C
              </div>
            )}

            {/* Quarterly payments */}
            <div className="tax__hero-quarter">
              {qPayments.map(q => (
                <div key={q.quarter}>
                  <div style={{ fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", fontWeight: 700 }}>
                    {QUARTERLY_LABELS[q.quarter]}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 18, marginTop: 4, fontVariantNumeric: "tabular-nums", color: q.paid ? "var(--forest-mid)" : "rgba(255,255,255,0.5)" }}>
                    {q.amount > 0 ? fmtMoney(q.amount) : "$0"}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                    {q.paid ? "Paid" : `Due ${QUARTERLY_DUE[q.quarter]}`}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Estimate box */}
          <div className="tax__hero-r">
            <div className="tax__estimate">
              <div className="uppercase-label">Estimated tax</div>
              <div className="tax__estimate-row">
                <span>Self-employment ({seTaxPct}%)</span>
                <strong className="money">{loading ? "—" : fmtMoney(seTax)}</strong>
              </div>
              <div className="tax__estimate-row">
                <span>Federal income ({fedTaxPct}%)</span>
                <strong className="money">{loading ? "—" : fmtMoney(fedTax)}</strong>
              </div>
              <div className="tax__estimate-row tax__estimate-row--total">
                <span>Tax to set aside</span>
                <strong className="money" style={{ color: "var(--ember)" }}>
                  {loading ? "—" : fmtMoney(totalTax)}
                </strong>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 12 }}>
                Estimate only. Confirm with your CPA.
              </div>
              <Link href="/settings/profile" className="btn btn--ghost tax__estimate-cta" style={{ marginTop: 14, width: "100%", justifyContent: "center" }}>
                Adjust filing status in Settings → Profile
              </Link>
            </div>
          </div>
        </div>

        {/* Estimated payments — full detail */}
        <div className="card" style={{ padding: "20px 24px" }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>Estimated payments</h2>
            <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0, lineHeight: 1.5 }}>
              Quarterly IRS due dates for {year}. Estimates are based on your categorized business activity.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {qPayments.map((row) => (
              <div
                key={row.quarter}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(48px, 60px) minmax(100px, 120px) 1fr 1fr auto",
                  gap: 16,
                  alignItems: "center",
                  padding: "12px 16px",
                  background: "var(--bone)",
                  border: "1px solid var(--border-soft)",
                  borderRadius: "var(--r-2)",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14 }}>{QUARTERLY_LABELS[row.quarter]}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Due {row.dueDate}</div>
                <div>
                  <div className="uppercase-label" style={{ marginBottom: 2 }}>Estimate</div>
                  <div style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    {row.amount > 0 ? fmtMoney(row.amount) : "—"}
                  </div>
                </div>
                <div>
                  <div className="uppercase-label" style={{ marginBottom: 2 }}>Paid</div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                      color: row.paid ? "var(--forest-deep)" : "var(--ink-3)",
                    }}
                  >
                    {row.paid && (row.amountPaid ?? 0) > 0 ? fmtMoney(row.amountPaid!) : row.paid ? "Yes" : "—"}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost btn--mini"
                  disabled={markingQuarter === row.quarter || loading}
                  onClick={() => toggleQuarterPaid(row.quarter, !row.paid, row.amount)}
                >
                  {markingQuarter === row.quarter
                    ? "Saving…"
                    : row.paid
                      ? "Mark unpaid"
                      : "Mark paid"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Part I — Income */}
        <div className="card tax__part" style={{ overflow: "hidden" }}>
          <div className="tax__part-head" onClick={() => togglePart("income")}>
            <div className="tax__part-title">Part I — Income</div>
            <div className="tax__part-right">
              <span className="money">{loading ? "—" : fmtMoney(income)}</span>
              {openParts.has("income") ? <IChevronD size={14} /> : <IChevronR size={14} />}
            </div>
          </div>

          {openParts.has("income") && (
            <div className="tax__part-body">
              {incomeLines.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
                  No income tagged as Business yet
                </div>
              ) : (
                incomeLines.map(line => (
                  <ScheduleLine
                    key={line.line}
                    line={line}
                    open={openLines.has(line.line)}
                    onToggle={() => toggleLine(line.line)}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Part II — Expenses */}
        <div className="card tax__part" style={{ overflow: "hidden" }}>
          <div className="tax__part-head" onClick={() => togglePart("expenses")}>
            <div className="tax__part-title">Part II — Expenses</div>
            <div className="tax__part-right">
              <span className="money">{loading ? "—" : fmtMoney(expenses)}</span>
              {openParts.has("expenses") ? <IChevronD size={14} /> : <IChevronR size={14} />}
            </div>
          </div>

          {openParts.has("expenses") && (
            <div className="tax__part-body">
              {expenseLines.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
                  Tag transactions as Business or Partial in the Budget page to populate this automatically
                </div>
              ) : (
                expenseLines.map(line => (
                  <ScheduleLine
                    key={line.line}
                    line={line}
                    open={openLines.has(line.line)}
                    onToggle={() => toggleLine(line.line)}
                  />
                ))
              )}

              {/* All Schedule C lines as zero stubs when no data */}
              {expenseLines.length === 0 && (
                <div style={{ padding: "8px 24px 16px", display: "flex", flexDirection: "column", gap: 0 }}>
                  {SCHEDULE_C_LINES.map(def => (
                    <div
                      key={def.line}
                      className="schedline__row"
                      style={{ opacity: 0.4, cursor: "default" }}
                    >
                      <div />
                      <div className="schedline__line">Line {def.line} · {def.label}</div>
                      <div className="schedline__count">0 transactions</div>
                      <div className="schedline__amount">$0.00</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — Net Profit (Line 31) */}
        <div className="tax__foot">
          <div>
            <div className="uppercase-label">Net Profit (Line 31)</div>
            <div className="money money--big" style={{ marginTop: 4 }}>
              {loading ? "—" : fmtMoney(netProfit)}
            </div>
          </div>
          <div className="tax__foot-actions">
            <button className="btn btn--ghost"><IExport size={14} /> Export CSV</button>
            <button className="btn btn--ghost">Form 1040-ES</button>
            <button className="btn btn--primary">Send to accountant</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ScheduleLine ─────────────────────────────────────────────────────────

interface ScheduleLineProps {
  line: ScheduleCLine;
  open: boolean;
  onToggle: () => void;
}

function ScheduleLine({ line, open, onToggle }: ScheduleLineProps) {
  return (
    <div className={`schedline${open ? " is-open" : ""}`}>
      <div className="schedline__row" onClick={onToggle}>
        <div className="schedline__chev">
          {open ? <IChevronD size={13} /> : <IChevronR size={13} />}
        </div>
        <div className="schedline__line">{line.label}</div>
        <div className="schedline__count">{line.transactionCount} transaction{line.transactionCount !== 1 ? "s" : ""}</div>
        <div className="schedline__amount">{fmtMoney(line.amount)}</div>
      </div>

      {open && line.transactions && line.transactions.length > 0 && (
        <div className="schedline__txns">
          {line.transactions.map(tx => (
            <div key={tx.id} className="schedline__txn">
              <div className="schedline__txn-date">{tx.date}</div>
              <div>{tx.vendor}</div>
              <div className="schedline__txn-amount">
                {tx.deduction_percent && tx.deduction_percent < 100
                  ? `${tx.deduction_percent}% of `
                  : ""}
                {fmtMoney(tx.amount)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
