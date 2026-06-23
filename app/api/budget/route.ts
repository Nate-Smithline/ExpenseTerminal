import { NextRequest, NextResponse } from "next/server";
import { sortBudgetGroups, sortBudgetLines } from "@/lib/budget/line-order";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

/**
 * GET /api/budget?month=YYYY-MM
 * Returns { month_id, groups: [...], stats: { income, spending, allocated } }
 */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const month = req.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month param required (YYYY-MM)" }, { status: 400 });
  }

  const db = supabase as Supa;

  // Get or return null for this month's budget record
  const { data: budgetMonth } = await db
    .from("budget_months")
    .select("id")
    .eq("user_id", userId)
    .eq("month_key", month)
    .maybeSingle();

  if (!budgetMonth) {
    return NextResponse.json({ month_id: null, groups: [], stats: await monthStats(db, userId, month) });
  }

  // Load groups + lines
  const { data: groups, error } = await db
    .from("budget_groups")
    .select(`
      id, name, position, kind,
      budget_lines (
        id, name, allocated, rolled_over, position, default_marker, default_business_pct,
        budget_line_transactions ( transaction_id )
      )
    `)
    .eq("budget_month_id", budgetMonth.id)
    .eq("user_id", userId)
    .order("position", { ascending: true })
    .order("position", { foreignTable: "budget_lines", ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const hydrated = await hydrateLineActuals(db, userId, month, groups ?? []);
  const hydratedGroups = sortBudgetGroups(
    hydrated as { position: number; budget_lines?: { id: string; position: number }[] }[]
  );

  return NextResponse.json({
    month_id: budgetMonth.id,
    groups: hydratedGroups,
    stats: await monthStats(db, userId, month),
  });
}

/** Sum assigned transaction amounts onto each budget line's `actual` field. */
async function hydrateLineActuals(
  db: Supa,
  userId: string,
  month: string,
  groups: {
    budget_lines?: {
      id: string;
      budget_line_transactions?: { transaction_id: string }[];
      actual?: number;
      [key: string]: unknown;
    }[];
    [key: string]: unknown;
  }[]
) {
  const lineIds: string[] = [];
  // Map each line to its group's direction so a transaction can be signed
  // relative to the line: one that matches the group's kind adds to the total,
  // while an opposite one (e.g. a refund dropped on an expense line) subtracts.
  const groupKindByLine = new Map<string, "income" | "expense">();
  for (const g of groups) {
    const kind = ((g as { kind?: "income" | "expense" }).kind ?? "expense");
    for (const line of g.budget_lines ?? []) {
      lineIds.push(line.id);
      groupKindByLine.set(line.id, kind);
    }
  }
  if (lineIds.length === 0) return groups;

  const startDate = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const endDate = new Date(y, m, 0).toISOString().slice(0, 10);

  const { data: links } = await db
    .from("budget_line_transactions")
    .select("budget_line_id, transaction_id")
    .eq("user_id", userId)
    .in("budget_line_id", lineIds);

  const txIds = [...new Set((links ?? []).map((l: { transaction_id: string }) => l.transaction_id))];
  const txById = new Map<string, { amount: number; type: string }>();

  if (txIds.length > 0) {
    const { data: txns } = await db
      .from("transactions")
      .select("id, amount, transaction_type")
      .eq("user_id", userId)
      .gte("date", startDate)
      .lte("date", endDate)
      .in("id", txIds);

    for (const t of txns ?? []) {
      txById.set(t.id, { amount: Math.abs(Number(t.amount)), type: t.transaction_type });
    }
  }

  const actualByLine = new Map<string, number>();
  for (const link of links ?? []) {
    const tx = txById.get(link.transaction_id);
    if (!tx) continue;
    const kind = groupKindByLine.get(link.budget_line_id) ?? "expense";
    const signed = tx.type === kind ? tx.amount : -tx.amount;
    actualByLine.set(
      link.budget_line_id,
      (actualByLine.get(link.budget_line_id) ?? 0) + signed
    );
  }

  return groups.map((g) => ({
    ...g,
    budget_lines: sortBudgetLines((g.budget_lines ?? []) as { id: string; position: number }[]).map((line) => ({
      ...line,
      actual: actualByLine.get(line.id) ?? 0,
    })),
  }));
}

/**
 * POST /api/budget
 * Body: { month: "YYYY-MM", action: "init" | "copy_last" }
 * Creates the budget_months row and optional default groups.
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const body = await req.json();
  const { month, action, source_month } = body as {
    month: string;
    action: "init" | "copy_last" | "copy_from" | "init_empty";
    source_month?: string;
  };

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month required (YYYY-MM)" }, { status: 400 });
  }

  const db = supabase as Supa;

  // Upsert budget_months row
  const { data: bm, error: bmErr } = await db
    .from("budget_months")
    .upsert({ user_id: userId, month_key: month }, { onConflict: "user_id,month_key" })
    .select("id")
    .single();

  if (bmErr) return NextResponse.json({ error: bmErr.message }, { status: 500 });

  // Replace existing groups when (re)initializing — not for init_empty (add-group flow)
  if (action === "init" || action === "copy_last" || action === "copy_from") {
    const { error: clearErr } = await db
      .from("budget_groups")
      .delete()
      .eq("budget_month_id", bm.id)
      .eq("user_id", userId);
    if (clearErr) return NextResponse.json({ error: clearErr.message }, { status: 500 });
  }

  let copied = false;
  let groupsCreated = 0;

  if (action === "copy_last" || action === "copy_from") {
    // Determine the source month key
    let sourceKey: string;
    if (action === "copy_from" && source_month && /^\d{4}-\d{2}$/.test(source_month)) {
      sourceKey = source_month;
    } else {
      // Fall back to previous calendar month
      const [y, m] = month.split("-").map(Number);
      const prevDate = new Date(y, m - 2);
      sourceKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    }

    const { data: sourceMonth } = await db
      .from("budget_months")
      .select("id")
      .eq("user_id", userId)
      .eq("month_key", sourceKey)
      .maybeSingle();

    if (sourceMonth) {
      const { data: prevGroups } = await db
        .from("budget_groups")
        .select("id, name, position, kind, budget_lines(name, allocated, rolled_over, position, default_marker, default_business_pct)")
        .eq("budget_month_id", sourceMonth.id)
        .eq("user_id", userId)
        .order("position");

      for (const pg of prevGroups ?? []) {
        const ng = await insertBudgetGroup(db, userId, bm.id, {
          name: pg.name,
          position: pg.position,
          kind: pg.kind === "income" ? "income" : "expense",
        });
        if (ng.error) return NextResponse.json({ error: ng.error }, { status: 500 });
        if (ng.id) {
          groupsCreated++;
          for (const pl of pg.budget_lines ?? []) {
            const { error: lineErr } = await db.from("budget_lines").insert({
              user_id: userId,
              budget_group_id: ng.id,
              name: pl.name,
              allocated: pl.allocated,
              rolled_over: 0,
              position: pl.position,
              default_marker: pl.default_marker ?? null,
              default_business_pct: pl.default_business_pct ?? null,
            });
            if (lineErr) return NextResponse.json({ error: lineErr.message }, { status: 500 });
          }
        }
      }
      copied = groupsCreated > 0;
    }
  } else if (action === "init") {
    const DEFAULT_GROUPS: { name: string; kind: "income" | "expense"; position: number }[] = [
      { name: "Income", kind: "income", position: 0 },
      { name: "Needs", kind: "expense", position: 1 },
      { name: "Wants", kind: "expense", position: 2 },
    ];

    for (const g of DEFAULT_GROUPS) {
      const ng = await insertBudgetGroup(db, userId, bm.id, g);
      if (ng.error) return NextResponse.json({ error: ng.error }, { status: 500 });
      if (ng.id) {
        groupsCreated++;
        for (let j = 0; j < 3; j++) {
          const { error: lineErr } = await db.from("budget_lines").insert({
            user_id: userId,
            budget_group_id: ng.id,
            name: "Untitled",
            position: j,
          });
          if (lineErr) return NextResponse.json({ error: lineErr.message }, { status: 500 });
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    month_id: bm.id,
    copied: (action === "copy_last" || action === "copy_from") ? copied : undefined,
    groups_created: groupsCreated,
  });
}

/** Insert a budget group; retries without `kind` if the column is not migrated yet. */
async function insertBudgetGroup(
  db: Supa,
  userId: string,
  budgetMonthId: string,
  g: { name: string; position: number; kind?: "income" | "expense" }
): Promise<{ id?: string; error?: string }> {
  const base = {
    user_id: userId,
    budget_month_id: budgetMonthId,
    name: g.name,
    position: g.position,
  };

  if (g.kind) {
    const { data, error } = await db
      .from("budget_groups")
      .insert({ ...base, kind: g.kind })
      .select("id")
      .single();
    if (!error && data) return { id: data.id };
    if (error && !/kind/i.test(error.message)) {
      return { error: error.message };
    }
  }

  const { data, error } = await db
    .from("budget_groups")
    .insert(base)
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: data?.id };
}

async function monthStats(db: Supa, userId: string, month: string) {
  // income and spending from transactions this month
  const startDate = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const endDate = new Date(y, m, 0).toISOString().slice(0, 10); // last day of month

  const { data: txns } = await db
    .from("transactions")
    .select("amount, transaction_type")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate);

  let income = 0;
  let spending = 0;
  for (const t of txns ?? []) {
    if (t.transaction_type === "income") income += Math.abs(t.amount);
    else spending += Math.abs(t.amount);
  }

  return { income, spending };
}
