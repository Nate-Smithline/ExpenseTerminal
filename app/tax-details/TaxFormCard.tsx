"use client";

import { useState } from "react";
import { SCHEDULE_C_LINES, type ScheduleCLine } from "@/lib/tax/schedule-c-lines";

interface TaxFormCardProps {
  title: string;
  subtitle: string;
  lineBreakdown: Record<string, number>;
  transactions: Array<{
    id: string;
    vendor: string;
    amount: string | number;
    date: string;
    schedule_c_line: string | null;
    category: string | null;
    status: string;
  }>;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function TaxFormCard({ title, subtitle, lineBreakdown, transactions }: TaxFormCardProps) {
  const [expandedLine, setExpandedLine] = useState<string | null>(null);

  const breakdown = lineBreakdown && typeof lineBreakdown === "object" && !Array.isArray(lineBreakdown)
    ? lineBreakdown
    : {};
  const linesWithAmounts = SCHEDULE_C_LINES.filter(
    (l) => (breakdown[l.line] ?? 0) > 0
  );
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

  function getTransactionsForLine(line: ScheduleCLine) {
    return transactions.filter(
      (t) => (t.schedule_c_line || "27") === line.line
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-lg font-semibold text-mono-dark">{title}</h3>
          <p className="text-xs text-mono-light mt-0.5">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-mono-dark tabular-nums">
            {formatCurrency(total)}
          </p>
          <p className="text-xs text-mono-light">Total deductions</p>
        </div>
      </div>

      <div className="divide-y divide-bg-tertiary/30">
        {linesWithAmounts.map((line) => {
          const amount = breakdown[line.line] ?? 0;
          const isExpanded = expandedLine === line.line;
          const lineTxs = isExpanded ? getTransactionsForLine(line) : [];
          const allConfirmed = transactions
            .filter((t) => (t.schedule_c_line || "27") === line.line)
            .every((t) => t.status === "completed");

          return (
            <div key={line.line}>
              <button
                onClick={() => setExpandedLine(isExpanded ? null : line.line)}
                className="w-full flex items-center gap-3 py-3 text-left hover:bg-bg-secondary/40 transition-colors rounded-lg px-2 -mx-2"
              >
                <span className="text-xs text-mono-light w-10 tabular-nums shrink-0">
                  Line {line.line}
                </span>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    allConfirmed ? "bg-success" : "bg-warning"
                  }`}
                />
                <span className="flex-1 text-sm text-mono-dark font-medium">
                  {line.label}
                </span>
                <span className="text-sm font-medium text-mono-dark tabular-nums">
                  {formatCurrency(amount)}
                </span>
                <span className="material-symbols-rounded text-[16px] text-mono-light">
                  {isExpanded ? "expand_less" : "expand_more"}
                </span>
              </button>

              {isExpanded && lineTxs.length > 0 && (
                <div className="ml-14 mb-3 space-y-1 animate-in">
                  {lineTxs.slice(0, 20).map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-1.5 px-2 text-xs rounded hover:bg-bg-secondary/60 transition-colors"
                    >
                      <span className="text-mono-medium truncate flex-1 mr-3">
                        {tx.vendor}
                      </span>
                      <span className="text-mono-light shrink-0 mr-3">
                        {new Date(tx.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="text-mono-dark font-medium tabular-nums shrink-0">
                        {formatCurrency(Math.abs(Number(tx.amount)))}
                      </span>
                    </div>
                  ))}
                  {lineTxs.length > 20 && (
                    <p className="text-xs text-mono-light px-2">
                      + {lineTxs.length - 20} more transactions
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {linesWithAmounts.length === 0 && (
        <p className="text-sm text-mono-light text-center py-8">
          No categorized expenses yet. Complete transactions in your Inbox to see them here.
        </p>
      )}
    </div>
  );
}
