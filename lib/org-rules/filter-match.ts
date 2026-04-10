/**
 * Row-level evaluation of activity-style column filters (parity with applyActivityColumnFilters).
 */

import type { ActivityColumnFilterRow } from "@/lib/activity-column-filters";
import {
  isStandardFilterableColumn,
  opNeedsSecondValue,
  opNeedsValue,
  opsForKind,
  orgPropertyFilterKind,
  sanitizeLikeFragment,
  standardColumnFilterKind,
} from "@/lib/activity-column-filters";
import type { ActivityFilterableStandardColumn } from "@/lib/validation/schemas";

export type OrgRuleTransactionRow = {
  date: string;
  vendor: string;
  description: string | null;
  amount: unknown;
  transaction_type: string | null;
  status: string;
  category: string | null;
  schedule_c_line: string | null;
  source: string | null;
  ai_confidence: unknown;
  business_purpose: string | null;
  quick_label: string | null;
  notes: string | null;
  deduction_percent: unknown;
  vendor_normalized: string | null;
  data_source_id: string | null;
  created_at: string | null;
  custom_fields: unknown;
};

type OrgTypeMap = Map<string, string>;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function isValidYmd(s: string): boolean {
  return YMD.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00.000Z`));
}

function nextDayYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function resolveKind(column: string, orgTypes: OrgTypeMap) {
  if (isStandardFilterableColumn(column)) return standardColumnFilterKind(column);
  const t = orgTypes.get(column);
  if (!t) return null;
  return orgPropertyFilterKind(t);
}

function num(txVal: unknown): number | null {
  const n = typeof txVal === "number" ? txVal : parseFloat(String(txVal ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function textMatchesNonNull(hay: string, op: string, value: string | undefined): boolean {
  const v = (value ?? "").trim();
  const safe = sanitizeLikeFragment(v);
  const h = hay.toLowerCase();
  switch (op) {
    case "contains":
      return safe.length > 0 && h.includes(safe.toLowerCase());
    case "is":
      return hay === v;
    case "is_not":
      return hay !== v;
    case "does_not_contain":
      return safe.length === 0 || !h.includes(safe.toLowerCase());
    case "starts_with":
      return safe.length > 0 && h.startsWith(safe.toLowerCase());
    case "ends_with":
      return safe.length > 0 && h.endsWith(safe.toLowerCase());
    case "is_empty":
      return hay === "";
    case "is_not_empty":
      return hay !== "";
    default:
      return false;
  }
}

function textMatchesNullable(hay: string | null | undefined, op: string, value: string | undefined): boolean {
  const s = hay ?? "";
  switch (op) {
    case "is_empty":
      return s === "" || s == null;
    case "is_not_empty":
      return s != null && s !== "";
    default:
      return textMatchesNonNull(s, op, value);
  }
}

function dateColMatches(txYmd: string, op: string, value?: string, value2?: string): boolean {
  const d = (txYmd ?? "").slice(0, 10);
  const a = (value ?? "").trim().slice(0, 10);
  const b = (value2 ?? "").trim().slice(0, 10);
  const cmp = d.localeCompare(a);
  switch (op) {
    case "is":
      return isValidYmd(a) && d === a;
    case "before":
      return isValidYmd(a) && d < a;
    case "after":
      return isValidYmd(a) && d > a;
    case "on_or_before":
      return isValidYmd(a) && (d < a || d === a);
    case "on_or_after":
      return isValidYmd(a) && (d > a || d === a);
    case "between":
      return isValidYmd(a) && isValidYmd(b) && d >= a && d <= b;
    case "is_empty":
      return !d;
    case "is_not_empty":
      return !!d;
    default:
      return false;
  }
}

function createdAtMatches(iso: string | null, op: string, value?: string, value2?: string): boolean {
  if (!iso) {
    return op === "is_empty";
  }
  if (op === "is_empty") return false;
  if (op === "is_not_empty") return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return op === "is_empty";
  const a = (value ?? "").trim();
  const b = (value2 ?? "").trim();
  switch (op) {
    case "is": {
      if (!isValidYmd(a)) return false;
      const start = Date.parse(`${a}T00:00:00.000Z`);
      const end = Date.parse(`${nextDayYmd(a)}T00:00:00.000Z`);
      return t >= start && t < end;
    }
    case "before":
      return isValidYmd(a) && t < Date.parse(`${a}T00:00:00.000Z`);
    case "after":
      return isValidYmd(a) && t >= Date.parse(`${nextDayYmd(a)}T00:00:00.000Z`);
    case "on_or_before":
      return isValidYmd(a) && t < Date.parse(`${nextDayYmd(a)}T00:00:00.000Z`);
    case "on_or_after":
      return isValidYmd(a) && t >= Date.parse(`${a}T00:00:00.000Z`);
    case "between": {
      if (!isValidYmd(a) || !isValidYmd(b)) return false;
      const start = Date.parse(`${a}T00:00:00.000Z`);
      const end = Date.parse(`${nextDayYmd(b)}T00:00:00.000Z`);
      return t >= start && t < end;
    }
    default:
      return false;
  }
}

function numberColMatches(txVal: unknown, op: string, value?: string): boolean {
  const n = num(txVal);
  const parsed = parseFloat(String(value ?? "").trim());
  switch (op) {
    case "eq":
    case "is":
      return !Number.isNaN(parsed) && n != null && n === parsed;
    case "neq":
    case "is_not":
      return !Number.isNaN(parsed) && n != null && n !== parsed;
    case "gt":
    case "after":
      return !Number.isNaN(parsed) && n != null && n > parsed;
    case "gte":
    case "on_or_after":
      return !Number.isNaN(parsed) && n != null && n >= parsed;
    case "lt":
    case "before":
      return !Number.isNaN(parsed) && n != null && n < parsed;
    case "lte":
    case "on_or_before":
      return !Number.isNaN(parsed) && n != null && n <= parsed;
    case "is_empty":
      return txVal == null || txVal === "";
    case "is_not_empty":
      return txVal != null && txVal !== "";
    default:
      return false;
  }
}

function deductionMatches(txVal: unknown, op: string, value?: string): boolean {
  const n =
    typeof txVal === "number" && Number.isFinite(txVal)
      ? txVal
      : parseInt(String(txVal ?? "").trim(), 10);
  const parsed = parseInt(String(value ?? "").trim(), 10);
  switch (op) {
    case "eq":
      return !Number.isNaN(parsed) && !Number.isNaN(n) && n === parsed;
    case "neq":
      return !Number.isNaN(parsed) && !Number.isNaN(n) && n !== parsed;
    case "gt":
      return !Number.isNaN(parsed) && !Number.isNaN(n) && n > parsed;
    case "gte":
      return !Number.isNaN(parsed) && !Number.isNaN(n) && n >= parsed;
    case "lt":
      return !Number.isNaN(parsed) && !Number.isNaN(n) && n < parsed;
    case "lte":
      return !Number.isNaN(parsed) && !Number.isNaN(n) && n <= parsed;
    case "is_empty":
      return txVal == null;
    case "is_not_empty":
      return txVal != null;
    default:
      return false;
  }
}

function enumMatches(txVal: string | null | undefined, op: string, value?: string): boolean {
  const v = (txVal ?? "").trim();
  const want = (value ?? "").trim();
  switch (op) {
    case "is":
    case "eq":
      return v === want;
    case "is_not":
    case "neq":
      return v !== want;
    case "is_empty":
      return v === "";
    case "is_not_empty":
      return v !== "";
    default:
      return false;
  }
}

function dataSourceMatches(txId: string | null, op: string, value?: string): boolean {
  const want = (value ?? "").trim();
  switch (op) {
    case "is_empty":
      return txId == null || txId === "";
    case "is_not_empty":
      return txId != null && txId !== "";
    case "is":
    case "eq":
      return want !== "" && txId === want;
    case "is_not":
    case "neq":
      return want === "" || txId !== want;
    default:
      return false;
  }
}

function customTextVal(cf: Record<string, unknown>, propId: string): string {
  const raw = cf[propId];
  if (raw == null) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  return "";
}

function customTextPathMatches(cf: Record<string, unknown>, propId: string, op: string, value?: string, value2?: string): boolean {
  const s = customTextVal(cf, propId);
  const v = (value ?? "").trim();
  const safe = sanitizeLikeFragment(v);
  switch (op) {
    case "contains":
      return safe.length > 0 && s.toLowerCase().includes(safe.toLowerCase());
    case "is":
      if (isValidYmd(v)) return s.slice(0, 10) === v;
      return s === v;
    case "is_not":
      return s !== v;
    case "does_not_contain":
      return safe.length === 0 || !s.toLowerCase().includes(safe.toLowerCase());
    case "starts_with":
      return safe.length > 0 && s.toLowerCase().startsWith(safe.toLowerCase());
    case "ends_with":
      return safe.length > 0 && s.toLowerCase().endsWith(safe.toLowerCase());
    case "before":
      return isValidYmd(v) && s.slice(0, 10).localeCompare(v) < 0;
    case "after":
      return isValidYmd(v) && s.slice(0, 10).localeCompare(v) > 0;
    case "on_or_before":
      return isValidYmd(v) && (s.slice(0, 10).localeCompare(v) < 0 || s.slice(0, 10) === v);
    case "on_or_after":
      return isValidYmd(v) && (s.slice(0, 10).localeCompare(v) > 0 || s.slice(0, 10) === v);
    case "between": {
      const b = (value2 ?? "").trim();
      if (!isValidYmd(v) || !isValidYmd(b)) return false;
      const d = s.slice(0, 10);
      return d >= v && d <= b;
    }
    case "is_empty":
      return s === "";
    case "is_not_empty":
      return s !== "";
    default:
      return false;
  }
}

function customNumericMatches(cf: Record<string, unknown>, propId: string, op: string, value?: string): boolean {
  const raw = cf[propId];
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? "").trim());
  const parsed = parseFloat(String(value ?? "").trim());
  switch (op) {
    case "eq":
    case "is":
      return !Number.isNaN(parsed) && !Number.isNaN(n) && n === parsed;
    case "neq":
    case "is_not":
      return !Number.isNaN(parsed) && !Number.isNaN(n) && n !== parsed;
    case "gt":
    case "after":
      return !Number.isNaN(parsed) && !Number.isNaN(n) && n > parsed;
    case "gte":
    case "on_or_after":
      return !Number.isNaN(parsed) && !Number.isNaN(n) && n >= parsed;
    case "lt":
    case "before":
      return !Number.isNaN(parsed) && !Number.isNaN(n) && n < parsed;
    case "lte":
    case "on_or_before":
      return !Number.isNaN(parsed) && !Number.isNaN(n) && n <= parsed;
    case "is_empty":
      return raw == null || String(raw).trim() === "";
    case "is_not_empty":
      return raw != null && String(raw).trim() !== "";
    default:
      return false;
  }
}

function customCheckboxMatches(cf: Record<string, unknown>, propId: string, op: string): boolean {
  const v = cf[propId];
  if (op === "is_checked") return v === true;
  if (op === "is_unchecked") return v !== true;
  return false;
}

function customMultiContains(cf: Record<string, unknown>, propId: string, optionId: string): boolean {
  const raw = cf[propId];
  if (!Array.isArray(raw)) return false;
  return raw.includes(optionId);
}

function filterInputsSatisfied(
  kind: ReturnType<typeof resolveKind>,
  op: string,
  value?: string,
  value2?: string,
): boolean {
  if (kind == null) return false;
  const ops = opsForKind(kind);
  if (!ops.includes(op)) return false;
  const needs = opNeedsValue(kind, op);
  const needs2 = opNeedsSecondValue(kind, op);
  if (needs && !value?.trim() && op !== "between") {
    if (!["is_empty", "is_not_empty", "is_checked", "is_unchecked"].includes(op)) return false;
  }
  if (needs2 && (!value?.trim() || !value2?.trim())) return false;
  return true;
}

/**
 * Returns true if the transaction row satisfies this column filter (same semantics as activity table filters).
 */
export function matchesOrgRuleColumnFilter(
  tx: OrgRuleTransactionRow,
  f: Pick<ActivityColumnFilterRow, "column" | "op" | "value" | "value2">,
  orgTypes: OrgTypeMap,
): boolean {
  const kind = resolveKind(f.column, orgTypes);
  if (!filterInputsSatisfied(kind, f.op, f.value, f.value2)) return false;

  if (isStandardFilterableColumn(f.column)) {
    const col = f.column as ActivityFilterableStandardColumn;
    if (col === "date") return dateColMatches(tx.date, f.op, f.value, f.value2);
    if (col === "created_at") return createdAtMatches(tx.created_at, f.op, f.value, f.value2);
    if (col === "vendor") return textMatchesNonNull(tx.vendor ?? "", f.op, f.value);
    if (col === "amount") return numberColMatches(tx.amount, f.op, f.value);
    if (col === "deduction_percent") return deductionMatches(tx.deduction_percent, f.op, f.value);
    if (col === "ai_confidence") return numberColMatches(tx.ai_confidence, f.op, f.value);
    if (col === "transaction_type" || col === "status" || col === "source") {
      const fieldVal = col === "transaction_type" ? tx.transaction_type : col === "status" ? tx.status : tx.source;
      return enumMatches(fieldVal, f.op, f.value);
    }
    if (col === "data_source_id") return dataSourceMatches(tx.data_source_id, f.op, f.value);
    const textCols: ActivityFilterableStandardColumn[] = [
      "description",
      "category",
      "schedule_c_line",
      "business_purpose",
      "quick_label",
      "notes",
      "vendor_normalized",
    ];
    if (textCols.includes(col)) {
      const fieldVal =
        col === "description"
          ? tx.description
          : col === "category"
            ? tx.category
            : col === "schedule_c_line"
              ? tx.schedule_c_line
              : col === "business_purpose"
                ? tx.business_purpose
                : col === "quick_label"
                  ? tx.quick_label
                  : col === "notes"
                    ? tx.notes
                    : tx.vendor_normalized;
      return textMatchesNullable(fieldVal, f.op, f.value);
    }
    return false;
  }

  const propId = f.column;
  const t = orgTypes.get(propId);
  if (!t) return false;
  const cf = asRecord(tx.custom_fields);

  if (t === "short_text" || t === "long_text" || t === "phone" || t === "email" || t === "org_user") {
    return customTextPathMatches(cf, propId, f.op, f.value, f.value2);
  }
  if (t === "date") {
    return customTextPathMatches(cf, propId, f.op, f.value, f.value2);
  }
  if (t === "number") {
    return customNumericMatches(cf, propId, f.op, f.value);
  }
  if (t === "checkbox") {
    return customCheckboxMatches(cf, propId, f.op);
  }
  if (t === "select") {
    if (f.op === "is_empty" || f.op === "is_not_empty") {
      return customTextPathMatches(cf, propId, f.op, f.value, f.value2);
    }
    if (f.op === "is" || f.op === "eq") return customTextVal(cf, propId) === (f.value ?? "").trim();
    if (f.op === "is_not" || f.op === "neq") return customTextVal(cf, propId) !== (f.value ?? "").trim();
    return false;
  }
  if (t === "multi_select") {
    if (f.op === "is_empty") {
      const raw = cf[propId];
      if (raw == null) return true;
      if (Array.isArray(raw)) return raw.length === 0;
      return String(raw).trim() === "";
    }
    if (f.op === "is_not_empty") {
      const raw = cf[propId];
      if (raw == null) return false;
      if (Array.isArray(raw)) return raw.length > 0;
      return String(raw).trim() !== "";
    }
    if (f.op === "contains" && f.value?.trim()) return customMultiContains(cf, propId, f.value.trim());
    return false;
  }
  if (t === "files") {
    return customTextPathMatches(cf, propId, f.op, f.value, f.value2);
  }
  if (t === "account") {
    return dataSourceMatches(tx.data_source_id, f.op, f.value);
  }
  return false;
}
