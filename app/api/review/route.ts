import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

// review_items table is new — not in generated Database types yet.
// Cast supabase to any for these queries until the migration runs.
/* eslint-disable @typescript-eslint/no-explicit-any */

// GET /api/review — list review items for current user
// ?count_only=true → returns { count: number } (used by sidebar badge)
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const countOnly = req.nextUrl.searchParams.get("count_only") === "true";

  if (countOnly) {
    const { count, error } = await (supabase as any)
      .from("review_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("done", false)
      .eq("dismissed", false);

    if (error) {
      // Table may not exist yet — return 0 gracefully
      return NextResponse.json({ count: 0 });
    }

    return NextResponse.json({ count: count ?? 0 });
  }

  const { data, error } = await (supabase as any)
    .from("review_items")
    .select("*")
    .eq("user_id", user.id)
    .eq("dismissed", false)
    .order("urgency", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ items: [] });
  }

  return NextResponse.json({ items: data ?? [] });
}

// PUT /api/review/[id] — mark done or dismiss
// Body: { done?: boolean, dismissed?: boolean }
export async function PUT(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, done, dismissed } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (typeof done === "boolean") {
    update.done = done;
    if (done) update.done_at = new Date().toISOString();
  }
  if (typeof dismissed === "boolean") update.dismissed = dismissed;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("review_items")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
