import { activitySortRulesSchema, type ActivitySortRule } from "@/lib/validation/schemas";

export function parseSortRulesJson(raw: unknown): ActivitySortRule[] {
  const parsed = activitySortRulesSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export function serializeSortRulesForQuery(rules: ActivitySortRule[]): string {
  try {
    return encodeURIComponent(JSON.stringify(rules));
  } catch {
    return encodeURIComponent("[]");
  }
}

export function parseSortRulesQueryParam(param: string | null): ActivitySortRule[] {
  if (!param || !param.trim()) return [];
  try {
    const decoded = decodeURIComponent(param);
    const json = JSON.parse(decoded) as unknown;
    return parseSortRulesJson(json);
  } catch {
    return [];
  }
}

export function normalizeSortRulesFromSettingsRow(data: Record<string, unknown> | null): ActivitySortRule[] {
  const rules = data ? parseSortRulesJson((data as any).sort_rules) : [];
  if (rules.length > 0) return rules;

  const sortCol = data && typeof (data as any).sort_column === "string" ? String((data as any).sort_column) : "date";
  const sortAsc = data && typeof (data as any).sort_asc === "boolean" ? Boolean((data as any).sort_asc) : false;
  // We intentionally validate via schema by filtering out invalid columns.
  const fallback = parseSortRulesJson([{ column: sortCol as any, asc: sortAsc }]);
  return fallback.length > 0 ? fallback : [{ column: "date", asc: false }];
}

export function primarySortFromRules(rules: ActivitySortRule[]): { sort_column: string; sort_asc: boolean } {
  const first = rules[0];
  return first ? { sort_column: first.column, sort_asc: first.asc } : { sort_column: "date", sort_asc: false };
}

