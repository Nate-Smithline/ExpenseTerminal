import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";
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
  const year = new Date().getFullYear();
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
      date_from: `${year}-01-01`,
      date_to: `${year}-12-31`,
      column_filters: [] as unknown[],
    },
  };
}

async function resolveOrgId(supabase: any, userId: string): Promise<string> {
  const existing = await getActiveOrgId(supabase, userId);
  if (existing) return existing;
  return await ensureActiveOrgForUser(userId);
}

async function assertPageAccess(
  supabase: any,
  orgId: string,
  pageId: string
): Promise<{ ok: true } | { ok: false; status: number; body: any }> {
  const { data, error } = await supabase
    .from("pages")
    .select("id")
    .eq("id", pageId)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 500,
      body: { error: safeErrorMessage(error.message, "Failed to load page") },
    };
  }
  if (!data) {
    return { ok: false, status: 404, body: { error: "Page not found" } };
  }
  return { ok: true };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
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

    const orgId = await resolveOrgId(supabase, userId);
    const { id: pageId } = await ctx.params;

    const access = await assertPageAccess(supabase, orgId, pageId);
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });

    const { data, error } = await (supabase as any)
      .from("page_activity_view_settings")
      .select("sort_column,sort_asc,visible_columns,column_widths,filters")
      .eq("page_id", pageId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: safeErrorMessage(error.message, "Failed to load view settings") },
        { status: 500 }
      );
    }

    const def = defaultSettings();
    if (!data) return NextResponse.json(def);

    const visible = Array.isArray(data.visible_columns)
      ? filterActivityVisibleColumns(data.visible_columns as string[])
      : def.visible_columns;
    const filters =
      data.filters && typeof data.filters === "object"
        ? {
            status: data.filters.status ?? null,
            transaction_type: data.filters.transaction_type ?? null,
            source: data.filters.source ?? null,
            data_source_id:
              typeof data.filters.data_source_id === "string" ? data.filters.data_source_id : null,
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
      sort_column: ACTIVITY_SORT_COLUMNS.includes(data.sort_column as any) ? data.sort_column : def.sort_column,
      sort_asc: typeof data.sort_asc === "boolean" ? data.sort_asc : def.sort_asc,
      visible_columns: visible.length > 0 ? visible : def.visible_columns,
      column_widths: columnWidths,
      filters,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load view settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
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

    const orgId = await resolveOrgId(supabase, userId);
    const { id: pageId } = await ctx.params;

    const access = await assertPageAccess(supabase, orgId, pageId);
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });

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
      .from("page_activity_view_settings")
      .select("page_id,sort_column,sort_asc,visible_columns,column_widths,filters")
      .eq("page_id", pageId)
      .maybeSingle();

    const nextSortColumn = sort_column ?? existing?.sort_column ?? def.sort_column;
    const nextSortAsc = sort_asc !== undefined ? sort_asc : (existing?.sort_asc ?? def.sort_asc);
    const nextVisibleRaw =
      visible_columns ??
      (Array.isArray(existing?.visible_columns) ? existing.visible_columns : def.visible_columns);
    const nextVisible = filterActivityVisibleColumns(nextVisibleRaw as string[]);
    const existingWidths =
      existing?.column_widths && typeof existing.column_widths === "object" ? existing.column_widths : {};
    const nextColumnWidths = column_widths
      ? filterColumnWidthKeys({ ...existingWidths, ...column_widths })
      : filterColumnWidthKeys({ ...existingWidths });
    const existingFilters =
      existing?.filters && typeof existing.filters === "object" && !Array.isArray(existing.filters)
        ? existing.filters
        : {};
    const nextFilters = filters
      ? { ...def.filters, ...existingFilters, ...filters }
      : { ...def.filters, ...existingFilters };

    const payload = {
      page_id: pageId,
      user_id: userId,
      sort_column: nextSortColumn,
      sort_asc: nextSortAsc,
      visible_columns: nextVisible.length > 0 ? nextVisible : def.visible_columns,
      column_widths: nextColumnWidths,
      filters: nextFilters,
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error } = await (supabase as any)
      .from("page_activity_view_settings")
      .upsert(payload, { onConflict: "page_id" })
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
      visible_columns: Array.isArray(saved.visible_columns) ? saved.visible_columns : def.visible_columns,
      column_widths:
        saved.column_widths && typeof saved.column_widths === "object" ? saved.column_widths : def.column_widths,
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
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save view settings" },
      { status: 500 }
    );
  }
}

