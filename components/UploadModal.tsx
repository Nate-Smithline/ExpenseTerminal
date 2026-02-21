"use client";

import { useState, useEffect } from "react";
import Papa from "papaparse";
import { getStickyTaxYearClient, persistTaxYear } from "@/lib/tax-year-cookie";
import ExcelJS from "exceljs";

type UploadResult = {
  imported?: number;
  transactionIds?: string[];
  aiProcessed?: number;
  aiFailed?: number;
  aiError?: string;
  aiErrors?: string[];
  aiErrorSummary?: string;
  error?: string;
};

interface UploadModalProps {
  onClose: () => void;
  onCompleted: (result?: UploadResult) => Promise<void>;
  dataSourceId?: string;
}

type ParsedRow = {
  date: string;
  vendor: string;
  description?: string;
  amount: number;
  category?: string;
  notes?: string;
  transaction_type?: string;
};

function detectTransactionType(
  row: Record<string, string | number | undefined>,
  amount: number,
  explicitType?: string,
): string {
  if (explicitType) {
    const lower = explicitType.toLowerCase().trim();
    if (lower === "income" || lower === "credit" || lower === "deposit") return "income";
    if (lower === "expense" || lower === "debit" || lower === "charge") return "expense";
  }
  const lower = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]),
  );
  if (lower["credit"] != null) {
    const creditVal = Number(String(lower["credit"]).replace(/[$,]/g, ""));
    if (!Number.isNaN(creditVal) && creditVal > 0) return "income";
  }
  if (amount > 0) return "income";
  return "expense";
}

function excelSerialToDateString(n: number): string {
  const date = new Date((n - 25569) * 86400 * 1000);
  return date.toISOString().slice(0, 10);
}

function extractFromRow(
  row: Record<string, string | number | undefined>,
  keys: string[],
): string {
  const lower = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]),
  );
  for (const k of keys) {
    const v = lower[k.toLowerCase()];
    if (v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    if (typeof v === "number" && v > 10000 && v < 100000) return excelSerialToDateString(v);
    return s;
  }
  return "";
}

function extractAmount(
  row: Record<string, string | number | undefined>,
  keys: string[],
): number {
  const lower = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.toLowerCase().trim(), v]),
  );
  for (const k of keys) {
    const v = lower[k.toLowerCase()];
    if (v != null) {
      const n = Number(String(v).replace(/[$,]/g, ""));
      if (!Number.isNaN(n)) return n;
    }
  }
  for (const [header, val] of Object.entries(lower)) {
    if (val == null) continue;
    if (header.includes("amount") || header.includes("total") || header.includes("debit") || header.includes("credit")) {
      const n = Number(String(val).replace(/[$,]/g, ""));
      if (!Number.isNaN(n)) return header.includes("credit") ? -n : n;
    }
  }
  return NaN;
}

function parseCsvToRows(content: string): ParsedRow[] {
  const result = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true });
  return (result.data ?? [])
    .map((row) => {
      const amount = extractAmount(row, ["amount", "total", "debit", "credit"]);
      const explicitType = extractFromRow(row, ["transaction type", "transaction_type", "txn type"]) || undefined;
      const txType = detectTransactionType(row, amount, explicitType);
      return {
        date: extractFromRow(row, ["date", "posting date", "transaction date", "trans date", "postingdate"]),
        vendor: extractFromRow(row, ["vendor", "merchant", "payee", "name", "description", "memo"]),
        description: extractFromRow(row, ["description", "memo", "details", "notes"]),
        amount,
        category: extractFromRow(row, ["category", "type", "expense type", "expense category"]) || undefined,
        notes: extractFromRow(row, ["notes", "note", "comment", "comments"]) || undefined,
        transaction_type: txType,
      };
    })
    .filter((r) => r.date && r.vendor && !Number.isNaN(r.amount));
}

export function UploadModal({ onClose, onCompleted, dataSourceId }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());

  useEffect(() => {
    setTaxYear(getStickyTaxYearClient());
  }, []);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<"idle" | "parsing" | "uploading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState(0);

  function parseCsv(content: string) {
    setPreviewRows(parseCsvToRows(content).slice(0, 8));
  }

  async function parseExcel(file: File) {
    const data = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(data);
    const sheet = workbook.worksheets[0];
    if (!sheet) return;

    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => { headers[colNumber] = String(cell.value ?? "").toLowerCase().trim(); });

    const rows: ParsedRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values: Record<string, string | number> = {};
      row.eachCell((cell, colNumber) => {
        const h = headers[colNumber];
        if (h) values[h] = typeof cell.value === "number" || typeof cell.value === "string" ? cell.value : cell.value != null ? String(cell.value) : "";
      });
      const date = extractFromRow(values, ["date", "posting date", "transaction date", "trans date"]);
      const vendor = extractFromRow(values, ["vendor", "merchant", "payee", "name", "description", "memo"]);
      const amount = extractAmount(values, ["amount", "total", "debit", "credit"]);
      if (date && vendor && !Number.isNaN(amount)) rows.push({ date, vendor, amount });
    });
    setPreviewRows(rows.slice(0, 8));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);
    const ext = f.name.toLowerCase().split(".").pop();
    if (ext === "csv") { parseCsv(await f.text()); }
    else if (ext === "xlsx" || ext === "xls") { await parseExcel(f); }
    else { setError("Unsupported file type. Upload CSV or Excel."); }
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setStage("parsing");

    try {
      let rows: ParsedRow[] = [];
      const ext = file.name.toLowerCase().split(".").pop();

      if (ext === "csv") {
        rows = parseCsvToRows(await file.text());
      } else if (ext === "xlsx" || ext === "xls") {
        const data = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(data);
        const sheet = workbook.worksheets[0];
        if (sheet) {
          const headerRow = sheet.getRow(1);
          const headers: string[] = [];
          headerRow.eachCell((cell, colNumber) => { headers[colNumber] = String(cell.value ?? "").toLowerCase().trim(); });
          sheet.eachRow((r, rowNumber) => {
            if (rowNumber === 1) return;
            const values: Record<string, string | number> = {};
            r.eachCell((cell, colNumber) => { const h = headers[colNumber]; if (h) values[h] = cell.value as string | number; });
            const date = extractFromRow(values, ["date", "posting date", "transaction date", "trans date"]);
            const vendor = extractFromRow(values, ["vendor", "merchant", "payee", "name", "description", "memo"]);
            const amount = extractAmount(values, ["amount", "total", "debit", "credit"]);
            if (date && vendor && !Number.isNaN(amount)) rows.push({ date, vendor, amount });
          });
        }
      }

      if (rows.length === 0) {
        setStage("error");
        setError("No valid rows found. Need columns for date, vendor, and amount.");
        setLoading(false);
        return;
      }

      setRowCount(rows.length);
      setStage("uploading");

      const res = await fetch("/api/transactions/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, taxYear, ...(dataSourceId ? { dataSourceId } : {}) }),
      });

      const body = (await res.json().catch(() => ({}))) as {
        imported?: number;
        transactionIds?: string[];
        error?: string;
      };

      if (!res.ok) {
        setStage("error");
        throw new Error(body.error || "Failed to import");
      }

      setStage("done");

      // Return IDs so the parent can kick off background AI
      await onCompleted({
        imported: body.imported ?? 0,
        transactionIds: body.transactionIds ?? [],
      });
    } catch (e: unknown) {
      setStage("error");
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="rounded-xl bg-white shadow-lg max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-tertiary/40">
          <div>
            <h2 className="text-sm font-semibold text-mono-dark">Upload Transactions</h2>
            <p className="text-[11px] text-mono-light mt-0.5">CSV or Excel. AI categorization runs in the background.</p>
          </div>
          <button onClick={onClose} className="text-mono-light hover:text-mono-dark text-xs">Close</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Tax year */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-mono-medium">Tax Year</label>
            <select
              value={taxYear}
              onChange={(e) => {
                const y = parseInt(e.target.value, 10);
                persistTaxYear(y);
                setTaxYear(y);
              }}
              className="bg-white border border-bg-tertiary rounded-md px-2 py-1 text-xs"
            >
              <option value={taxYear}>{taxYear}</option>
              <option value={taxYear - 1}>{taxYear - 1}</option>
              <option value={taxYear - 2}>{taxYear - 2}</option>
            </select>
          </div>

          {/* Drop zone */}
          <div className="border-2 border-dashed border-bg-tertiary rounded-lg p-6 bg-bg-secondary/50 text-center">
            <p className="text-xs text-mono-medium mb-2">Drop a file here, or click to browse</p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="text-xs"
            />
          </div>

          {/* Preview */}
          {previewRows.length > 0 && (
            <>
              {previewRows.some((r) => r.transaction_type === "income") && (
                <div className="rounded-md bg-accent-sage/10 px-3 py-2 text-xs text-accent-sage">
                  Income transactions detected. These will be added to your business revenue.
                </div>
              )}
              <div className="border border-bg-tertiary/60 rounded-lg overflow-auto max-h-48 text-[11px]">
                <table className="min-w-full">
                  <thead className="bg-bg-secondary text-mono-light">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Date</th>
                      <th className="px-2 py-1.5 text-left font-medium">Vendor</th>
                      <th className="px-2 py-1.5 text-right font-medium">Amount</th>
                      <th className="px-2 py-1.5 text-left font-medium">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className={idx % 2 ? "bg-bg-secondary/30" : ""}>
                        <td className="px-2 py-1">{row.date}</td>
                        <td className="px-2 py-1 truncate max-w-[200px]">{row.vendor}</td>
                        <td className="px-2 py-1 text-right tabular-nums">${Math.abs(row.amount).toFixed(2)}</td>
                        <td className="px-2 py-1">
                          <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            row.transaction_type === "income"
                              ? "bg-accent-sage/10 text-accent-sage"
                              : "bg-bg-tertiary/50 text-mono-medium"
                          }`}>
                            {row.transaction_type === "income" ? "Income" : "Expense"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Progress */}
          {loading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span>{stage === "parsing" ? "Parsing file..." : stage === "uploading" ? `Uploading ${rowCount} rows...` : "Processing..."}</span>
              </div>
              <div className="h-1.5 w-full bg-bg-tertiary rounded-full overflow-hidden">
                <div className="h-full bg-accent-sage animate-pulse" style={{ width: stage === "uploading" ? "70%" : "40%" }} />
              </div>
            </div>
          )}

          {stage === "done" && !loading && (
            <div className="rounded-md bg-accent-sage/10 px-3 py-2 text-xs text-accent-sage font-medium">
              {rowCount} transactions imported. AI categorization is running in the background.
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-bg-tertiary/40 bg-bg-secondary/30">
          {stage === "done" ? (
            <button onClick={onClose} className="rounded-md bg-accent-sage px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-sage/90 transition">
              Done
            </button>
          ) : (
            <>
              <button onClick={onClose} disabled={loading} className="rounded-md border border-bg-tertiary px-3 py-1.5 text-xs text-mono-medium hover:bg-bg-secondary transition disabled:opacity-40">
                Cancel
              </button>
              <button
                disabled={!file || loading}
                onClick={handleImport}
                className="rounded-md bg-accent-sage px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-sage/90 transition disabled:opacity-40"
              >
                {loading ? "Importing..." : "Import"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
