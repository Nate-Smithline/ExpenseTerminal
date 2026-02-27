"use client";

import { useState, useEffect, useCallback } from "react";
import Papa from "papaparse";
import { getStickyTaxYearClient } from "@/lib/tax-year-cookie";
import ExcelJS from "exceljs";

type DataSource = { id: string; name: string; account_type: string; institution?: string | null };
const ACCOUNT_TYPES = [
  { value: "checking", label: "Business Checking" },
  { value: "credit", label: "Business Credit Card" },
  { value: "savings", label: "Business Savings" },
  { value: "other", label: "Other" },
];

type UploadResult = {
  imported?: number;
  transactionIds?: string[];
  overLimit?: boolean;
  eligibleImported?: number;
  ineligibleImported?: number;
  maxCsvTransactionsForAi?: number | null;
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

export function UploadModal({ onClose, onCompleted, dataSourceId: dataSourceIdProp }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());

  const needsDataSourceStep = dataSourceIdProp == null;
  const [step, setStep] = useState<"choose_source" | "upload">(needsDataSourceStep ? "choose_source" : "upload");
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [dataSourcesLoading, setDataSourcesLoading] = useState(needsDataSourceStep);
  const [selectedDataSourceId, setSelectedDataSourceId] = useState<string | null>(dataSourceIdProp ?? null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createAccountType, setCreateAccountType] = useState("checking");
  const [createInstitution, setCreateInstitution] = useState("");
  const [createSaving, setCreateSaving] = useState(false);

  const effectiveDataSourceId = selectedDataSourceId ?? dataSourceIdProp ?? null;

  const fetchDataSources = useCallback(async () => {
    const res = await fetch("/api/data-sources");
    if (!res.ok) return;
    const body = await res.json();
    setDataSources(body.data ?? []);
  }, []);

  useEffect(() => {
    if (needsDataSourceStep) {
      setDataSourcesLoading(true);
      fetchDataSources().finally(() => setDataSourcesLoading(false));
    }
  }, [needsDataSourceStep, fetchDataSources]);

  useEffect(() => {
    setTaxYear(getStickyTaxYearClient());
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<"idle" | "parsing" | "uploading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [overLimitBanner, setOverLimitBanner] = useState<{
    eligibleImported: number;
    ineligibleImported: number;
    maxCsvTransactionsForAi: number | null;
  } | null>(null);

  async function setFileAndParse(f: File) {
    setFile(f);
    setError(null);
    setOverLimitBanner(null);
    const ext = f.name.toLowerCase().split(".").pop();
    if (ext === "csv") {
      parseCsv(await f.text());
    } else if (ext === "xlsx" || ext === "xls") {
      await parseExcel(f);
    } else {
      setError("Unsupported file type. Upload CSV or Excel.");
    }
  }

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

  async function handleCreateDataSource() {
    if (!createName.trim()) return;
    setCreateSaving(true);
    try {
      const res = await fetch("/api/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim(), account_type: createAccountType, institution: createInstitution || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError((err as { error?: string }).error ?? "Failed to create account");
        return;
      }
      const { data } = await res.json();
      setDataSources((prev) => [data, ...prev]);
      setSelectedDataSourceId(data.id);
      setCreateName("");
      setCreateInstitution("");
      setShowCreateForm(false);
    } finally {
      setCreateSaving(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    await setFileAndParse(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    setFileAndParse(f);
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
        body: JSON.stringify({ rows, taxYear, ...(effectiveDataSourceId ? { dataSourceId: effectiveDataSourceId } : {}) }),
      });

      const body = (await res.json().catch(() => ({}))) as {
        imported?: number;
        transactionIds?: string[];
        overLimit?: boolean;
        eligibleImported?: number;
        ineligibleImported?: number;
        maxCsvTransactionsForAi?: number | null;
        error?: string;
      };

      if (!res.ok) {
        setStage("error");
        throw new Error(body.error || "Failed to import");
      }

      setStage("done");
      if (body.overLimit && (body.ineligibleImported ?? 0) > 0) {
        setOverLimitBanner({
          eligibleImported: body.eligibleImported ?? 0,
          ineligibleImported: body.ineligibleImported ?? 0,
          maxCsvTransactionsForAi: body.maxCsvTransactionsForAi ?? 250,
        });
      } else {
        setOverLimitBanner(null);
      }

      // Return IDs and limit info so the parent can show upgrade messaging
      await onCompleted({
        imported: body.imported ?? 0,
        transactionIds: body.transactionIds ?? [],
        overLimit: body.overLimit,
        eligibleImported: body.eligibleImported,
        ineligibleImported: body.ineligibleImported,
        maxCsvTransactionsForAi: body.maxCsvTransactionsForAi,
      });
    } catch (e: unknown) {
      setStage("error");
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
    >
      <div className="rounded-xl bg-white shadow-[0_8px_30px_-6px_rgba(0,0,0,0.14)] max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="rounded-t-xl bg-[#2d3748] px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="upload-modal-title" className="text-xl font-bold text-white tracking-tight">
                {step === "choose_source" ? "Choose data source" : "Upload Transactions"}
              </h2>
              <p className="text-sm text-white/80 mt-1.5">
                {step === "choose_source"
                  ? "Select an account for this upload, or create one."
                  : "CSV or Excel. AI categorization runs in the background."}
              </p>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition shrink-0"
              aria-label="Close"
            >
              <span className="material-symbols-rounded text-[18px]">close</span>
            </button>
          </div>
        </div>

        <div className="px-6 py-6 space-y-5">
          {step === "choose_source" ? (
            <>
              {dataSourcesLoading ? (
                <p className="text-sm text-mono-medium">Loading accounts…</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-mono-dark block">Account</label>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto border border-bg-tertiary rounded-md p-1">
                      {dataSources.map((ds) => (
                        <button
                          key={ds.id}
                          type="button"
                          onClick={() => setSelectedDataSourceId(ds.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition ${
                            selectedDataSourceId === ds.id
                              ? "bg-accent-sage/12 text-accent-sage font-medium"
                              : "text-mono-dark hover:bg-bg-secondary"
                          }`}
                        >
                          {ds.name}
                          {ds.institution && (
                            <span className="text-mono-light ml-1">· {ds.institution}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  {!showCreateForm ? (
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(true)}
                      className="text-sm text-mono-medium hover:text-mono-dark underline underline-offset-2"
                    >
                      Create new account
                    </button>
                  ) : (
                    <div className="border border-bg-tertiary rounded-md p-4 space-y-3 bg-bg-secondary/30">
                      <h3 className="text-sm font-semibold text-mono-dark">New account</h3>
                      <div>
                        <label className="text-sm font-medium text-mono-dark block mb-2">Account name *</label>
                        <input
                          type="text"
                          value={createName}
                          onChange={(e) => setCreateName(e.target.value)}
                          placeholder="e.g. Chase Business Checking"
                          className="w-full border border-bg-tertiary rounded-md px-3.5 py-2.5 text-sm text-mono-dark bg-white placeholder:text-mono-light focus:ring-2 focus:ring-accent-sage/20 focus:border-accent-sage/40 outline-none transition"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-mono-dark block mb-2">Account type *</label>
                        <select
                          value={createAccountType}
                          onChange={(e) => setCreateAccountType(e.target.value)}
                          className="w-full border border-bg-tertiary rounded-md px-3.5 py-2.5 text-sm text-mono-dark bg-white focus:ring-2 focus:ring-accent-sage/20 focus:border-accent-sage/40 outline-none transition"
                        >
                          {ACCOUNT_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-mono-dark block mb-2">Institution</label>
                        <input
                          type="text"
                          value={createInstitution}
                          onChange={(e) => setCreateInstitution(e.target.value)}
                          placeholder="e.g. Chase, Amex"
                          className="w-full border border-bg-tertiary rounded-md px-3.5 py-2.5 text-sm text-mono-dark bg-white placeholder:text-mono-light focus:ring-2 focus:ring-accent-sage/20 focus:border-accent-sage/40 outline-none transition"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowCreateForm(false)}
                          className="rounded-md border border-bg-tertiary bg-white px-4 py-2.5 text-sm font-semibold text-mono-dark hover:bg-bg-secondary transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateDataSource}
                          disabled={createSaving || !createName.trim()}
                          className="rounded-md bg-mono-dark px-4 py-2.5 text-sm font-semibold text-white hover:bg-mono-dark/90 disabled:opacity-40 transition"
                        >
                          {createSaving ? "Creating…" : "Create account"}
                        </button>
                      </div>
                    </div>
                  )}
                  {error && <p className="text-xs text-red-600">{error}</p>}
                </>
              )}
            </>
          ) : (
            <>
          <p className="text-sm text-mono-light">
            Each transaction is assigned to the tax year of its date (e.g. 2026 dates → 2026 records).
          </p>

          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Drop file here or click to browse. CSV or Excel."
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`relative flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed transition-colors ${
              isDragging
                ? "border-accent-terracotta bg-accent-terracotta/5"
                : "border-bg-tertiary bg-bg-secondary/50"
            }`}
          >
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-hidden
            />
            <span className="material-symbols-rounded text-3xl text-mono-light">upload_file</span>
            <p className="text-sm font-medium text-mono-dark">Drop file here or browse</p>
            <p className="text-xs text-mono-light">CSV or Excel</p>
          </div>

          {/* Preview */}
          {previewRows.length > 0 && (
            <>
              {previewRows.some((r) => r.transaction_type === "income") && (
                <div className="rounded-md bg-accent-sage/10 px-3 py-2 text-xs text-accent-sage">
                  Income transactions detected. These will be added to your business revenue.
                </div>
              )}
              <div className="border border-bg-tertiary rounded-md overflow-auto max-h-48 text-[11px]">
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
            <div className="space-y-3">
              {overLimitBanner && (
                <div className="rounded-md border border-accent-warm/40 bg-accent-warm/5 px-3 py-2.5 text-xs text-mono-dark">
                  <p className="font-medium text-mono-dark mb-1">You&apos;ve reached the free AI analysis limit.</p>
                  <p className="text-mono-medium mb-2">
                    We&apos;ll still upload your data, but only the first {overLimitBanner.maxCsvTransactionsForAi ?? 250} CSV transactions are eligible for AI. {overLimitBanner.ineligibleImported} from this upload won&apos;t be analyzed on the free plan.
                  </p>
                  <a href="/pricing" className="font-medium text-accent-sage hover:underline">
                    Upgrade to analyze everything
                  </a>
                </div>
              )}
              <div className="rounded-md bg-accent-sage/10 px-3 py-2 text-xs text-accent-sage font-medium">
                {rowCount} transactions imported. AI categorization is running in the background.
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-bg-tertiary/40">
          {step === "choose_source" ? (
            <>
              <button onClick={onClose} className="rounded-md border border-bg-tertiary bg-white px-4 py-2.5 text-sm font-semibold text-mono-dark hover:bg-bg-secondary transition">
                Cancel
              </button>
              <button
                onClick={() => { setStep("upload"); setError(null); }}
                disabled={!selectedDataSourceId || dataSourcesLoading}
                className="rounded-md bg-mono-dark px-4 py-2.5 text-sm font-semibold text-white hover:bg-mono-dark/90 transition disabled:opacity-40"
              >
                Continue
              </button>
            </>
          ) : stage === "done" ? (
            <button onClick={onClose} className="rounded-md bg-mono-dark px-4 py-2.5 text-sm font-semibold text-white hover:bg-mono-dark/90 transition">
              Done
            </button>
          ) : (
            <>
              <button onClick={onClose} disabled={loading} className="rounded-md border border-bg-tertiary bg-white px-4 py-2.5 text-sm font-semibold text-mono-dark hover:bg-bg-secondary transition disabled:opacity-40">
                Cancel
              </button>
              <button
                disabled={!file || loading || (needsDataSourceStep && !effectiveDataSourceId)}
                onClick={handleImport}
                className="rounded-md bg-mono-dark px-4 py-2.5 text-sm font-semibold text-white hover:bg-mono-dark/90 transition disabled:opacity-40"
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
