import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { transactionUpdateBodySchema } from "@/lib/validation/schemas";
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

  const { id, quick_label, business_purpose, notes, status, deduction_percent, category, schedule_c_line } = parsed.data;

  const { error } = await (supabase as any)
    .from("transactions")
    .update({
      ...(quick_label !== undefined && { quick_label }),
      ...(business_purpose !== undefined && { business_purpose }),
      ...(notes !== undefined && { notes }),
      ...(status !== undefined && { status }),
      ...(deduction_percent !== undefined && { deduction_percent }),
      ...(category !== undefined && { category }),
      ...(schedule_c_line !== undefined && { schedule_c_line }),
      updated_at: new Date().toISOString(),
    })
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
