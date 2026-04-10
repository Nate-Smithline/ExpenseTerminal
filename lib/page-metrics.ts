import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";
import { applyPageActivityViewSavedFiltersToQuery } from "@/lib/page-activity-view-filters";
import { fetchPaginatedTxAmountRows } from "@/lib/dashboard-metrics";

type TxRow = { amount: string; transaction_type: string };

function absAmount(s: string): number {
  return Math.abs(Number(s) || 0);
}

async function resolveOrgId(supabase: any, userId: string): Promise<string | null> {
  let orgId = await getActiveOrgId(supabase as any, userId);
  if (!orgId) {
    try {
      orgId = await ensureActiveOrgForUser(userId);
    } catch {
      orgId = null;
    }
  }
  return orgId;
}

export type PageComparisonMetricRow = {
  id: string;
  title: string;
  income: number;
  spend: number;
  profit: number;
};

type PageRow = { id: string; title: string; position?: number | null };

type PageSettingsRow = {
  page_id: string;
  filters: any;
};

export async function computePageComparisonMetrics(params: {
  supabase: any;
  userId: string;
  dateFrom: string;
  dateTo: string;
  limit?: number;
}): Promise<PageComparisonMetricRow[]> {
  const { supabase, userId, dateFrom, dateTo, limit = 6 } = params;
  const orgId = await resolveOrgId(supabase, userId);
  if (!orgId) return [];

  const { data: pages } = await (supabase as any)
    .from("pages")
    .select("id,title,position")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("position", { ascending: true })
    .limit(limit);

  const pageRows = (pages ?? []) as PageRow[];
  if (pageRows.length === 0) return [];

  // Fetch org property definitions for custom column filter kinds.
  const { data: defs } = await (supabase as any)
    .from("transaction_property_definitions")
    .select("id,type")
    .eq("org_id", orgId);
  const orgTypes = new Map<string, string>();
  for (const row of defs ?? []) {
    if (row?.id && typeof row.type === "string") orgTypes.set(row.id as string, row.type);
  }

  const results: PageComparisonMetricRow[] = [];

  for (const p of pageRows) {
    const { data: settings } = await (supabase as any)
      .from("page_activity_view_settings")
      .select("page_id,filters")
      .eq("page_id", p.id)
      .maybeSingle();

    const s = (settings ?? null) as PageSettingsRow | null;
    const filters =
      s?.filters && typeof s.filters === "object" ? (s.filters as Record<string, unknown>) : {};

    const rows = await fetchPaginatedTxAmountRows(supabase as any, (q: any) =>
      applyPageActivityViewSavedFiltersToQuery(q, {
        userId,
        dateFrom,
        dateTo,
        filters,
        orgTypes,
      }),
    );
    const income = rows.reduce((sum, r) => (r.transaction_type === "income" ? sum + absAmount(r.amount) : sum), 0);
    const spend = rows.reduce((sum, r) => (r.transaction_type === "expense" ? sum + absAmount(r.amount) : sum), 0);
    results.push({
      id: p.id,
      title: (p.title ?? "").trim() || "Untitled",
      income,
      spend,
      profit: income - spend,
    });
  }

  return results;
}

