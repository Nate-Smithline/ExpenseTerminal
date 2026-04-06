import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, expensiveOpLimit } from "@/lib/middleware/rate-limit";
import { ACTIVITY_SORT_COLUMNS, ACTIVITY_FILTERABLE_STANDARD_COLUMNS, uuidSchema } from "@/lib/validation/schemas";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";
import { applyActivityColumnFilters, parseColumnFiltersJson, parseColumnFiltersQueryParam } from "@/lib/activity-column-filters";
import type { ActivityColumnFilterRow } from "@/lib/activity-column-filters";
import type { TransactionPropertyDefinition } from "@/lib/transaction-property-definition";
import { isUuidColumnKey } from "@/lib/activity-visible-column-keys";
import {
  parseExportColumnsParam,
  parseExportColumnsInput,
  buildDbSelectParts,
  headerLabelsForExport,
  rowToCsvLine,
  csvEscapeCell,
} from "@/lib/activity-export-csv";

const STANDARD_FILTERABLE_COLS = new Set<string>(ACTIVITY_FILTERABLE_STANDARD_COLUMNS);

const CSV_PAGE_SIZE = 2000;

const DEFAULT_EXPORT_COLUMNS = [
  "date",
  "vendor",
  "description",
  "amount",
  "transaction_type",
  "status",
  "category",
];

function safeCsvDownloadBasename(raw: string | null | undefined, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  let s = raw.replace(/[\r\n\0\x1f\x7f]/g, "").trim().slice(0, 120);
  s = s.replace(/[/\\:*?"<>|;]/g, "-");
  s = s.replace(/^\.+/u, "").trim();
  if (s.toLowerCase().endsWith(".csv")) s = s.slice(0, -4).trim();
  if (!s) return fallback;
  return s;
}

type ExportOptions = {
  exportCols: string[];
  dateFrom: string | null;
  dateTo: string | null;
  status: string | null;
  txType: string | null;
  searchTerm: string;
  sortBy: string;
  sortAsc: boolean;
  source: string | null;
  dataSourceId: string | null;
  columnFilters: ActivityColumnFilterRow[];
  downloadBasename: string | null;
};

function needsMemberDisplayMap(
  exportCols: string[],
  defsById: Map<string, TransactionPropertyDefinition>
): boolean {
  for (const c of exportCols) {
    if (!isUuidColumnKey(c)) continue;
    const d = defsById.get(c);
    if (d?.type === "org_user" || d?.type === "created_by") return true;
  }
  return false;
}

async function loadMemberDisplayById(supabase: any, orgId: string): Promise<Record<string, string>> {
  const { data: rows, error } = await supabase
    .from("org_memberships")
    .select("user_id")
    .eq("org_id", orgId);
  if (error || !rows?.length) return {};
  const userIds = [...new Set(rows.map((r: { user_id: string }) => r.user_id))];
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .in("id", userIds);
  if (pErr || !profiles) return {};
  const out: Record<string, string> = {};
  for (const p of profiles as { id: string; email?: string | null; display_name?: string | null }[]) {
    out[p.id] = p.display_name?.trim() || p.email?.trim() || p.id.slice(0, 8);
  }
  return out;
}

async function csvExportResponse(supabase: any, userId: string, opt: ExportOptions): Promise<NextResponse> {
  const {
    exportCols: exportColsRaw,
    dateFrom,
    dateTo,
    status,
    txType,
    searchTerm,
    sortBy,
    sortAsc,
    source,
    dataSourceId,
    columnFilters,
    downloadBasename,
  } = opt;

  const exportCols = exportColsRaw.length > 0 ? exportColsRaw : DEFAULT_EXPORT_COLUMNS;

  let orgId: string | null = await getActiveOrgId(supabase as any, userId);
  if (!orgId) {
    try {
      orgId = await ensureActiveOrgForUser(userId);
    } catch {
      orgId = null;
    }
  }

  const defsById = new Map<string, TransactionPropertyDefinition>();
  if (orgId) {
    const { data: defs } = await (supabase as any)
      .from("transaction_property_definitions")
      .select("id,name,type,config,position")
      .eq("org_id", orgId);
    for (const row of defs ?? []) {
      if (row?.id && typeof row.name === "string" && typeof row.type === "string") {
        defsById.set(row.id, {
          id: row.id,
          name: row.name,
          type: row.type,
          config: row.config && typeof row.config === "object" ? row.config : null,
          position: typeof row.position === "number" ? row.position : 0,
        });
      }
    }
  }

  const memberDisplayById =
    orgId && needsMemberDisplayMap(exportCols, defsById)
      ? await loadMemberDisplayById(supabase as any, orgId)
      : {};

  const selectList = buildDbSelectParts(exportCols, defsById);
  const cols = selectList.join(",");

  const orgTypes = new Map<string, string>();
  for (const d of defsById.values()) orgTypes.set(d.id, d.type);
  if (
    columnFilters.length > 0 &&
    columnFilters.some((f) => !STANDARD_FILTERABLE_COLS.has(f.column)) &&
    orgTypes.size === 0 &&
    orgId
  ) {
    const { data: defs } = await (supabase as any)
      .from("transaction_property_definitions")
      .select("id,type")
      .eq("org_id", orgId);
    for (const row of defs ?? []) {
      if (row?.id && typeof row.type === "string") orgTypes.set(row.id, row.type);
    }
  }

  const headerCells = headerLabelsForExport(exportCols, defsById).map(csvEscapeCell);
  const headerLine = `${headerCells.join(",")}\n`;

  const buildPageQuery = (from: number, to: number) => {
    let q = (supabase as any)
      .from("transactions")
      .select(cols)
      .eq("user_id", userId)
      .order(sortBy, { ascending: sortAsc })
      .range(from, to);

    if (dateFrom) q = q.gte("date", dateFrom);
    if (dateTo) q = q.lte("date", dateTo);
    if (status) q = q.eq("status", status);
    if (txType) q = q.eq("transaction_type", txType);
    if (source) q = q.eq("source", source);
    if (dataSourceId) q = q.eq("data_source_id", dataSourceId);
    if (searchTerm.length > 0) {
      const pattern = `%${searchTerm}%`;
      q = q.or(`vendor.ilike.${pattern},description.ilike.${pattern}`);
    }
    if (columnFilters.length > 0) {
      q = applyActivityColumnFilters(q, columnFilters, orgTypes);
    }
    return q;
  };

  async function* csvChunks(): AsyncGenerator<string, void, void> {
    let offset = 0;
    let wroteHeader = false;

    while (true) {
      const to = offset + CSV_PAGE_SIZE - 1;
      const { data: batch, error } = await buildPageQuery(offset, to);
      if (error) {
        throw new Error(safeErrorMessage(error.message, "Failed to load transactions"));
      }
      const rows = (batch ?? []) as Record<string, unknown>[];

      if (!wroteHeader) {
        yield `\uFEFF${headerLine}`;
        wroteHeader = true;
      }

      if (rows.length === 0) break;

      let chunk = "";
      for (const t of rows) {
        chunk += `${rowToCsvLine(t, exportCols, defsById, memberDisplayById)}\n`;
        if (chunk.length >= 256 * 1024) {
          yield chunk;
          chunk = "";
        }
      }
      if (chunk.length > 0) yield chunk;

      if (rows.length < CSV_PAGE_SIZE) break;
      offset += CSV_PAGE_SIZE;
    }
  }

  const fallbackStem = `activity-export-${dateFrom ?? "all"}-to-${dateTo ?? "all"}`;
  const fileStem = safeCsvDownloadBasename(downloadBasename, fallbackStem);
  const filename = `${fileStem}.csv`;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const s of csvChunks()) {
          controller.enqueue(encoder.encode(s));
        }
        controller.close();
      } catch (e) {
        controller.error(e instanceof Error ? e : new Error(String(e)));
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

async function authorizeAndExport(req: Request, buildOpts: () => ExportOptions): Promise<NextResponse> {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;
  const { success: rlOk } = await rateLimitForRequest(req, userId, expensiveOpLimit);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const supabase = authClient;
  return csvExportResponse(supabase, userId, buildOpts());
}

function parseSort(searchParams: URLSearchParams, body: Record<string, unknown> | null): { sortBy: string; sortAsc: boolean } {
  const sortByRaw =
    (body && typeof body.sort_by === "string" ? body.sort_by : null) ??
    (body && typeof body.sort === "string" ? body.sort : null) ??
    searchParams.get("sort_by") ??
    searchParams.get("sort");
  const sortBy =
    sortByRaw && (ACTIVITY_SORT_COLUMNS as readonly string[]).includes(sortByRaw) ? sortByRaw : "date";
  const sortOrderRaw =
    (body && typeof body.sort_order === "string" ? body.sort_order : null) ??
    (body && typeof body.order === "string" ? body.order : null) ??
    searchParams.get("sort_order") ??
    searchParams.get("order");
  const sortAsc = sortOrderRaw === "asc";
  return { sortBy, sortAsc };
}

/**
 * GET: Export (query string). Prefer POST for large `column_filters` / many columns.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format");
  if (format != null && format !== "" && format !== "csv") {
    return NextResponse.json({ error: "Only CSV export is supported" }, { status: 400 });
  }

  return authorizeAndExport(req, () => {
    const parsedCols = parseExportColumnsParam(searchParams.get("export_columns"));
    const exportCols = parsedCols.length > 0 ? parsedCols : DEFAULT_EXPORT_COLUMNS;

    const dateFrom = searchParams.get("date_from")?.trim() || null;
    const dateTo = searchParams.get("date_to")?.trim() || null;
    const status = searchParams.get("status");
    const txType = searchParams.get("transaction_type");
    const searchTerm = (searchParams.get("search") ?? searchParams.get("q"))?.trim() ?? "";
    const { sortBy, sortAsc } = parseSort(searchParams, null);
    const source = searchParams.get("source")?.trim() || null;
    const dataSourceIdRaw = searchParams.get("data_source_id");
    const dataSourceId =
      dataSourceIdRaw && uuidSchema.safeParse(dataSourceIdRaw).success ? dataSourceIdRaw : null;
    const columnFilters = parseColumnFiltersQueryParam(searchParams.get("column_filters"));

    return {
      exportCols,
      dateFrom,
      dateTo,
      status: status || null,
      txType: txType || null,
      searchTerm,
      sortBy,
      sortAsc,
      source,
      dataSourceId,
      columnFilters,
      downloadBasename: searchParams.get("download_basename")?.trim() || null,
    };
  });
}

/**
 * POST: Export with JSON body (avoids URL length limits for filters and column lists).
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const format = body.format;
  if (format != null && format !== "" && format !== "csv") {
    return NextResponse.json({ error: "Only CSV export is supported" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);

  return authorizeAndExport(req, () => {
    const parsedCols = parseExportColumnsInput(body.export_columns);
    const exportCols = parsedCols.length > 0 ? parsedCols : DEFAULT_EXPORT_COLUMNS;

    const dateFrom =
      (typeof body.date_from === "string" ? body.date_from.trim() : "") || searchParams.get("date_from")?.trim() || null;
    const dateTo =
      (typeof body.date_to === "string" ? body.date_to.trim() : "") || searchParams.get("date_to")?.trim() || null;
    const status =
      (typeof body.status === "string" ? body.status : null) ?? searchParams.get("status") ?? null;
    const txType =
      (typeof body.transaction_type === "string" ? body.transaction_type : null) ??
      searchParams.get("transaction_type") ??
      null;
    const searchTerm =
      (typeof body.search === "string" ? body.search.trim() : "") ||
      (typeof body.q === "string" ? body.q.trim() : "") ||
      (searchParams.get("search") ?? searchParams.get("q") ?? "").trim();
    const { sortBy, sortAsc } = parseSort(searchParams, body);
    const source =
      (typeof body.source === "string" ? body.source.trim() : null) || searchParams.get("source")?.trim() || null;
    const dsRaw =
      (typeof body.data_source_id === "string" ? body.data_source_id : null) ?? searchParams.get("data_source_id");
    const dataSourceId = dsRaw && uuidSchema.safeParse(dsRaw).success ? dsRaw : null;

    const columnFilters =
      body.column_filters !== undefined
        ? parseColumnFiltersJson(body.column_filters)
        : parseColumnFiltersQueryParam(searchParams.get("column_filters"));

    const rawBase =
      typeof body.download_basename === "string"
        ? body.download_basename.trim()
        : searchParams.get("download_basename")?.trim() || null;

    return {
      exportCols,
      dateFrom,
      dateTo,
      status,
      txType,
      searchTerm,
      sortBy,
      sortAsc,
      source,
      dataSourceId,
      columnFilters,
      downloadBasename: rawBase || null,
    };
  });
}
