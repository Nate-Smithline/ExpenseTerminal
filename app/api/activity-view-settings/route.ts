import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { activityViewSettingsPatchSchema, ACTIVITY_SORT_COLUMNS } from "@/lib/validation/schemas";
import {
  filterActivityVisibleColumns,
  filterColumnWidthKeys,
} from "@/lib/activity-visible-column-keys";
import { parseColumnFiltersJson } from "@/lib/activity-column-filters";

const DEFAULT_VISIBLE_COLUMNS: string[] = [
  "date",
  "vendor",
  "amount",
  "transaction_type",
  "status",
  "category",
];

function defaultSettings() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    sort_column: "date",
    sort_asc: false,
    visible_columns: DEFAULT_VISIBLE_COLUMNS,
    column_widths: {} as Record<string, number>,
    filters: {
      status: null,
      transaction_type: null,
      source: null,
      data_source_id: null,
      search: "",
      date_from: "2000-01-01",
      date_to: today,
      column_filters: [] as unknown[],
    },
  };
}

export async function GET(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;
  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const supabase = authClient;

  const orgId = await getActiveOrgId(supabase, userId);
  if (!orgId) {
    return NextResponse.json(defaultSettings());
  }

  const { data, error } = await (supabase as any)
    .from("activity_view_settings")
    .select("sort_column,sort_asc,visible_columns,column_widths,filters")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to load view settings") },
      { status: 500 }
    );
  }

  const def = defaultSettings();
  if (!data) {
    return NextResponse.json(def);
  }

  const visible = Array.isArray(data.visible_columns)
    ? filterActivityVisibleColumns(data.visible_columns as string[])
    : def.visible_columns;
  const filters =
    data.filters && typeof data.filters === "object"
      ? {
          status: data.filters.status ?? null,
          transaction_type: data.filters.transaction_type ?? null,
          source: data.filters.source ?? null,
          data_source_id: typeof data.filters.data_source_id === "string" ? data.filters.data_source_id : null,
          search: typeof data.filters.search === "string" ? data.filters.search : "",
          date_from: typeof data.filters.date_from === "string" ? data.filters.date_from : def.filters.date_from,
          date_to: typeof data.filters.date_to === "string" ? data.filters.date_to : def.filters.date_to,
          column_filters: parseColumnFiltersJson((data.filters as Record<string, unknown>).column_filters),
        }
      : def.filters;
  const columnWidths =
    data.column_widths && typeof data.column_widths === "object" && !Array.isArray(data.column_widths)
      ? filterColumnWidthKeys(data.column_widths as Record<string, number>)
      : def.column_widths;

  return NextResponse.json({
    sort_column: ACTIVITY_SORT_COLUMNS.includes(data.sort_column as any)
      ? data.sort_column
      : def.sort_column,
    sort_asc: typeof data.sort_asc === "boolean" ? data.sort_asc : def.sort_asc,
    visible_columns: visible.length > 0 ? visible : def.visible_columns,
    column_widths: columnWidths,
    filters,
  });
}

export async function PATCH(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;
  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const supabase = authClient;

  const orgId = await getActiveOrgId(supabase, userId);
  if (!orgId) {
    return NextResponse.json({ error: "No active org" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = activityViewSettingsPatchSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "Invalid request body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const def = defaultSettings();
  const { sort_column, sort_asc, visible_columns, column_widths, filters } = parsed.data;

  const { data: existing } = await (supabase as any)
    .from("activity_view_settings")
    .select("id,sort_column,sort_asc,visible_columns,column_widths,filters")
    .eq("org_id", orgId)
    .maybeSingle();

  const nextSortColumn = sort_column ?? existing?.sort_column ?? def.sort_column;
  const nextSortAsc =
    sort_asc !== undefined ? sort_asc : (existing?.sort_asc ?? def.sort_asc);
  const nextVisibleRaw =
    visible_columns ??
    (Array.isArray(existing?.visible_columns) ? existing.visible_columns : def.visible_columns);
  const nextVisible = filterActivityVisibleColumns(nextVisibleRaw as string[]);
  const existingWidths =
    existing?.column_widths && typeof existing.column_widths === "object"
      ? existing.column_widths
      : {};
  const nextColumnWidths = column_widths
    ? filterColumnWidthKeys({ ...existingWidths, ...column_widths })
    : filterColumnWidthKeys(
        existingWidths && typeof existingWidths === "object" ? { ...existingWidths } : {}
      );
  const existingFilters =
    existing?.filters && typeof existing.filters === "object" && !Array.isArray(existing.filters)
      ? existing.filters
      : {};
  const nextFilters = filters
    ? { ...def.filters, ...existingFilters, ...filters }
    : { ...def.filters, ...existingFilters };

  const payload = {
    org_id: orgId,
    // Org-wide settings (not user-owned). Keep attribution only.
    last_edited_by: userId,
    sort_column: nextSortColumn,
    sort_asc: nextSortAsc,
    visible_columns: nextVisible.length > 0 ? nextVisible : def.visible_columns,
    column_widths: nextColumnWidths,
    filters: nextFilters,
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error } = await (supabase as any)
    .from("activity_view_settings")
    .upsert(payload, { onConflict: "org_id" })
    .select("sort_column,sort_asc,visible_columns,column_widths,filters")
    .single();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to save view settings") },
      { status: 500 }
    );
  }

  return NextResponse.json({
    sort_column: saved.sort_column ?? def.sort_column,
    sort_asc: saved.sort_asc ?? def.sort_asc,
    visible_columns: Array.isArray(saved.visible_columns)
      ? saved.visible_columns
      : def.visible_columns,
    column_widths:
      saved.column_widths && typeof saved.column_widths === "object"
        ? saved.column_widths
        : def.column_widths,
    filters:
      saved.filters && typeof saved.filters === "object"
        ? {
            ...def.filters,
            ...saved.filters,
            source: saved.filters.source ?? def.filters.source,
            date_from: saved.filters.date_from ?? def.filters.date_from,
            date_to: saved.filters.date_to ?? def.filters.date_to,
            column_filters: parseColumnFiltersJson(
              (saved.filters as Record<string, unknown>).column_filters
            ),
          }
        : def.filters,
  });
}
