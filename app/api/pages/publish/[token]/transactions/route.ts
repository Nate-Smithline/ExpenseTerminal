/* eslint-disable @typescript-eslint/no-explicit-any -- service client */
import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { rateLimitByIp, publishedPageApiLimit } from "@/lib/middleware/rate-limit";
import { fetchPublishedPageBundle } from "@/lib/published-page-resolve";
import { parseQueryLimit, parseQueryOffset, ACTIVITY_SORT_COLUMNS } from "@/lib/validation/schemas";
import { normalizeVendor } from "@/lib/vendor-matching";
import { safeErrorMessage } from "@/lib/api/safe-error";

function sanitizePublicRow(row: Record<string, unknown>, orgUserPropertyIds: Set<string>) {
  const { user_id: _u, auto_sort_rule_id: _a, custom_fields: cfRaw, ...rest } = row;
  let custom_fields: unknown = cfRaw;
  if (
    orgUserPropertyIds.size > 0 &&
    cfRaw &&
    typeof cfRaw === "object" &&
    !Array.isArray(cfRaw)
  ) {
    const cf = { ...(cfRaw as Record<string, unknown>) };
    for (const id of orgUserPropertyIds) {
      delete cf[id];
    }
    custom_fields = cf;
  }
  return { ...rest, custom_fields };
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const rl = await rateLimitByIp(req, publishedPageApiLimit);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { token } = await ctx.params;
    const svc = createSupabaseServiceClient();
    const bundle = await fetchPublishedPageBundle(svc, token);
    if (!bundle) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const orgUserPropertyIds = new Set<string>();
    if (bundle.orgId) {
      const { data: defs } = await (svc as any)
        .from("transaction_property_definitions")
        .select("id,type")
        .eq("org_id", bundle.orgId);
      for (const d of defs ?? []) {
        if (d?.type === "org_user" && typeof d.id === "string") orgUserPropertyIds.add(d.id);
      }
    }

    const { searchParams } = new URL(req.url);
    const limit = parseQueryLimit(searchParams.get("limit"));
    const offset = parseQueryOffset(searchParams.get("offset"));
    const countOnly = searchParams.get("count_only") === "true";
    const sortByRaw = searchParams.get("sort_by") ?? searchParams.get("sort");
    const view = bundle.view;
    const sortBy =
      sortByRaw && (ACTIVITY_SORT_COLUMNS as readonly string[]).includes(sortByRaw)
        ? sortByRaw
        : view.sort_column;
    const sortOrderRaw = searchParams.get("sort_order") ?? searchParams.get("order");
    const sortAsc =
      sortOrderRaw === "asc" || sortOrderRaw === "desc" ? sortOrderRaw === "asc" : view.sort_asc;

    const f = view.filters;
    const status = searchParams.get("status") ?? f.status ?? undefined;
    const txType = searchParams.get("transaction_type") ?? f.transaction_type ?? undefined;
    const dateFrom = searchParams.get("date_from")?.trim() || f.date_from || null;
    const dateTo = searchParams.get("date_to")?.trim() || f.date_to || null;
    const source = searchParams.get("source")?.trim() || f.source || null;
    const dataSourceId = searchParams.get("data_source_id")?.trim() || f.data_source_id || null;
    const searchTerm =
      (searchParams.get("search") ?? searchParams.get("q"))?.trim() || f.search || "";
    const vendorNormalized = searchParams.get("vendor_normalized")?.trim() || null;

    const transactionColumns =
      "id,user_id,date,vendor,description,amount,category,schedule_c_line,ai_confidence,ai_reasoning,ai_suggestions,status,business_purpose,quick_label,notes,vendor_normalized,auto_sort_rule_id,deduction_percent,is_meal,is_travel,tax_year,source,transaction_type,data_source_id,created_at,updated_at,custom_fields";

    let query = (svc as any)
      .from("transactions")
      .select(countOnly ? "*" : transactionColumns, countOnly ? { count: "exact", head: true } : { count: "exact" })
      .eq("user_id", bundle.ownerUserId);

    if (dateFrom) query = query.gte("date", dateFrom);
    if (dateTo) query = query.lte("date", dateTo);
    if (status) query = query.eq("status", status);
    if (txType) query = query.eq("transaction_type", txType);
    if (source) query = query.eq("source", source);
    if (dataSourceId) query = query.eq("data_source_id", dataSourceId);
    if (vendorNormalized) {
      query = query.or(`vendor_normalized.eq.${vendorNormalized},vendor_normalized.is.null`);
    }
    if (searchTerm.length > 0) {
      const pattern = `%${searchTerm}%`;
      query = query.or(`vendor.ilike.${pattern},description.ilike.${pattern}`);
    }

    if (!countOnly) {
      query = query.order(sortBy, { ascending: sortAsc }).range(offset, offset + limit - 1);
    }

    if (countOnly) {
      const { count, error } = await query;
      if (error) {
        return NextResponse.json(
          { error: safeErrorMessage(error.message, "Failed to count") },
          { status: 500 }
        );
      }
      return NextResponse.json({ count: count ?? 0 });
    }

    let { data, error, count } = await query;
    if (error) {
      return NextResponse.json(
        { error: safeErrorMessage(error.message, "Failed to load transactions") },
        { status: 500 }
      );
    }

    if (vendorNormalized && Array.isArray(data)) {
      data = data.filter(
        (row: { vendor?: string | null; vendor_normalized?: string | null }) =>
          row.vendor_normalized === vendorNormalized ||
          (row.vendor_normalized == null &&
            row.vendor != null &&
            normalizeVendor(String(row.vendor)) === vendorNormalized)
      );
      if (count != null) count = data.length;
    }

    const rows = (data ?? []).map((r: Record<string, unknown>) =>
      sanitizePublicRow(r, orgUserPropertyIds)
    );
    return NextResponse.json({ data: rows, count });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load transactions" },
      { status: 500 }
    );
  }
}
