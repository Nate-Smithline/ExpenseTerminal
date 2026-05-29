import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { planLineMove, sortBudgetLines } from "@/lib/budget/line-order";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

/**
 * PUT /api/budget/lines/reorder
 * Body: { line_id, to_group_id, to_index }
 * Reorders lines within a group or moves a line to another group of the same kind.
 */
export async function PUT(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const body = await req.json();
  const lineId = body.line_id as string | undefined;
  const toGroupId = body.to_group_id as string | undefined;
  const toIndex = body.to_index as number | undefined;

  if (!lineId || !toGroupId || typeof toIndex !== "number" || !Number.isFinite(toIndex)) {
    return NextResponse.json(
      { error: "line_id, to_group_id, and to_index are required" },
      { status: 400 }
    );
  }

  const db = supabase as Supa;

  const { data: lineRow, error: lineErr } = await db
    .from("budget_lines")
    .select("id, budget_group_id")
    .eq("id", lineId)
    .eq("user_id", userId)
    .single();

  if (lineErr || !lineRow) {
    return NextResponse.json({ error: "Line not found" }, { status: 404 });
  }

  const { data: sourceGroup, error: srcErr } = await db
    .from("budget_groups")
    .select("id, kind, budget_month_id")
    .eq("id", lineRow.budget_group_id)
    .eq("user_id", userId)
    .single();

  if (srcErr || !sourceGroup) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const { data: groups, error: groupsErr } = await db
    .from("budget_groups")
    .select("id, kind, budget_lines(id, position)")
    .eq("budget_month_id", sourceGroup.budget_month_id)
    .eq("user_id", userId);

  if (groupsErr) {
    return NextResponse.json({ error: groupsErr.message }, { status: 500 });
  }

  const normalized = (groups ?? []).map(
    (g: { id: string; kind?: string; budget_lines?: { id: string; position: number }[] }) => ({
      id: g.id,
      kind: g.kind ?? "expense",
      budget_lines: sortBudgetLines(g.budget_lines ?? []),
    })
  );

  const { updates, error: planError } = planLineMove(
    normalized,
    lineId,
    toGroupId,
    Math.round(toIndex)
  );
  if (planError) {
    return NextResponse.json({ error: planError }, { status: 400 });
  }

  for (const u of updates) {
    const { error } = await db
      .from("budget_lines")
      .update({ budget_group_id: u.budget_group_id, position: u.position })
      .eq("id", u.id)
      .eq("user_id", userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, updates });
}
