"use client";

import type { Database } from "@/lib/types/database";
import type { ActivityVisibleColumn } from "@/lib/validation/schemas";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

function formatDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatAmount(amount: string, transactionType: string | null) {
  const n = Number(amount);
  const abs = Math.abs(n);
  const formatted = abs.toFixed(2);
  if (transactionType === "income") return `+$${formatted}`;
  return `-$${formatted}`;
}

function formatAiConfidence(val: number | null) {
  if (val == null) return "—";
  return `${Math.round(Number(val) * 100)}%`;
}

function cellValue(t: Transaction, col: string): React.ReactNode {
  switch (col) {
    case "date":
      return formatDate(t.date);
    case "vendor":
      return t.vendor || "—";
    case "description":
      return t.description ? String(t.description).slice(0, 80) + (String(t.description).length > 80 ? "…" : "") : "—";
    case "amount":
      return formatAmount(t.amount, t.transaction_type);
    case "transaction_type":
      return t.transaction_type ?? "—";
    case "status":
      return t.status ?? "—";
    case "category":
      return t.category ?? "—";
    case "schedule_c_line":
      return t.schedule_c_line ?? "—";
    case "ai_confidence":
      return formatAiConfidence(t.ai_confidence);
    case "business_purpose":
      return t.business_purpose ? String(t.business_purpose).slice(0, 60) + (String(t.business_purpose).length > 60 ? "…" : "") : "—";
    case "quick_label":
      return t.quick_label ?? "—";
    case "notes":
      return t.notes ? String(t.notes).slice(0, 60) + (String(t.notes).length > 60 ? "…" : "") : "—";
    case "created_at":
      return formatDate(t.created_at);
    default:
      return "—";
  }
}

const COLUMN_LABELS: Record<ActivityVisibleColumn, string> = {
  date: "Date",
  vendor: "Vendor",
  description: "Description",
  amount: "Amount",
  transaction_type: "Type",
  status: "Status",
  category: "Category",
  schedule_c_line: "Schedule C",
  ai_confidence: "AI %",
  business_purpose: "Business purpose",
  quick_label: "Quick label",
  notes: "Notes",
  created_at: "Created",
};

interface ActivityTableProps {
  transactions: Transaction[];
  visibleColumns: string[];
  selectedId: string | null;
  onSelectRow: (tx: Transaction | null) => void;
}

export function ActivityTable({
  transactions,
  visibleColumns,
  selectedId,
  onSelectRow,
}: ActivityTableProps) {
  const cols = visibleColumns.length > 0 ? visibleColumns : ["date", "vendor", "amount", "status"];

  return (
    <div className="min-w-0 overflow-x-auto -mx-2 px-2 md:mx-0 md:px-0 rounded-lg border border-bg-tertiary/40 bg-white">
      <table className="w-full border-collapse text-sm min-w-[500px]">
        <thead>
          <tr className="border-b border-bg-tertiary/70 bg-bg-tertiary">
            {cols.map((key) => (
              <th
                key={key}
                className="text-left py-2.5 px-2 md:px-3 text-xs font-medium uppercase tracking-wider text-mono-medium whitespace-nowrap first:sticky first:left-0 first:bg-bg-tertiary first:z-[1] first:min-w-[90px] first:shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]"
              >
                {COLUMN_LABELS[key as ActivityVisibleColumn] ?? key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr
              key={t.id}
              onClick={() => onSelectRow(selectedId === t.id ? null : t)}
              className={`group border-b border-bg-tertiary/40 hover:bg-bg-secondary/60 cursor-pointer transition-colors ${selectedId === t.id ? "bg-bg-secondary/50" : ""}`}
            >
              {cols.map((col) => (
                <td
                  key={col}
                  className="py-2.5 px-2 md:px-3 text-mono-dark whitespace-nowrap first:sticky first:left-0 first:bg-white first:z-[1] first:min-w-[90px] first:shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] first:group-hover:bg-bg-secondary/60"
                >
                  {cellValue(t, col)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
