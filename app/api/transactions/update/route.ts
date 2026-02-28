import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { transactionUpdateBodySchema } from "@/lib/validation/schemas";
import { normalizeVendor } from "@/lib/vendor-matching";
import { safeErrorMessage } from "@/lib/api/safe-error";

export async function POST(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;
  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const supabase = authClient;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = transactionUpdateBodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "Invalid request body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { id, quick_label, business_purpose, notes, status, deduction_percent, category, schedule_c_line, date, vendor, amount, description, transaction_type } = parsed.data;

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (quick_label !== undefined) updatePayload.quick_label = quick_label;
  if (business_purpose !== undefined) updatePayload.business_purpose = business_purpose;
  if (notes !== undefined) updatePayload.notes = notes;
  if (status !== undefined) updatePayload.status = status;
  if (deduction_percent !== undefined) updatePayload.deduction_percent = deduction_percent;
  if (category !== undefined) updatePayload.category = category;
  if (schedule_c_line !== undefined) updatePayload.schedule_c_line = schedule_c_line;
  if (date !== undefined) updatePayload.date = new Date(date).toISOString().slice(0, 10);
  if (vendor !== undefined) {
    updatePayload.vendor = vendor;
    updatePayload.vendor_normalized = vendor.trim() ? normalizeVendor(vendor) : null;
  }
  if (amount !== undefined) updatePayload.amount = amount;
  if (description !== undefined) updatePayload.description = description;
  if (transaction_type !== undefined) updatePayload.transaction_type = transaction_type;

  const { error } = await (supabase as any)
    .from("transactions")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to update transaction") },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
