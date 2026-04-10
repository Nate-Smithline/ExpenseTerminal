import { z } from "zod";
import { normalizeVendor } from "@/lib/vendor-matching";

/** Core transaction columns users can set to a fixed value in org rules (excludes computed / immutable fields). */
export const ORG_RULE_STANDARD_WRITABLE_FIELDS = [
  "category",
  "schedule_c_line",
  "deduction_percent",
  "business_purpose",
  "notes",
  "quick_label",
  "vendor",
  "date",
  "amount",
  "description",
  "transaction_type",
  "status",
  "source",
] as const;

export type OrgRuleStandardWritableField = (typeof ORG_RULE_STANDARD_WRITABLE_FIELDS)[number];

export const ORG_RULE_STANDARD_FIELD_LABELS: Record<OrgRuleStandardWritableField, string> = {
  category: "Category",
  schedule_c_line: "Schedule C",
  deduction_percent: "Deduction %",
  business_purpose: "Business purpose",
  notes: "Notes",
  quick_label: "Quick label",
  vendor: "Vendor",
  date: "Date",
  amount: "Amount",
  description: "Description",
  transaction_type: "Type",
  status: "Status",
  source: "Source",
};

export function isOrgRuleStandardWritableField(s: string): s is OrgRuleStandardWritableField {
  return (ORG_RULE_STANDARD_WRITABLE_FIELDS as readonly string[]).includes(s);
}

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Coerce rule JSON value into a `transactions` update patch (subset of POST /api/transactions/update).
 */
export function coerceOrgRuleStandardFieldPatch(
  field: OrgRuleStandardWritableField,
  value: unknown,
): { ok: true; patch: Record<string, unknown> } | { ok: false; error: string } {
  const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
  const num = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  switch (field) {
    case "category": {
      if (value === null || value === undefined || str(value).trim() === "") {
        return { ok: true, patch: { category: null } };
      }
      const s = z.string().max(200).safeParse(str(value).trim());
      if (!s.success) return { ok: false, error: "Invalid category" };
      return { ok: true, patch: { category: s.data } };
    }
    case "schedule_c_line": {
      if (value === null || value === undefined || str(value).trim() === "") {
        return { ok: true, patch: { schedule_c_line: null } };
      }
      const s = z.string().max(50).safeParse(str(value).trim());
      if (!s.success) return { ok: false, error: "Invalid schedule C line" };
      return { ok: true, patch: { schedule_c_line: s.data } };
    }
    case "business_purpose":
    case "notes": {
      if (value === null || value === undefined || str(value).trim() === "") {
        return { ok: true, patch: { [field]: null } };
      }
      const s = z.string().max(2000).safeParse(str(value));
      if (!s.success) return { ok: false, error: `Invalid ${field}` };
      return { ok: true, patch: { [field]: s.data } };
    }
    case "quick_label": {
      if (value === null || value === undefined || str(value).trim() === "") {
        return { ok: true, patch: { quick_label: null } };
      }
      const s = z.string().max(500).safeParse(str(value).trim());
      if (!s.success) return { ok: false, error: "Invalid quick label" };
      return { ok: true, patch: { quick_label: s.data } };
    }
    case "description": {
      if (value === null || value === undefined || str(value).trim() === "") {
        return { ok: true, patch: { description: null } };
      }
      const s = z.string().max(2000).safeParse(str(value));
      if (!s.success) return { ok: false, error: "Invalid description" };
      return { ok: true, patch: { description: s.data } };
    }
    case "vendor": {
      const s = z.string().min(1).max(500).safeParse(str(value).trim());
      if (!s.success) return { ok: false, error: "Invalid vendor" };
      const v = s.data;
      return {
        ok: true,
        patch: {
          vendor: v,
          vendor_normalized: v.trim() ? normalizeVendor(v) : null,
        },
      };
    }
    case "date": {
      const raw = str(value).trim().slice(0, 10);
      if (!ymd.safeParse(raw).success) return { ok: false, error: "Date must be YYYY-MM-DD" };
      if (Number.isNaN(Date.parse(`${raw}T12:00:00.000Z`))) return { ok: false, error: "Invalid date" };
      return { ok: true, patch: { date: raw } };
    }
    case "amount": {
      const n = num(value);
      if (n == null) return { ok: false, error: "Invalid amount" };
      const fin = z.number().finite().safeParse(n);
      if (!fin.success || Math.abs(fin.data) >= 10_000_000) {
        return { ok: false, error: "Amount out of range" };
      }
      return { ok: true, patch: { amount: fin.data } };
    }
    case "deduction_percent": {
      const n = num(value);
      if (n == null) return { ok: false, error: "Invalid deduction %" };
      const p = z.number().int().min(0).max(100).safeParse(Math.round(n));
      if (!p.success) return { ok: false, error: "Deduction % must be 0–100" };
      return { ok: true, patch: { deduction_percent: p.data } };
    }
    case "transaction_type": {
      const p = z.enum(["income", "expense"]).safeParse(value);
      if (!p.success) return { ok: false, error: "Type must be income or expense" };
      return { ok: true, patch: { transaction_type: p.data } };
    }
    case "status": {
      const p = z.enum(["pending", "completed", "auto_sorted", "personal"]).safeParse(value);
      if (!p.success) return { ok: false, error: "Invalid status" };
      return { ok: true, patch: { status: p.data } };
    }
    case "source": {
      const p = z.enum(["csv_upload", "manual"]).safeParse(value);
      if (!p.success) return { ok: false, error: "Source must be CSV or manual" };
      return { ok: true, patch: { source: p.data } };
    }
    default: {
      const _x: never = field;
      return { ok: false, error: `Unsupported field: ${_x}` };
    }
  }
}
