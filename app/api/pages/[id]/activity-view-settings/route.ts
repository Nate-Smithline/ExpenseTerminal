import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";
import { pageActivityViewSettingsPatchSchema, ACTIVITY_SORT_COLUMNS } from "@/lib/validation/schemas";
import {
  filterActivityVisibleColumns,
  filterColumnWidthKeys,
} from "@/lib/activity-visible-column-keys";
import { parseColumnFiltersJson } from "@/lib/activity-column-filters";
import { normalizeSortRulesFromSettingsRow, primarySortFromRules } from "@/lib/activity-sort-rules";

// These settings must be read/write fresh (no caching), otherwise users can see stale
// filters / column visibility when leaving and returning to a page.
export const dynamic = "force-dynamic";

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
      .select("sort_rules,sort_column,sort_asc,visible_columns,column_widths,filters")
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

    const sort_rules = normalizeSortRulesFromSettingsRow(data as any);
    const primary = primarySortFromRules(sort_rules);

    return NextResponse.json(
      {
      sort_rules,
      sort_column: ACTIVITY_SORT_COLUMNS.includes(primary.sort_column as any) ? primary.sort_column : def.sort_column,
      sort_asc: typeof primary.sort_asc === "boolean" ? primary.sort_asc : def.sort_asc,
      visible_columns: visible.length > 0 ? visible : def.visible_columns,
      column_widths: columnWidths,
      filters,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
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
    const parsed = pageActivityViewSettingsPatchSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.flatten().formErrors[0] ?? "Invalid request body";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const def = defaultSettings();
    const { sort_column, sort_asc, sort_rules, visible_columns, column_widths, filters } = parsed.data;

    const { data: existing } = await (supabase as any)
      .from("page_activity_view_settings")
      .select("page_id,sort_rules,sort_column,sort_asc,visible_columns,column_widths,filters")
      .eq("page_id", pageId)
      .maybeSingle();

    const existingRules = normalizeSortRulesFromSettingsRow(existing as any);
    const primaryFromPatchRules = sort_rules ? primarySortFromRules(sort_rules) : null;
    const nextSortColumn =
      primaryFromPatchRules?.sort_column ??
      sort_column ??
      existing?.sort_column ??
      def.sort_column;
    const nextSortAsc =
      primaryFromPatchRules?.sort_asc ??
      (sort_asc !== undefined ? sort_asc : (existing?.sort_asc ?? def.sort_asc));
    const nextSortRules =
      sort_rules ??
      (sort_column !== undefined || sort_asc !== undefined
        ? normalizeSortRulesFromSettingsRow({ sort_column: nextSortColumn, sort_asc: nextSortAsc } as any)
        : existingRules);
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
      // Org-wide settings (not user-owned). Keep attribution only.
      last_edited_by: userId,
      sort_rules: nextSortRules,
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
      .select("sort_rules,sort_column,sort_asc,visible_columns,column_widths,filters")
      .single();

    if (error) {
      return NextResponse.json(
        { error: safeErrorMessage(error.message, "Failed to save view settings") },
        { status: 500 }
      );
    }

    const savedSortRules = normalizeSortRulesFromSettingsRow(saved as any);
    const savedPrimary = primarySortFromRules(savedSortRules);

    return NextResponse.json(
      {
      sort_rules: savedSortRules,
      sort_column: savedPrimary.sort_column ?? def.sort_column,
      sort_asc: savedPrimary.sort_asc ?? def.sort_asc,
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
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save view settings" },
      { status: 500 }
    );
  }
}

