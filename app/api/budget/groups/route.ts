import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

/** POST /api/budget/groups — create a group in a budget month */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const { budget_month_id, name, position = 0, kind } = await req.json();
  if (!budget_month_id || !name) {
    return NextResponse.json({ error: "budget_month_id and name required" }, { status: 400 });
  }

  const db = supabase as Supa;

  // Verify the month belongs to this user
  const { data: bm } = await db
    .from("budget_months")
    .select("id")
    .eq("id", budget_month_id)
    .eq("user_id", userId)
    .single();
  if (!bm) return NextResponse.json({ error: "Budget month not found" }, { status: 404 });

  const groupKind = kind === "income" ? "income" : "expense";
  const { data, error } = await db
    .from("budget_groups")
    .insert({ user_id: userId, budget_month_id, name, position, kind: groupKind })
    .select("id, name, position, kind")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ group: data });
}

/** PUT /api/budget/groups — rename or reposition a group */
export async function PUT(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const { id, name, position, kind } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (position !== undefined) update.position = position;
  if (kind !== undefined) update.kind = kind === "income" ? "income" : "expense";

  const db = supabase as Supa;
  const { error } = await db
    .from("budget_groups")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/budget/groups — delete a group (cascades lines + assignments) */
export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = supabase as Supa;
  const { error } = await db
    .from("budget_groups")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
