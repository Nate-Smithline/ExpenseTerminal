import {
  activityColumnFilterRowSchema,
  activityColumnFiltersArraySchema,
  type ActivityFilterableStandardColumn,
  ACTIVITY_FILTERABLE_STANDARD_COLUMNS,
} from "@/lib/validation/schemas";

export type ActivityColumnFilterRow = import("zod").infer<typeof activityColumnFilterRowSchema>;

export const TEXT_FILTER_OPS = [
  "contains",
  "is",
  "is_not",
  "does_not_contain",
  "starts_with",
  "ends_with",
  "is_empty",
  "is_not_empty",
] as const;
export type TextColumnFilterOp = (typeof TEXT_FILTER_OPS)[number];

export const DATE_FILTER_OPS = [
  "is",
  "before",
  "after",
  "on_or_before",
  "on_or_after",
  "between",
  "is_empty",
  "is_not_empty",
] as const;
export type DateColumnFilterOp = (typeof DATE_FILTER_OPS)[number];

export const NUMBER_FILTER_OPS = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "is_empty",
  "is_not_empty",
] as const;
export type NumberColumnFilterOp = (typeof NUMBER_FILTER_OPS)[number];

export const ENUM_FILTER_OPS = ["is", "is_not", "is_empty", "is_not_empty"] as const;
export type EnumColumnFilterOp = (typeof ENUM_FILTER_OPS)[number];

export const CHECKBOX_FILTER_OPS = ["is_checked", "is_unchecked"] as const;

export const MULTI_FILTER_OPS = ["contains", "is_empty", "is_not_empty"] as const;

const TEXT_OP_LABELS: Record<TextColumnFilterOp, string> = {
  contains: "contains",
  is: "is",
  is_not: "is not",
  does_not_contain: "does not contain",
  starts_with: "starts with",
  ends_with: "ends with",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

const DATE_OP_LABELS: Record<DateColumnFilterOp, string> = {
  is: "is",
  before: "is before",
  after: "is after",
  on_or_before: "is on or before",
  on_or_after: "is on or after",
  between: "is between",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

const NUMBER_OP_LABELS: Record<NumberColumnFilterOp, string> = {
  eq: "=",
  neq: "≠",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

const ENUM_OP_LABELS: Record<EnumColumnFilterOp, string> = {
  is: "is",
  is_not: "is not",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

const CHECKBOX_OP_LABELS: Record<(typeof CHECKBOX_FILTER_OPS)[number], string> = {
  is_checked: "is checked",
  is_unchecked: "is unchecked",
};

const MULTI_OP_LABELS: Record<(typeof MULTI_FILTER_OPS)[number], string> = {
  contains: "contains",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

const FILES_OP_LABELS: Record<(typeof FILES_FILTER_OPS)[number], string> = {
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

export type ColumnFilterKind = "text" | "date" | "number" | "enum" | "checkbox" | "multi" | "files";

export const FILES_FILTER_OPS = ["is_empty", "is_not_empty"] as const;

const STANDARD_KIND: Record<ActivityFilterableStandardColumn, ColumnFilterKind> = {
  date: "date",
  vendor: "text",
  description: "text",
  amount: "number",
  transaction_type: "enum",
  status: "enum",
  category: "text",
  schedule_c_line: "text",
  source: "enum",
  ai_confidence: "number",
  business_purpose: "text",
  quick_label: "text",
  notes: "text",
  deduction_percent: "number",
  vendor_normalized: "text",
  data_source_id: "enum",
  created_at: "date",
};

const FILTERABLE_STANDARD_SET = new Set<string>(ACTIVITY_FILTERABLE_STANDARD_COLUMNS);

export function isStandardFilterableColumn(col: string): col is ActivityFilterableStandardColumn {
  return FILTERABLE_STANDARD_SET.has(col);
}

export function standardColumnFilterKind(col: ActivityFilterableStandardColumn): ColumnFilterKind {
  return STANDARD_KIND[col];
}

export function orgPropertyFilterKind(type: string): ColumnFilterKind {
  switch (type) {
    case "short_text":
    case "long_text":
    case "phone":
    case "email":
    case "org_user":
      return "text";
    case "date":
    case "created_time":
    case "last_edited_date":
    case "last_edited_time":
      return "date";
    case "number":
      return "number";
    case "select":
      return "enum";
    case "multi_select":
      return "multi";
    case "checkbox":
      return "checkbox";
    case "files":
      return "files";
    case "account":
      return "enum";
    default:
      return "text";
  }
}

export function opsForKind(kind: ColumnFilterKind): readonly string[] {
  switch (kind) {
    case "text":
      return TEXT_FILTER_OPS;
    case "date":
      return DATE_FILTER_OPS;
    case "number":
      return NUMBER_FILTER_OPS;
    case "enum":
      return ENUM_FILTER_OPS;
    case "checkbox":
      return CHECKBOX_FILTER_OPS;
    case "multi":
      return MULTI_FILTER_OPS;
    case "files":
      return FILES_FILTER_OPS;
    default:
      return TEXT_FILTER_OPS;
  }
}

export function opLabel(kind: ColumnFilterKind, op: string): string {
  if (kind === "text") return TEXT_OP_LABELS[op as TextColumnFilterOp] ?? op;
  if (kind === "date") return DATE_OP_LABELS[op as DateColumnFilterOp] ?? op;
  if (kind === "number") return NUMBER_OP_LABELS[op as NumberColumnFilterOp] ?? op;
  if (kind === "enum") return ENUM_OP_LABELS[op as EnumColumnFilterOp] ?? op;
  if (kind === "checkbox") return CHECKBOX_OP_LABELS[op as (typeof CHECKBOX_FILTER_OPS)[number]] ?? op;
  if (kind === "multi") return MULTI_OP_LABELS[op as (typeof MULTI_FILTER_OPS)[number]] ?? op;
  if (kind === "files") return FILES_OP_LABELS[op as (typeof FILES_FILTER_OPS)[number]] ?? op;
  return op;
}

export function defaultOpForKind(kind: ColumnFilterKind): string {
  switch (kind) {
    case "text":
      return "contains";
    case "date":
      return "is";
    case "number":
      return "eq";
    case "enum":
      return "is";
    case "checkbox":
      return "is_checked";
    case "multi":
      return "contains";
    case "files":
      return "is_empty";
    default:
      return "contains";
  }
}

export function opNeedsValue(kind: ColumnFilterKind, op: string): boolean {
  if (op === "is_empty" || op === "is_not_empty") return false;
  if (kind === "checkbox" && (op === "is_checked" || op === "is_unchecked")) return false;
  if (kind === "files") return false;
  if (op === "between") return true;
  return true;
}

export function opNeedsSecondValue(kind: ColumnFilterKind, op: string): boolean {
  return kind === "date" && op === "between";
}

export function sanitizeLikeFragment(s: string): string {
  return s.replace(/\\/g, "").replace(/%/g, "").replace(/_/g, "").slice(0, 200);
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function nextDayYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

function isValidYmd(s: string): boolean {
  return YMD.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00.000Z`));
}

/** JSONB text extraction path for PostgREST (uuid-safe) */
export function customFieldTextPath(propId: string): string {
  return `custom_fields->>'${propId}'`;
}

export function customFieldJsonPath(propId: string): string {
  return `custom_fields->'${propId}'`;
}

function customFieldNumericCastPath(propId: string): string {
  return `cast(custom_fields->>'${propId}',numeric)`;
}

export function parseColumnFiltersJson(raw: unknown): ActivityColumnFilterRow[] {
  const parsed = activityColumnFiltersArraySchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export function serializeColumnFiltersForQuery(filters: ActivityColumnFilterRow[]): string {
  try {
    return encodeURIComponent(JSON.stringify(filters));
  } catch {
    return encodeURIComponent("[]");
  }
}

export function parseColumnFiltersQueryParam(param: string | null): ActivityColumnFilterRow[] {
  if (!param || !param.trim()) return [];
  try {
    const decoded = decodeURIComponent(param);
    const json = JSON.parse(decoded) as unknown;
    return parseColumnFiltersJson(json);
  } catch {
    return [];
  }
}

type OrgTypeMap = Map<string, string>;

function resolveKind(column: string, orgTypes: OrgTypeMap): ColumnFilterKind | null {
  if (isStandardFilterableColumn(column)) return standardColumnFilterKind(column);
  const t = orgTypes.get(column);
  if (!t) return null;
  return orgPropertyFilterKind(t);
}

function applyTextFilter(q: any, col: string, op: string, value: string | undefined): any {
  const v = (value ?? "").trim();
  const safe = sanitizeLikeFragment(v);
  switch (op) {
    case "contains":
      if (!safe) return q;
      return q.filter(col, "ilike", `%${safe}%`);
    case "is":
      return q.eq(col, v);
    case "is_not":
      return q.neq(col, v);
    case "does_not_contain":
      if (!safe) return q;
      return q.not(col, "ilike", `%${safe}%`);
    case "starts_with":
      if (!safe) return q;
      return q.filter(col, "ilike", `${safe}%`);
    case "ends_with":
      if (!safe) return q;
      return q.filter(col, "ilike", `%${safe}`);
    case "is_empty":
      return q.or(`${col}.is.null,${col}.eq.`);
    case "is_not_empty":
      return q.not(col, "is", null).neq(col, "");
    default:
      return q;
  }
}

function applyTextFilterNonNullable(q: any, col: string, op: string, value: string | undefined): any {
  const v = (value ?? "").trim();
  const safe = sanitizeLikeFragment(v);
  switch (op) {
    case "contains":
      if (!safe) return q;
      return q.filter(col, "ilike", `%${safe}%`);
    case "is":
      return q.eq(col, v);
    case "is_not":
      return q.neq(col, v);
    case "does_not_contain":
      if (!safe) return q;
      return q.not(col, "ilike", `%${safe}%`);
    case "starts_with":
      if (!safe) return q;
      return q.filter(col, "ilike", `${safe}%`);
    case "ends_with":
      if (!safe) return q;
      return q.filter(col, "ilike", `%${safe}`);
    case "is_empty":
      return q.eq(col, "");
    case "is_not_empty":
      return q.neq(col, "");
    default:
      return q;
  }
}

/** Same haystack as org rules / in-memory vendor matching (lib/org-rules/filter-match vendorRuleSearchHaystack). */
const VENDOR_HAYSTACK_SQL_COLS = ["vendor", "description", "vendor_normalized"] as const;

/**
 * Vendor "contains" / etc. must search merchant text that often lives in `description` or
 * `vendor_normalized`, not `vendor` alone — parity with applyActivityColumnFilters consumers
 * and org rule evaluation.
 */
function applyVendorHaystackTextFilter(q: any, op: string, value: string | undefined): any {
  const v = (value ?? "").trim();
  const safe = sanitizeLikeFragment(v);
  switch (op) {
    case "contains": {
      if (!safe) return q;
      return q.or(VENDOR_HAYSTACK_SQL_COLS.map((col) => `${col}.ilike.%${safe}%`).join(","));
    }
    case "does_not_contain": {
      if (!safe) return q;
      let x = q;
      for (const col of VENDOR_HAYSTACK_SQL_COLS) {
        x = x.not(col, "ilike", `%${safe}%`);
      }
      return x;
    }
    case "starts_with": {
      if (!safe) return q;
      return q.or(VENDOR_HAYSTACK_SQL_COLS.map((col) => `${col}.ilike.${safe}%`).join(","));
    }
    case "ends_with": {
      if (!safe) return q;
      return q.or(VENDOR_HAYSTACK_SQL_COLS.map((col) => `${col}.ilike.%${safe}`).join(","));
    }
    default:
      return applyTextFilterNonNullable(q, "vendor", op, value);
  }
}

function applyDateSqlColumn(q: any, col: string, op: string, value?: string, value2?: string): any {
  const a = (value ?? "").trim();
  const b = (value2 ?? "").trim();
  switch (op) {
    case "is":
      if (!isValidYmd(a)) return q;
      return q.eq(col, a);
    case "before":
      if (!isValidYmd(a)) return q;
      return q.lt(col, a);
    case "after":
      if (!isValidYmd(a)) return q;
      return q.gt(col, a);
    case "on_or_before":
      if (!isValidYmd(a)) return q;
      return q.lte(col, a);
    case "on_or_after":
      if (!isValidYmd(a)) return q;
      return q.gte(col, a);
    case "between":
      if (!isValidYmd(a) || !isValidYmd(b)) return q;
      return q.gte(col, a).lte(col, b);
    case "is_empty":
      return q.is(col, null);
    case "is_not_empty":
      return q.not(col, "is", null);
    default:
      return q;
  }
}

function applyTimestampColumnAsDay(q: any, col: string, op: string, value?: string, value2?: string): any {
  const a = (value ?? "").trim();
  const b = (value2 ?? "").trim();
  switch (op) {
    case "is":
      if (!isValidYmd(a)) return q;
      return q
        .gte(col, `${a}T00:00:00.000Z`)
        .lt(col, `${nextDayYmd(a)}T00:00:00.000Z`);
    case "before":
      if (!isValidYmd(a)) return q;
      return q.lt(col, `${a}T00:00:00.000Z`);
    case "after":
      if (!isValidYmd(a)) return q;
      return q.gte(col, `${nextDayYmd(a)}T00:00:00.000Z`);
    case "on_or_before":
      if (!isValidYmd(a)) return q;
      return q.lt(col, `${nextDayYmd(a)}T00:00:00.000Z`);
    case "on_or_after":
      if (!isValidYmd(a)) return q;
      return q.gte(col, `${a}T00:00:00.000Z`);
    case "between":
      if (!isValidYmd(a) || !isValidYmd(b)) return q;
      return q.gte(col, `${a}T00:00:00.000Z`).lt(col, `${nextDayYmd(b)}T00:00:00.000Z`);
    case "is_empty":
      return q.is(col, null);
    case "is_not_empty":
      return q.not(col, "is", null);
    default:
      return q;
  }
}

function applyNumberColumn(q: any, col: string, op: string, value?: string): any {
  const n = parseFloat(String(value ?? "").trim());
  switch (op) {
    case "eq":
      if (Number.isNaN(n)) return q;
      return q.eq(col, n);
    case "neq":
      if (Number.isNaN(n)) return q;
      return q.neq(col, n);
    case "gt":
      if (Number.isNaN(n)) return q;
      return q.gt(col, n);
    case "gte":
      if (Number.isNaN(n)) return q;
      return q.gte(col, n);
    case "lt":
      if (Number.isNaN(n)) return q;
      return q.lt(col, n);
    case "lte":
      if (Number.isNaN(n)) return q;
      return q.lte(col, n);
    case "is_empty":
      return q.is(col, null);
    case "is_not_empty":
      return q.not(col, "is", null);
    default:
      return q;
  }
}

function applyDeductionPercent(q: any, op: string, value?: string): any {
  const n = parseInt(String(value ?? "").trim(), 10);
  switch (op) {
    case "eq":
      if (Number.isNaN(n)) return q;
      return q.eq("deduction_percent", n);
    case "neq":
      if (Number.isNaN(n)) return q;
      return q.neq("deduction_percent", n);
    case "gt":
      if (Number.isNaN(n)) return q;
      return q.gt("deduction_percent", n);
    case "gte":
      if (Number.isNaN(n)) return q;
      return q.gte("deduction_percent", n);
    case "lt":
      if (Number.isNaN(n)) return q;
      return q.lt("deduction_percent", n);
    case "lte":
      if (Number.isNaN(n)) return q;
      return q.lte("deduction_percent", n);
    case "is_empty":
      return q.is("deduction_percent", null);
    case "is_not_empty":
      return q.not("deduction_percent", "is", null);
    default:
      return q;
  }
}

function applyEnumColumn(q: any, col: string, op: string, value?: string): any {
  const v = (value ?? "").trim();
  switch (op) {
    case "is":
      return q.eq(col, v);
    case "is_not":
      return q.neq(col, v);
    case "is_empty":
      return q.or(`${col}.is.null,${col}.eq.`);
    case "is_not_empty":
      return q.not(col, "is", null).neq(col, "");
    default:
      return q;
  }
}

function applyCustomTextPath(q: any, path: string, op: string, value?: string, value2?: string): any {
  const v = (value ?? "").trim();
  const safe = sanitizeLikeFragment(v);
  switch (op) {
    case "contains":
      if (!safe) return q;
      return q.filter(path, "ilike", `%${safe}%`);
    case "is":
      return q.filter(path, "eq", v);
    case "is_not":
      return q.filter(path, "neq", v);
    case "does_not_contain":
      if (!safe) return q;
      return q.not(path, "ilike", `%${safe}%`);
    case "starts_with":
      if (!safe) return q;
      return q.filter(path, "ilike", `${safe}%`);
    case "ends_with":
      if (!safe) return q;
      return q.filter(path, "ilike", `%${safe}`);
    case "is_empty":
      return q.or(`${path}.is.null,${path}.eq.`);
    case "is_not_empty":
      return q.not(path, "is", null).filter(path, "neq", "");
    default:
      if (op === "is" && isValidYmd(v)) return q.filter(path, "eq", v);
      if (op === "before" && isValidYmd(v)) return q.filter(path, "lt", v);
      if (op === "after" && isValidYmd(v)) return q.filter(path, "gt", v);
      if (op === "on_or_before" && isValidYmd(v)) return q.filter(path, "lte", v);
      if (op === "on_or_after" && isValidYmd(v)) return q.filter(path, "gte", v);
      if (op === "between" && isValidYmd(v) && isValidYmd(String(value2 ?? ""))) {
        const b = String(value2).trim();
        return q.filter(path, "gte", v).filter(path, "lte", b);
      }
      if (op === "is_empty") return q.or(`${path}.is.null,${path}.eq.`);
      if (op === "is_not_empty") return q.not(path, "is", null).filter(path, "neq", "");
      return q;
  }
}

function applyCustomNumericPath(q: any, castPath: string, op: string, value?: string): any {
  const n = parseFloat(String(value ?? "").trim());
  switch (op) {
    case "eq":
    case "is":
      if (Number.isNaN(n)) return q;
      return q.filter(castPath, "eq", n);
    case "neq":
    case "is_not":
      if (Number.isNaN(n)) return q;
      return q.filter(castPath, "neq", n);
    case "gt":
    case "after":
      if (Number.isNaN(n)) return q;
      return q.filter(castPath, "gt", n);
    case "gte":
    case "on_or_after":
      if (Number.isNaN(n)) return q;
      return q.filter(castPath, "gte", n);
    case "lt":
    case "before":
      if (Number.isNaN(n)) return q;
      return q.filter(castPath, "lt", n);
    case "lte":
    case "on_or_before":
      if (Number.isNaN(n)) return q;
      return q.filter(castPath, "lte", n);
    case "is_empty":
      return q.filter(castPath, "is", null);
    case "is_not_empty":
      return q.not(castPath, "is", null);
    default:
      return q;
  }
}

function applyCustomJsonPath(q: any, path: string, op: string, value?: string): any {
  const v = (value ?? "").trim();
  if (op === "is_checked") return q.filter(path, "eq", true);
  if (op === "is_unchecked") return q.filter(path, "eq", false);
  if (op === "is" || op === "eq") {
    if (v === "true") return q.filter(path, "eq", true);
    if (v === "false") return q.filter(path, "eq", false);
  }
  return q;
}

function applyCustomCheckboxPath(q: any, propId: string, textPath: string, op: string): any {
  // Checkbox custom fields are stored as JSON booleans in custom_fields.
  // For "checked", JSONB containment is the most reliable PostgREST/Supabase filter.
  if (op === "is_checked") return q.contains("custom_fields", { [propId]: true });
  // For "unchecked", treat missing as unchecked (null) or explicitly false.
  // PostgREST `or()` string values should be quoted; ->> yields text.
  if (op === "is_unchecked") return q.or(`${textPath}.is.null,${textPath}.eq.\"false\"`);
  return q;
}

function applyCustomMultiContains(q: any, propId: string, optionId: string): any {
  if (!optionId.trim()) return q;
  return q.contains("custom_fields", { [propId]: [optionId] });
}

/**
 * AND-combine validated column filters onto a Supabase transactions query.
 */
export function applyActivityColumnFilters(
  query: any,
  filters: ActivityColumnFilterRow[],
  orgTypes: OrgTypeMap
): any {
  let q = query;
  for (const f of filters) {
    const kind = resolveKind(f.column, orgTypes);
    if (!kind) continue;
    const ops = opsForKind(kind);
    if (!ops.includes(f.op)) continue;

    const needs = opNeedsValue(kind, f.op);
    const needs2 = opNeedsSecondValue(kind, f.op);
    if (needs && !f.value?.trim() && f.op !== "between") {
      if (!["is_empty", "is_not_empty", "is_checked", "is_unchecked"].includes(f.op)) continue;
    }
    if (needs2 && (!f.value?.trim() || !f.value2?.trim())) continue;

    if (isStandardFilterableColumn(f.column)) {
      const col = f.column;
      if (col === "date") {
        q = applyDateSqlColumn(q, "date", f.op, f.value, f.value2);
        continue;
      }
      if (col === "created_at") {
        q = applyTimestampColumnAsDay(q, "created_at", f.op, f.value, f.value2);
        continue;
      }
      if (col === "vendor") {
        q = applyVendorHaystackTextFilter(q, f.op, f.value);
        continue;
      }
      if (col === "amount") {
        q = applyNumberColumn(q, "amount", f.op, f.value);
        continue;
      }
      if (col === "deduction_percent") {
        q = applyDeductionPercent(q, f.op, f.value);
        continue;
      }
      if (col === "ai_confidence") {
        q = applyNumberColumn(q, "ai_confidence", f.op, f.value);
        continue;
      }
      if (col === "transaction_type" || col === "status" || col === "source") {
        q = applyEnumColumn(q, col, f.op, f.value);
        continue;
      }
      if (col === "data_source_id") {
        if (f.op === "is_empty") q = q.is("data_source_id", null);
        else if (f.op === "is_not_empty") q = q.not("data_source_id", "is", null);
        else if (f.op === "is" && f.value?.trim()) q = q.eq("data_source_id", f.value.trim());
        else if (f.op === "is_not" && f.value?.trim()) q = q.neq("data_source_id", f.value.trim());
        continue;
      }
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
        q = applyTextFilter(q, col, f.op, f.value);
        continue;
      }
      continue;
    }

    const propId = f.column;
    const t = orgTypes.get(propId);
    if (!t) continue;
    const textPath = customFieldTextPath(propId);
    const numPath = customFieldNumericCastPath(propId);

    if (t === "short_text" || t === "long_text" || t === "phone" || t === "email" || t === "org_user") {
      q = applyCustomTextPath(q, textPath, f.op, f.value, f.value2);
      continue;
    }
    if (t === "date") {
      q = applyCustomTextPath(q, textPath, f.op, f.value, f.value2);
      continue;
    }
    if (t === "number") {
      q = applyCustomNumericPath(q, numPath, f.op, f.value);
      continue;
    }
    if (t === "checkbox") {
      q = applyCustomCheckboxPath(q, propId, textPath, f.op);
      continue;
    }
    if (t === "select") {
      if (f.op === "is_empty" || f.op === "is_not_empty") {
        q = applyCustomTextPath(q, textPath, f.op, f.value, f.value2);
      } else if (f.op === "is" || f.op === "eq") {
        q = q.filter(textPath, "eq", (f.value ?? "").trim());
      } else if (f.op === "is_not" || f.op === "neq") {
        q = q.filter(textPath, "neq", (f.value ?? "").trim());
      }
      continue;
    }
    if (t === "multi_select") {
      if (f.op === "is_empty") q = q.or(`${textPath}.is.null,${textPath}.eq.`);
      else if (f.op === "is_not_empty") q = q.not(textPath, "is", null).filter(textPath, "neq", "");
      else if (f.op === "contains" && f.value?.trim()) q = applyCustomMultiContains(q, propId, f.value.trim());
      continue;
    }
    if (t === "files") {
      if (f.op === "is_empty") q = q.or(`${textPath}.is.null,${textPath}.eq.`);
      else if (f.op === "is_not_empty") q = q.not(textPath, "is", null).filter(textPath, "neq", "");
      continue;
    }
    if (t === "account") {
      if (f.op === "is_empty") q = q.is("data_source_id", null);
      else if (f.op === "is_not_empty") q = q.not("data_source_id", "is", null);
      else if (f.op === "is" && f.value?.trim()) q = q.eq("data_source_id", f.value.trim());
      else if (f.op === "is_not" && f.value?.trim()) q = q.neq("data_source_id", f.value.trim());
      continue;
    }
  }
  return q;
}
