import { NextResponse } from "next/server";
import { createSupabaseRouteClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { isValidEmail } from "@/lib/validation/email";
import { safeErrorMessage } from "@/lib/api/safe-error";

/**
 * POST /api/profile/email
 * Body: { email: string }
 * Starts Supabase email change (confirmation sent to the new address).
 */
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

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const { data: authUser } = await authClient.auth.getUser();
  const current = authUser.user?.email?.trim().toLowerCase();
  if (current === email) {
    return NextResponse.json({ error: "That is already your email address" }, { status: 400 });
  }

  const { error } = await authClient.auth.updateUser({ email });
  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Could not update email") },
      { status: 400 }
    );
  }

  // Keep profiles in sync for apps that read profiles.email (confirmed after user clicks link)
  try {
    const service = createSupabaseServiceClient();
    await (service as any)
      .from("profiles")
      .upsert(
        { id: userId, email, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
  } catch {
    // Non-fatal; auth email is source of truth until confirmed
  }

  return NextResponse.json({
    ok: true,
    message: "Check your inbox at the new address to confirm the change.",
  });
}
