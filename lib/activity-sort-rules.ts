import {
  activitySortRuleSchema,
  activitySortRulesSchema,
  type ActivitySortRule,
} from "@/lib/validation/schemas";

const DEFAULT_RULES: ActivitySortRule[] = [{ column: "date", asc: false }];

/** Query param value for `sort_rules` (URLSearchParams encodes; store raw JSON). */
export function serializeSortRulesForQuery(rules: ActivitySortRule[]): string {
  return JSON.stringify(rules);
}

function coerceRulesArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw.slice(0, 5);
  return [];
}

export function parseSortRulesJson(raw: unknown): ActivitySortRule[] {
  if (raw == null) return [];
  let v: unknown = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  const arr = coerceRulesArray(v);
  if (arr.length === 0) return [];
  const parsed = activitySortRulesSchema.safeParse(arr);
  return parsed.success ? parsed.data : [];
}

export function parseSortRulesQueryParam(raw: string | null): ActivitySortRule[] {
  if (raw == null || !String(raw).trim()) return [];
  const t = String(raw).trim();
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(t);
  } catch {
    try {
      parsedJson = JSON.parse(decodeURIComponent(t));
    } catch {
      return [];
    }
  }
  return parseSortRulesJson(parsedJson);
}

/** Build canonical rules from `page_activity_view_settings` row (JSON + legacy columns). */
export function normalizeSortRulesFromSettingsRow(
  data: Record<string, unknown> | null | undefined
): ActivitySortRule[] {
  if (!data) return DEFAULT_RULES;
  const fromJson = parseSortRulesJson(data.sort_rules);
  if (fromJson.length > 0) return fromJson;
  const col = typeof data.sort_column === "string" ? data.sort_column : "date";
  const asc = typeof data.sort_asc === "boolean" ? data.sort_asc : false;
  const one = activitySortRuleSchema.safeParse({ column: col, asc });
  return one.success ? [one.data] : DEFAULT_RULES;
}

export function primarySortFromRules(rules: ActivitySortRule[]): {
  sort_column: string;
  sort_asc: boolean;
} {
  const r = rules[0] ?? DEFAULT_RULES[0];
  return { sort_column: String(r.column), sort_asc: r.asc };
}
