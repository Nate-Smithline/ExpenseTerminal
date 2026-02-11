"use client";

import { useState } from "react";
import Papa from "papaparse";
import ExcelJS from "exceljs";

interface UploadModalProps {
  onClose: () => void;
  onCompleted: () => Promise<void>;
}

type ParsedRow = {
  date: string;
  vendor: string;
  description?: string;
  amount: number;
};

export function UploadModal({ onClose, onCompleted }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function parseCsv(content: string) {
    const result = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
    });
    const rows: ParsedRow[] = (result.data ?? [])
      .map((row) => ({
        date: row.date || row.Date || row.DATE || "",
        vendor: row.vendor || row.Vendor || row.VENDOR || "",
        description:
          row.description || row.Description || row.DESCRIPTION || "",
        amount: Number(
          row.amount || row.Amount || row.AMOUNT || row.total || row.Total
        ),
      }))
      .filter((r) => r.date && r.vendor && !Number.isNaN(r.amount));
    setPreviewRows(rows.slice(0, 10));
  }

  async function parseExcel(file: File) {
    const data = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(data);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      setPreviewRows([]);
      return;
    }

    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      const key = String(cell.value ?? "").toLowerCase();
      headers[colNumber] = key;
    });

    const rows: ParsedRow[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const values: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        const headerKey = headers[colNumber];
        if (!headerKey) return;
        values[headerKey] = cell.value;
      });

      const parsed: ParsedRow = {
        date:
          (values["date"] as string) ||
          (values["Date"] as string) ||
          (values["DATE"] as string) ||
          "",
        vendor:
          (values["vendor"] as string) ||
          (values["Vendor"] as string) ||
          (values["VENDOR"] as string) ||
          "",
        description:
          (values["description"] as string) ||
          (values["Description"] as string) ||
          (values["DESCRIPTION"] as string) ||
          "",
        amount: Number(
          values["amount"] ??
            values["Amount"] ??
            values["AMOUNT"] ??
            values["total"] ??
            values["Total"]
        ),
      };

      if (parsed.date && parsed.vendor && !Number.isNaN(parsed.amount)) {
        rows.push(parsed);
      }
    });

    setPreviewRows(rows.slice(0, 10));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);

    const ext = f.name.toLowerCase().split(".").pop();
    if (ext === "csv") {
      const text = await f.text();
      parseCsv(text);
    } else if (ext === "xlsx" || ext === "xls") {
      await parseExcel(f);
    } else {
      setError("Unsupported file type. Please upload CSV or Excel.");
    }
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      let rows = previewRows;
      // If we only parsed a subset for preview, re-parse full file before upload.
      if (rows.length === 0) {
        const ext = file.name.toLowerCase().split(".").pop();
        if (ext === "csv") {
          const text = await file.text();
          const result = Papa.parse<Record<string, string>>(text, {
            header: true,
            skipEmptyLines: true,
          });
          rows = (result.data ?? [])
            .map((row) => ({
              date: row.date || row.Date || row.DATE || "",
              vendor: row.vendor || row.Vendor || row.VENDOR || "",
              description:
                row.description || row.Description || row.DESCRIPTION || "",
              amount: Number(
                row.amount ||
                  row.Amount ||
                  row.AMOUNT ||
                  row.total ||
                  row.Total
              ),
            }))
            .filter((r) => r.date && r.vendor && !Number.isNaN(r.amount));
        } else if (ext === "xlsx" || ext === "xls") {
          const data = await file.arrayBuffer();
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(data);
          const sheet = workbook.worksheets[0];
          if (sheet) {
            const headerRow = sheet.getRow(1);
            const headers: string[] = [];
            headerRow.eachCell((cell, colNumber) => {
              const key = String(cell.value ?? "").toLowerCase();
              headers[colNumber] = key;
            });

            const parsedRows: ParsedRow[] = [];
            sheet.eachRow((row, rowNumber) => {
              if (rowNumber === 1) return;
              const values: Record<string, any> = {};
              row.eachCell((cell, colNumber) => {
                const headerKey = headers[colNumber];
                if (!headerKey) return;
                values[headerKey] = cell.value;
              });

              const parsed: ParsedRow = {
                date:
                  (values["date"] as string) ||
                  (values["Date"] as string) ||
                  (values["DATE"] as string) ||
                  "",
                vendor:
                  (values["vendor"] as string) ||
                  (values["Vendor"] as string) ||
                  (values["VENDOR"] as string) ||
                  "",
                description:
                  (values["description"] as string) ||
                  (values["Description"] as string) ||
                  (values["DESCRIPTION"] as string) ||
                  "",
                amount: Number(
                  values["amount"] ??
                    values["Amount"] ??
                    values["AMOUNT"] ??
                    values["total"] ??
                    values["Total"]
                ),
              };

              if (
                parsed.date &&
                parsed.vendor &&
                !Number.isNaN(parsed.amount)
              ) {
                parsedRows.push(parsed);
              }
            });
            rows = parsedRows;
          }
        }
      }

      const res = await fetch("/api/transactions/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          taxYear,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to import transactions");
      }

      await onCompleted();
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Something went wrong while importing");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="card max-w-2xl w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-mono-dark">
              Upload transactions
            </h2>
            <p className="text-sm text-mono-medium">
              Drag and drop a CSV or Excel file. We&apos;ll auto-detect your
              columns and process everything with AI.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-mono-medium hover:text-mono-dark text-sm"
          >
            Close
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-mono-dark mb-1">
            Tax Year
          </label>
          <select
            value={taxYear}
            onChange={(e) => setTaxYear(parseInt(e.target.value, 10))}
            className="bg-white border border-bg-tertiary rounded-md px-3 py-1.5 text-sm"
          >
            <option value={taxYear}>{taxYear}</option>
            <option value={taxYear - 1}>{taxYear - 1}</option>
            <option value={taxYear - 2}>{taxYear - 2}</option>
          </select>
        </div>

        <div className="border-2 border-dashed border-bg-tertiary rounded-md p-6 mb-4 bg-bg-secondary">
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-mono-medium">
              Drop your CSV/Excel file here, or click to browse.
            </p>
            <input
              type="file"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileChange}
              className="mt-2 text-sm"
            />
          </div>
        </div>

        {previewRows.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-mono-dark mb-2">
              Preview (first 10 rows)
            </p>
            <div className="border border-bg-tertiary rounded-md max-h-64 overflow-auto text-xs">
              <table className="min-w-full">
                <thead className="bg-bg-secondary">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Vendor</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-left">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className="border-t border-bg-tertiary">
                      <td className="px-3 py-1.5">{row.date}</td>
                      <td className="px-3 py-1.5">{row.vendor}</td>
                      <td className="px-3 py-1.5">
                        {row.description ?? ""}
                      </td>
                      <td className="px-3 py-1.5">
                        ${row.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-danger mb-3">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 mt-4">
          <button
            className="btn-secondary text-sm px-4 py-2"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="btn-primary text-sm px-4 py-2"
            disabled={!file || loading}
            onClick={handleImport}
          >
            {loading ? "Processing with AI..." : "Import & Process"}
          </button>
        </div>
      </div>
    </div>
  );
}

