import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

/** POST /api/budget/lines — add a line to a group */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const { budget_group_id, name, allocated, position = 0 } = await req.json();
  if (!budget_group_id || !name) {
    return NextResponse.json({ error: "budget_group_id and name required" }, { status: 400 });
  }

  const db = supabase as Supa;

  // Verify ownership via group
  const { data: g } = await db
    .from("budget_groups")
    .select("id")
    .eq("id", budget_group_id)
    .eq("user_id", userId)
    .single();
  if (!g) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const { data, error } = await db
    .from("budget_lines")
    .insert({ user_id: userId, budget_group_id, name, allocated: allocated ?? null, position })
    .select("id, name, allocated, rolled_over, position")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ line: data });
}

/** PUT /api/budget/lines — update name, allocated amount, or position */
export async function PUT(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const { id, name, allocated, position, notes, default_marker, default_business_pct } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (allocated !== undefined) update.allocated = allocated; // null = unbudgeted
  if (position !== undefined) update.position = position;
  if (notes !== undefined) update.notes = notes || null;
  if (default_marker !== undefined) update.default_marker = default_marker || null;
  if (default_business_pct !== undefined) update.default_business_pct = default_business_pct;

  const db = supabase as Supa;
  const { error } = await db
    .from("budget_lines")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/budget/lines — remove a line (cascades assignments) */
export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = supabase as Supa;
  const { error } = await db
    .from("budget_lines")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
