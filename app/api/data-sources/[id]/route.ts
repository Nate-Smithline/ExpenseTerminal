import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { deleteDataSourceForUser } from "@/lib/data-sources/delete-data-source";

const ALLOWED_FIELDS = ["pull_transactions", "is_tax_fund", "is_mixed_account", "name", "account_type"] as const;

/**
 * PATCH /api/data-sources/[id]
 * Body: partial object of allowed fields to update.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json();
  const update: Record<string, unknown> = {};

  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      update[field as string] = body[field];
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  update.updated_at = new Date().toISOString();

  const { error } = await (supabase as any)
    .from("data_sources")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/data-sources/[id]
 * Removes a data source and all its transactions.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const result = await deleteDataSourceForUser(supabase, userId, id);
  if (!result.ok) {
    return NextResponse.json(
      { error: safeErrorMessage(result.error, "Failed to delete account") },
      { status: result.status }
    );
  }
  return NextResponse.json({ ok: true, transactionsDeleted: result.transactionsDeleted });
}
