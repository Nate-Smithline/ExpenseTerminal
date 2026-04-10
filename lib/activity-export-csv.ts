import type { TransactionPropertyDefinition } from "@/lib/transaction-property-definition";
import { isSystemTransactionPropertyType } from "@/lib/transaction-property-types";
import { ACTIVITY_VISIBLE_COLUMNS, type ActivityVisibleColumn } from "@/lib/validation/schemas";
import { isUuidColumnKey, filterActivityVisibleColumns } from "@/lib/activity-visible-column-keys";

type TxRow = Record<string, unknown>;

const STANDARD_LABELS: Record<ActivityVisibleColumn, string> = {
  date: "Date",
  vendor: "Vendor",
  description: "Description",
  amount: "Amount",
  transaction_type: "Type",
  status: "Status",
  category: "Category",
  schedule_c_line: "Schedule C",
  source: "Source",
  ai_confidence: "AI %",
  business_purpose: "Business purpose",
  quick_label: "Quick label",
  notes: "Notes",
  created_at: "Created",
  data_source_id: "Account",
};

function getCustomFields(t: TxRow): Record<string, unknown> {
  const cf = t.custom_fields;
  if (cf && typeof cf === "object" && !Array.isArray(cf)) return cf as Record<string, unknown>;
  return {};
}

function optionLabel(config: Record<string, unknown> | null, id: string): string {
  const opts = config?.options;
  if (!Array.isArray(opts)) return id;
  for (const o of opts) {
    if (o && typeof o === "object" && String((o as { id?: unknown }).id) === id) {
      return String((o as { label?: unknown }).label ?? id);
    }
  }
  return id;
}

function formatDate(date: string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatAmount(amount: unknown, transactionType: string | null | undefined): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return "";
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (transactionType === "income") return `+$${formatted}`;
  return `-$${formatted}`;
}

function formatAiConfidence(val: unknown): string {
  if (val == null || val === "") return "";
  return `${Math.round(Number(val) * 100)}%`;
}

function sourceTagLabel(source: string | null | undefined): string {
  if (source === "data_feed") return "Direct Feed";
  if (source === "csv_upload") return "CSV";
  if (source === "manual") return "Manual";
  return source ?? "";
}

function formatCustomPropertyCsv(
  t: TxRow,
  col: string,
  def: TransactionPropertyDefinition | undefined,
  memberDisplayById: Record<string, string>,
  dataSourceNameById: Record<string, string>
): string {
  if (def?.type === "account") {
    const id = t.data_source_id as string | null | undefined;
    if (!id) return "";
    return dataSourceNameById[id] ?? "";
  }

  if (def && isSystemTransactionPropertyType(def.type)) {
    switch (def.type) {
      case "created_time":
        return t.created_at
          ? new Date(String(t.created_at)).toLocaleString(undefined, {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "";
      case "created_by":
        return memberDisplayById[String(t.user_id ?? "")] || String(t.user_id ?? "");
      case "last_edited_date":
        return t.updated_at ? formatDate(String(t.updated_at)) : "";
      case "last_edited_time":
        return t.updated_at
          ? new Date(String(t.updated_at)).toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            })
          : "";
      default:
        return "";
    }
  }

  const fields = getCustomFields(t);
  const raw = fields[col];

  if (!def) {
    if (raw === undefined || raw === null) return "";
    if (typeof raw === "string") return raw;
    if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
    if (Array.isArray(raw)) return raw.map(String).join(", ");
    return "";
  }

  switch (def.type) {
    case "select":
      if (raw == null || raw === "") return "";
      return optionLabel(def.config, String(raw));
    case "multi_select": {
      if (!Array.isArray(raw) || raw.length === 0) return "";
      return raw.map((id) => optionLabel(def.config, String(id))).join(", ");
    }
    case "date":
      if (raw == null || raw === "") return "";
      return formatDate(String(raw));
    case "short_text":
    case "long_text":
    case "email":
      if (raw == null || raw === "") return "";
      return String(raw);
    case "phone":
      if (raw == null || raw === "") return "";
      return String(raw);
    case "checkbox":
      return raw === true ? "Yes" : raw === false ? "No" : "";
    case "number":
      if (raw == null || raw === "") return "";
      return String(raw);
    case "org_user": {
      if (raw == null || raw === "") return "";
      const id = String(raw);
      return memberDisplayById[id] || id;
    }
    case "files": {
      if (!Array.isArray(raw) || raw.length === 0) return "";
      return `${raw.length} file(s)`;
    }
    default:
      if (raw === undefined || raw === null) return "";
      return String(raw);
  }
}

function formatStandardCsv(t: TxRow, col: ActivityVisibleColumn): string {
  switch (col) {
    case "date":
      return formatDate(t.date as string | undefined);
    case "vendor":
      return String(t.vendor ?? "");
    case "source":
      return sourceTagLabel(t.source as string | null | undefined);
    case "description":
      return t.description != null ? String(t.description) : "";
    case "amount":
      return formatAmount(t.amount, t.transaction_type as string | null | undefined);
    case "transaction_type":
      return String(t.transaction_type ?? "");
    case "status":
      return String(t.status ?? "");
    case "category":
      return String(t.category ?? "");
    case "schedule_c_line":
      return String(t.schedule_c_line ?? "");
    case "ai_confidence":
      return formatAiConfidence(t.ai_confidence);
    case "business_purpose":
      return t.business_purpose != null ? String(t.business_purpose) : "";
    case "quick_label":
      return String(t.quick_label ?? "");
    case "notes":
      return t.notes != null ? String(t.notes) : "";
    case "created_at":
      return t.created_at ? formatDate(String(t.created_at)) : "";
    default:
      return "";
  }
}

export function csvEscapeCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function parseExportColumnsParam(raw: string | null, maxCols = 40): string[] {
  if (!raw || !raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return [];
  }
  return parseExportColumnsInput(parsed, maxCols);
}

/** Accept JSON array or stringified JSON array (from query param). */
export function parseExportColumnsInput(raw: unknown, maxCols = 40): string[] {
  if (raw == null) return [];
  let arr: unknown;
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw) as unknown;
    } catch {
      return [];
    }
  } else {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const asStrings = arr.map((x) => String(x));
  const filtered = filterActivityVisibleColumns(asStrings);
  return filtered.slice(0, maxCols);
}

export function buildDbSelectParts(
  exportCols: string[],
  defsById: Map<string, TransactionPropertyDefinition>
): string[] {
  const parts = new Set<string>();
  for (const c of exportCols) {
    if (isUuidColumnKey(c)) {
      parts.add("custom_fields");
      const def = defsById.get(c);
      if (def?.type === "account") {
        parts.add("data_source_id");
      }
      if (def && isSystemTransactionPropertyType(def.type)) {
        if (def.type === "created_time" || def.type === "created_by") {
          parts.add("created_at");
          parts.add("user_id");
        }
        if (def.type === "last_edited_date" || def.type === "last_edited_time") {
          parts.add("updated_at");
        }
      }
      continue;
    }
    if ((ACTIVITY_VISIBLE_COLUMNS as readonly string[]).includes(c)) {
      parts.add(c);
    }
  }
  if (exportCols.some((c) => c === "amount")) {
    parts.add("transaction_type");
  }
  if (parts.size === 0) {
    return ["date", "vendor", "amount", "transaction_type", "status", "category"];
  }
  return [...parts];
}

export function headerLabelsForExport(
  exportCols: string[],
  defsById: Map<string, TransactionPropertyDefinition>
): string[] {
  return exportCols.map((c) => {
    if (isUuidColumnKey(c)) return defsById.get(c)?.name ?? "Property";
    if ((ACTIVITY_VISIBLE_COLUMNS as readonly string[]).includes(c)) {
      return STANDARD_LABELS[c as ActivityVisibleColumn];
    }
    return c;
  });
}

export function rowToCsvLine(
  t: TxRow,
  exportCols: string[],
  defsById: Map<string, TransactionPropertyDefinition>,
  memberDisplayById: Record<string, string>,
  dataSourceNameById: Record<string, string> = {}
): string {
  const cells = exportCols.map((col) => {
    let s: string;
    if (col === "data_source_id") {
      const id = t.data_source_id as string | null | undefined;
      s = id ? (dataSourceNameById[id] ?? "") : "";
    } else if (isUuidColumnKey(col)) {
      s = formatCustomPropertyCsv(t, col, defsById.get(col), memberDisplayById, dataSourceNameById);
    } else if ((ACTIVITY_VISIBLE_COLUMNS as readonly string[]).includes(col)) {
      s = formatStandardCsv(t, col as ActivityVisibleColumn);
    } else {
      s = "";
    }
    return csvEscapeCell(s);
  });
  return cells.join(",");
}
