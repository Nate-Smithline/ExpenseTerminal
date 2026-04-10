import { getActiveOrgId } from "@/lib/active-org";

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type PageComparisonRow = {
  pageId: string | null;
  title: string;
  expenses: number | null;
  income: number | null;
  transactionCount: number | null;
};

/**
 * Dashboard “pages” section: workspace-wide period totals plus recent pages (links).
 * Per-page transaction splits are not stored server-side yet; page rows show metrics as unavailable.
 */
export async function computePageComparisonMetrics(args: {
  supabase: unknown;
  userId: string;
  dateFrom: string;
  dateTo: string;
  limit: number;
}): Promise<PageComparisonRow[]> {
  const supabase = args.supabase as any;
  const { userId, dateFrom, dateTo, limit } = args;

  const { data: txs } = await supabase
    .from("transactions")
    .select("amount,transaction_type")
    .eq("user_id", userId)
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .neq("status", "personal");

  let totalExpenses = 0;
  let totalIncome = 0;
  let transactionCount = 0;
  for (const t of txs ?? []) {
    transactionCount += 1;
    const a = Math.abs(num((t as { amount?: unknown }).amount));
    if ((t as { transaction_type?: string | null }).transaction_type === "income") totalIncome += a;
    else totalExpenses += a;
  }

  const summaryRow: PageComparisonRow = {
    pageId: null,
    title: "All workspace activity",
    expenses: totalExpenses,
    income: totalIncome,
    transactionCount: transactionCount,
  };

  const orgId = await getActiveOrgId(supabase, userId);
  const pageLimit = Math.max(0, limit - 1);
  if (!orgId || pageLimit === 0) {
    return [summaryRow];
  }

  const { data: pages } = await supabase
    .from("pages")
    .select("id,title")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(pageLimit);

  const pageRows: PageComparisonRow[] = (pages ?? []).map((p: { id: string; title?: string | null }) => ({
    pageId: p.id,
    title: (p.title ?? "").trim() || "Untitled",
    expenses: null,
    income: null,
    transactionCount: null,
  }));

  return [summaryRow, ...pageRows];
}
