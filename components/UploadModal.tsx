"use client";

import { useState, useEffect, useCallback } from "react";
import Papa from "papaparse";
import { getStickyTaxYearClient } from "@/lib/tax-year-cookie";
import ExcelJS from "exceljs";

const BATCH_SIZE = 500;

const appleOverlayClass =
  "fixed inset-0 z-50 flex min-h-[100dvh] items-center justify-center bg-black/40 px-4 backdrop-blur-md";
const applePanelClass =
  "relative w-full max-w-md overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.18)]";
const appleModalHeadClass = "px-5 pt-5 pb-1";
const appleModalBodyClass = "px-5 py-3";
const appleModalFooterClass = "flex justify-end gap-2 border-t border-black/[0.06] bg-[#fafafa]/80 px-5 py-4";
const appleBtnPrimary =
  "rounded-full bg-[#0071e3] px-5 py-2.5 text-[15px] font-medium text-white transition hover:bg-[#0077ed] disabled:opacity-40";
const appleBtnSecondary =
  "rounded-full bg-[#e5e5ea] px-5 py-2.5 text-[15px] font-medium text-[#1d1d1f] transition hover:bg-[#d8d8dc] disabled:opacity-40";
const appleInputClass =
  "w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2.5 text-sm text-mono-dark outline-none transition focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]/25";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type DataSource = {
  id: string;
  name: string;
  account_type: string;
  institution?: string | null;
  source_type?: string | null;
};

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
  /** True when uploading into a Direct Feed (Stripe FC) account — copy explains CSV complements the feed. */
  directFeedAccount?: boolean;
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
  if (lower["debit"] != null) {
    const debitVal = Number(String(lower["debit"]).replace(/[$,]/g, ""));
    if (!Number.isNaN(debitVal) && Math.abs(debitVal) > 0) return "expense";
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
      if (Number.isNaN(n)) continue;
      const isDebitOrCredit = k.toLowerCase() === "debit" || k.toLowerCase() === "credit";
      if (isDebitOrCredit && n === 0) continue;
      if (k.toLowerCase() === "debit") return -Math.abs(n);
      return n;
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

const CSV_DATE_HEADERS = ["date", "posting date", "transaction date", "trans date", "postingdate"] as const;
const CSV_VENDOR_HEADERS = ["vendor", "merchant", "payee", "name", "description", "memo"] as const;
const CSV_AMOUNT_HEADERS = ["amount", "total", "debit", "credit"] as const;

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/\s+/g, " ");
}

function validateAndParseCsv(content: string): { rows: ParsedRow[]; error?: string } {
  function parseWithHeader(text: string) {
    const delimiter = detectDelimiter(text);
    const preprocessed = preprocessDelimitedText(text, delimiter);
    return Papa.parse<Record<string, string>>(preprocessed, {
      header: true,
      skipEmptyLines: true,
      delimiter,
    });
  }

  function detectDelimiter(text: string): string {
    const sample = text
      .replace(/^\uFEFF/, "")
      .slice(0, 50_000);
    const comma = (sample.match(/,/g) ?? []).length;
    const tab = (sample.match(/\t/g) ?? []).length;
    const semi = (sample.match(/;/g) ?? []).length;
    // Chase commonly exports tab-delimited "CSV" (TSV). Prefer tabs when they dominate.
    if (tab > comma && tab > semi) return "\t";
    if (semi > comma && semi > tab) return ";";
    return ",";
  }

  function preprocessDelimitedText(text: string, delimiter: string): string {
    const normalized = text
      .replace(/^\uFEFF/, "") // strip BOM
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

    // Many bank exports (including Chase) include a trailing delimiter (e.g. a final tab),
    // which triggers column count mismatch. We can safely trim trailing delimiters.
    const delimRe = delimiter === "\t" ? /\t+$/ : delimiter === ";" ? /;+$/ : /,+$/;
    return normalized
      .split("\n")
      .map((line) => line.replace(delimRe, ""))
      .join("\n");
  }

  function looksLikeHeaderLine(line: string): boolean {
    const norm = normalizeHeader(line);
    const hasDate = norm.includes("date");
    const hasDesc = norm.includes("description") || norm.includes("details") || norm.includes("memo") || norm.includes("merchant") || norm.includes("payee") || norm.includes("name");
    const hasAmt = norm.includes("amount") || norm.includes("debit") || norm.includes("credit");
    return hasDate && hasDesc && hasAmt;
  }

  function sliceFromHeaderRow(text: string): string | null {
    const lines = text
      .replace(/^\uFEFF/, "") // strip BOM
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n");
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      if (looksLikeHeaderLine(lines[i] ?? "")) {
        return lines.slice(i).join("\n");
      }
    }
    return null;
  }

  let parseText = content;
  let result = parseWithHeader(parseText);

  // Common bank exports (e.g. Chase) sometimes include preamble lines before the real header.
  // If parsing fails, try to auto-detect the header row and retry from there.
  if (result.errors?.length) {
    const headerSliced = sliceFromHeaderRow(content);
    if (headerSliced) {
      parseText = headerSliced;
      result = parseWithHeader(parseText);
    }
  }

  const hasFatalCsvError = (result.errors ?? []).some((e) => {
    // Treat column count mismatches as non-fatal; PapaParse will still provide row data,
    // and extra fields end up in __parsed_extra.
    if (e.code === "TooManyFields" || e.code === "TooFewFields") return false;
    return true;
  });

  if (hasFatalCsvError) {
    const first = result.errors[0];
    const rowPart = first.row != null ? ` (row ${first.row + 1})` : "";
    return {
      rows: [],
      error:
        `We couldn’t read this CSV (parse error). Details: ${first.message}${rowPart}. ` +
        "If this is a bank export, try re-downloading as CSV, and make sure any fields containing commas are quoted (e.g. \"ACME, INC\"). " +
        "If your file has extra lines above the header, remove them and keep the first row as the column headers.",
    };
  }

  const fields = (result.meta?.fields ?? []).map(normalizeHeader);
  const hasDate = CSV_DATE_HEADERS.some((h) => fields.includes(normalizeHeader(h)));
  const hasVendor = CSV_VENDOR_HEADERS.some((h) => fields.includes(normalizeHeader(h)));
  const hasAmount = CSV_AMOUNT_HEADERS.some((h) => fields.includes(normalizeHeader(h)));

  const delimiter = detectDelimiter(parseText);
  const rows = parseCsvToRows(preprocessDelimitedText(parseText, delimiter));
  if (rows.length === 0) {
    const missing: string[] = [];
    if (!hasDate) missing.push("date");
    if (!hasVendor) missing.push("vendor/merchant");
    if (!hasAmount) missing.push("amount (or debit/credit)");

    const missingPart =
      missing.length > 0
        ? ` Missing: ${missing.join(", ")}.`
        : "";

    return {
      rows: [],
      error:
        "We couldn’t import any rows from this CSV." +
        missingPart +
        " Make sure your file has a single header row and columns for date, vendor/merchant, and amount. " +
        "Accepted headers include: " +
        `date (${CSV_DATE_HEADERS.join(", ")}), ` +
        `vendor (${CSV_VENDOR_HEADERS.join(", ")}), ` +
        `amount (${CSV_AMOUNT_HEADERS.join(", ")}). ` +
        "Dates should look like 2026-03-17 (or similar), and amounts should be numbers (e.g. -12.34).",
    };
  }

  return { rows };
}

export function UploadModal({ onClose, onCompleted, dataSourceId: dataSourceIdProp, directFeedAccount = false }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [suppressDuplicates, setSuppressDuplicates] = useState(true);

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

  const resolvedDirectFeed =
    directFeedAccount ||
    (effectiveDataSourceId != null &&
      dataSources.some((d) => d.id === effectiveDataSourceId && d.source_type === "stripe"));

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
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
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
    const { rows, error } = validateAndParseCsv(content);
    if (error) {
      setPreviewRows([]);
      setError(error);
      return;
    }
    setPreviewRows(rows.slice(0, 8));
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
        const content = await file.text();
        const parsed = validateAndParseCsv(content);
        if (parsed.error) {
          setStage("error");
          setError(parsed.error);
          setLoading(false);
          return;
        }
        rows = parsed.rows;
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

      const batches = chunk(rows, BATCH_SIZE);
      let totalImported = 0;
      const allTransactionIds: string[] = [];
      let overLimit = false;
      let eligibleImported = 0;
      let ineligibleImported = 0;
      let maxCsvTransactionsForAi: number | null = null;

      for (let i = 0; i < batches.length; i++) {
        setUploadProgress({ current: i + 1, total: batches.length });
        const res = await fetch("/api/transactions/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: batches[i],
            taxYear,
            suppressDuplicates,
            ...(effectiveDataSourceId ? { dataSourceId: effectiveDataSourceId } : {}),
          }),
        });

        const batchBody = (await res.json().catch(() => ({}))) as {
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
          throw new Error(batchBody.error || "Failed to import");
        }

        totalImported += batchBody.imported ?? 0;
        allTransactionIds.push(...(batchBody.transactionIds ?? []));
        if (batchBody.overLimit) overLimit = true;
        eligibleImported += batchBody.eligibleImported ?? 0;
        ineligibleImported += batchBody.ineligibleImported ?? 0;
        if (batchBody.maxCsvTransactionsForAi != null) maxCsvTransactionsForAi = batchBody.maxCsvTransactionsForAi;
      }

      setUploadProgress(null);
      setStage("done");

      const body = {
        imported: totalImported,
        transactionIds: allTransactionIds,
        overLimit,
        eligibleImported,
        ineligibleImported,
        maxCsvTransactionsForAi,
      };

      if (body.overLimit && (body.ineligibleImported ?? 0) > 0) {
        setOverLimitBanner({
          eligibleImported: body.eligibleImported ?? 0,
          ineligibleImported: body.ineligibleImported ?? 0,
          maxCsvTransactionsForAi: body.maxCsvTransactionsForAi ?? 250,
        });
      } else {
        setOverLimitBanner(null);
      }

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
      setUploadProgress(null);
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={appleOverlayClass} role="dialog" aria-modal="true" aria-labelledby="upload-modal-title">
      <div className={applePanelClass}>
        <div className={appleModalHeadClass}>
          <h2 id="upload-modal-title" className="text-[20px] font-semibold tracking-tight text-mono-dark">
            {step === "choose_source"
              ? "Choose account"
              : resolvedDirectFeed
                ? "Upload bank CSV"
                : "Upload transactions"}
          </h2>
        </div>

        <div className={`${appleModalBodyClass} space-y-3`}>
          {step === "choose_source" ? (
            <>
              <p className="text-xs text-mono-medium">
                Select an account for this upload, or create one.
              </p>
              {dataSourcesLoading ? (
                <p className="text-sm text-mono-medium">Loading accounts…</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-mono-dark block">Account</label>
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-black/[0.08] p-1">
                      {dataSources.map((ds) => (
                        <button
                          key={ds.id}
                          type="button"
                          onClick={() => setSelectedDataSourceId(ds.id)}
                          className={`w-full rounded-lg px-3 py-2.5 text-left text-sm transition ${
                            selectedDataSourceId === ds.id
                              ? "bg-accent-sage/12 text-accent-sage font-medium"
                              : "text-mono-dark hover:bg-bg-secondary"
                          }`}
                        >
                          {ds.name}
                          {ds.source_type === "stripe" ? (
                            <span className="text-mono-light ml-1">· Direct Feed</span>
                          ) : (
                            ds.institution && (
                              <span className="text-mono-light ml-1">· {ds.institution}</span>
                            )
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
                    <div className="space-y-3 rounded-xl border border-black/[0.08] bg-[#fafafa]/80 p-4">
                      <h3 className="text-sm font-semibold text-mono-dark">New account</h3>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-mono-dark">Account name *</label>
                        <input
                          type="text"
                          value={createName}
                          onChange={(e) => setCreateName(e.target.value)}
                          placeholder="e.g. Chase Business Checking"
                          className={appleInputClass}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-mono-dark">Account type *</label>
                        <select
                          value={createAccountType}
                          onChange={(e) => setCreateAccountType(e.target.value)}
                          className={appleInputClass}
                        >
                          {ACCOUNT_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-mono-dark">Institution</label>
                        <input
                          type="text"
                          value={createInstitution}
                          onChange={(e) => setCreateInstitution(e.target.value)}
                          placeholder="e.g. Chase, Amex"
                          className={appleInputClass}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setShowCreateForm(false)} className={appleBtnSecondary}>
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateDataSource}
                          disabled={createSaving || !createName.trim()}
                          className={appleBtnPrimary}
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
          {resolvedDirectFeed ? (
            <div className="space-y-2">
              <p className="text-xs text-mono-medium">
                Import a bank export (CSV or Excel) to add transactions that aren&apos;t available through your Direct
                Feed— for example older history. New rows are linked to this account alongside synced transactions.
              </p>
              <p className="text-xs text-mono-light">
                AI categorization runs in the background after import.
              </p>
            </div>
          ) : (
            <p className="text-xs text-mono-medium">
              Upload CSV or Excel. AI categorization runs in the background.
            </p>
          )}

          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Drop file here or click to browse. CSV or Excel."
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`relative flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors ${
              isDragging
                ? "border-accent-terracotta bg-accent-terracotta/5"
                : "border-black/[0.12] bg-[#fafafa]/80"
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

          {/* Suppress duplicates */}
          <div className="mt-3 space-y-1.5">
            <label className="flex items-start gap-2 text-sm text-mono-dark cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-bg-tertiary text-mono-dark focus:ring-mono-dark"
                checked={suppressDuplicates}
                onChange={(e) => setSuppressDuplicates(e.target.checked)}
              />
              <span className="flex items-center gap-1">
                Suppress duplicates
              </span>
            </label>
            <p className="text-xs text-mono-medium">
              When checked, uploads won&apos;t add any transactions that already exist for this account with the same date and name.
            </p>
          </div>

          {/* Preview */}
          {previewRows.length > 0 && (
            <>
              {previewRows.some((r) => r.transaction_type === "income") && (
                <div className="rounded-none bg-accent-sage/10 px-3 py-2 text-xs text-accent-sage">
                  Income transactions detected. These will be added to your business revenue.
                </div>
              )}
              <div className="border border-bg-tertiary/60 rounded-none overflow-auto max-h-48 text-[11px]">
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
                          <span className={`inline-block rounded-none px-1.5 py-0.5 text-[10px] font-medium ${
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
                <span>
                  {stage === "parsing"
                    ? "Parsing file..."
                    : stage === "uploading"
                      ? uploadProgress
                        ? `Uploading batch ${uploadProgress.current} of ${uploadProgress.total}...`
                        : `Uploading ${rowCount} rows...`
                      : "Processing..."}
                </span>
              </div>
              <div className="h-1.5 w-full bg-bg-tertiary rounded-none overflow-hidden">
                <div className="h-full bg-accent-sage animate-pulse" style={{ width: stage === "uploading" ? "70%" : "40%" }} />
              </div>
            </div>
          )}

          {stage === "done" && !loading && (
            <div className="space-y-3">
              <div className="rounded-none bg-accent-sage/10 px-3 py-2 text-xs text-accent-sage font-medium">
                {rowCount} transactions imported. AI categorization is running in the background.
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
            </>
          )}
        </div>

        <div className={appleModalFooterClass}>
          {step === "choose_source" ? (
            <>
              <button type="button" onClick={onClose} className={appleBtnSecondary}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setStep("upload"); setError(null); }}
                disabled={!selectedDataSourceId || dataSourcesLoading}
                className={appleBtnPrimary}
              >
                Continue
              </button>
            </>
          ) : stage === "done" ? (
            <button type="button" onClick={onClose} className={appleBtnPrimary}>
              Done
            </button>
          ) : (
            <>
              <button type="button" onClick={onClose} disabled={loading} className={appleBtnSecondary}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!file || loading || (needsDataSourceStep && !effectiveDataSourceId)}
                onClick={handleImport}
                className={appleBtnPrimary}
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
