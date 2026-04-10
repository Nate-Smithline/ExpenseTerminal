import { ACTIVITY_SORT_COLUMNS } from "@/lib/validation/schemas";
import { filterActivityVisibleColumns } from "@/lib/activity-visible-column-keys";
import { normalizeSortRulesFromSettingsRow, primarySortFromRules } from "@/lib/activity-sort-rules";

const DEFAULT_VISIBLE: string[] = [
  "date",
  "vendor",
  "amount",
  "transaction_type",
  "status",
  "category",
];

function defaultFilters(year: number) {
  return {
    status: null as string | null,
    transaction_type: null as string | null,
    source: null as string | null,
    data_source_id: null as string | null,
    search: "",
    date_from: `${year}-01-01`,
    date_to: `${year}-12-31`,
  };
}

export type NormalizedPublishedView = {
  sort_rules: { column: string; asc: boolean }[];
  sort_column: string;
  sort_asc: boolean;
  visible_columns: string[];
  column_widths: Record<string, number>;
  filters: {
    status: string | null;
    transaction_type: string | null;
    source: string | null;
    data_source_id: string | null;
    search: string;
    date_from: string;
    date_to: string;
  };
};

/** Normalize page_activity_view_settings row (same rules as activity-view-settings GET). */
export function normalizePublishedViewSettingsRow(data: Record<string, unknown> | null): NormalizedPublishedView {
  const y = new Date().getFullYear();
  const def: NormalizedPublishedView = {
    sort_rules: [{ column: "date", asc: false }],
    sort_column: "date",
    sort_asc: false,
    visible_columns: DEFAULT_VISIBLE,
    column_widths: {},
    filters: defaultFilters(y),
  };
  if (!data) return def;

  const visible = Array.isArray(data.visible_columns)
    ? filterActivityVisibleColumns(data.visible_columns as string[])
    : def.visible_columns;

  const rawFilters = data.filters && typeof data.filters === "object" && !Array.isArray(data.filters)
    ? (data.filters as Record<string, unknown>)
    : null;

  const filters = rawFilters
    ? {
        status: (rawFilters.status as string | null | undefined) ?? null,
        transaction_type: (rawFilters.transaction_type as string | null | undefined) ?? null,
        source: (rawFilters.source as string | null | undefined) ?? null,
        data_source_id:
          typeof rawFilters.data_source_id === "string" ? rawFilters.data_source_id : null,
        search: typeof rawFilters.search === "string" ? rawFilters.search : "",
        date_from:
          typeof rawFilters.date_from === "string" ? rawFilters.date_from : def.filters.date_from,
        date_to: typeof rawFilters.date_to === "string" ? rawFilters.date_to : def.filters.date_to,
      }
    : def.filters;

  const columnWidths =
    data.column_widths && typeof data.column_widths === "object" && !Array.isArray(data.column_widths)
      ? (data.column_widths as Record<string, number>)
      : def.column_widths;

  const sort_rules = normalizeSortRulesFromSettingsRow(data);
  const primary = primarySortFromRules(sort_rules as any);
  const sortColRaw = typeof primary.sort_column === "string" ? primary.sort_column : "";
  const sortCol = (ACTIVITY_SORT_COLUMNS as readonly string[]).includes(sortColRaw) ? sortColRaw : def.sort_column;

  return {
    sort_rules,
    sort_column: sortCol,
    sort_asc: typeof primary.sort_asc === "boolean" ? primary.sort_asc : def.sort_asc,
    visible_columns: visible.length > 0 ? visible : def.visible_columns,
    column_widths: columnWidths,
    filters,
  };
}
