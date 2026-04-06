import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, expensiveOpLimit } from "@/lib/middleware/rate-limit";
import { ACTIVITY_SORT_COLUMNS, ACTIVITY_FILTERABLE_STANDARD_COLUMNS, uuidSchema } from "@/lib/validation/schemas";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";
import { applyActivityColumnFilters, parseColumnFiltersQueryParam } from "@/lib/activity-column-filters";

const STANDARD_FILTERABLE_COLS = new Set<string>(ACTIVITY_FILTERABLE_STANDARD_COLUMNS);

const CSV_PAGE_SIZE = 2000;

const CSV_HEADERS = [
  "Date",
  "Vendor",
  "Description",
  "Amount",
  "Type",
  "Status",
  "Category",
  "Schedule C Line",
  "Business Purpose",
  "Notes",
] as const;

function csvEscapeCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function rowToCsvLine(t: Record<string, unknown>): string {
  return [
    t.date ?? "",
    t.vendor ?? "",
    t.description ?? "",
    t.amount ?? "",
    t.transaction_type ?? "",
    t.status ?? "",
    t.category ?? "",
    t.schedule_c_line ?? "",
    t.business_purpose ?? "",
    t.notes ?? "",
  ]
    .map(csvEscapeCell)
    .join(",");
}

/**
 * GET: Export activity transactions as CSV (same filters as the activity table).
 * Paginates past Supabase row limits; streams the response.
 */
export async function GET(req: Request) {
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

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format");
  if (format != null && format !== "" && format !== "csv") {
    return NextResponse.json({ error: "Only CSV export is supported" }, { status: 400 });
  }

  const dateFrom = searchParams.get("date_from")?.trim() || null;
  const dateTo = searchParams.get("date_to")?.trim() || null;
  const status = searchParams.get("status");
  const txType = searchParams.get("transaction_type");
  const searchTerm = (searchParams.get("search") ?? searchParams.get("q"))?.trim() ?? "";
  const sortByRaw = searchParams.get("sort_by") ?? searchParams.get("sort");
  const sortBy = sortByRaw && (ACTIVITY_SORT_COLUMNS as readonly string[]).includes(sortByRaw) ? sortByRaw : "date";
  const sortOrderRaw = searchParams.get("sort_order") ?? searchParams.get("order");
  const sortAsc = sortOrderRaw === "asc";
  const source = searchParams.get("source")?.trim() || null;
  const dataSourceIdRaw = searchParams.get("data_source_id");
  const dataSourceId =
    dataSourceIdRaw && uuidSchema.safeParse(dataSourceIdRaw).success ? dataSourceIdRaw : null;
  const columnFilters = parseColumnFiltersQueryParam(searchParams.get("column_filters"));

  const cols = "date,vendor,description,amount,transaction_type,status,category,schedule_c_line,business_purpose,notes";

  let orgTypes = new Map<string, string>();
  if (columnFilters.length > 0) {
    const needsOrgDefs = columnFilters.some((f) => !STANDARD_FILTERABLE_COLS.has(f.column));
    if (needsOrgDefs) {
      let orgId = await getActiveOrgId(supabase as any, userId);
      if (!orgId) {
        try {
          orgId = await ensureActiveOrgForUser(userId);
        } catch {
          orgId = null;
        }
      }
      if (orgId) {
        const { data: defs } = await (supabase as any)
          .from("transaction_property_definitions")
          .select("id,type")
          .eq("org_id", orgId);
        for (const row of defs ?? []) {
          if (row?.id && typeof row.type === "string") orgTypes.set(row.id, row.type);
        }
      }
    }
  }

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
        yield `\uFEFF${CSV_HEADERS.join(",")}\n`;
        wroteHeader = true;
      }

      if (rows.length === 0) break;

      let chunk = "";
      for (const t of rows) {
        chunk += `${rowToCsvLine(t)}\n`;
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

  const filename = `activity-export-${dateFrom ?? "all"}-to-${dateTo ?? "all"}.csv`;
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
