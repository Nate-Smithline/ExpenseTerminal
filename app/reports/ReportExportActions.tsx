"use client";

import { useState } from "react";
import { persistTaxYear } from "@/lib/tax-year-cookie";

export function ReportExportActions({ defaultYear }: { defaultYear: number }) {
  const [year, setYear] = useState(defaultYear);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [loading, setLoading] = useState<"csv" | "pdf" | null>(null);

  function download(format: "csv" | "pdf") {
    setLoading(format);
    const params = new URLSearchParams({ format, tax_year: String(year) });
    if (typeFilter) params.set("type", typeFilter);
    const url = `/api/reports/export?${params.toString()}`;
    window.open(url, "_blank");
    setTimeout(() => setLoading(null), 500);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-mono-dark">Tax Year:</label>
          <select
            value={year}
            onChange={(e) => {
              const y = parseInt(e.target.value, 10);
              persistTaxYear(y);
              setYear(y);
            }}
            className="border border-bg-tertiary rounded-md px-3 py-1.5 text-sm"
          >
            {[0, 1, 2].map((i) => {
              const y = new Date().getFullYear() - i;
              return <option key={y} value={y}>{y}</option>;
            })}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-mono-dark">Filter:</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-bg-tertiary rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">All (income + expenses)</option>
            <option value="expense">Expenses only</option>
            <option value="income">Income only</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => download("csv")}
          disabled={loading !== null}
          className="btn-secondary"
        >
          {loading === "csv" ? "Preparing…" : "Export CSV"}
        </button>
        <button
          onClick={() => download("pdf")}
          disabled={loading !== null}
          className="btn-primary"
        >
          {loading === "pdf" ? "Preparing…" : "Generate PDF"}
        </button>
      </div>
    </div>
  );
}
