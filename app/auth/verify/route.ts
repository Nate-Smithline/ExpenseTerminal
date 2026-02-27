import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { hashToken } from "@/lib/verification-tokens";
import { sendWelcomeEmailForUser } from "@/lib/email/send-welcome";

/**
 * GET /auth/verify?token=ark-the-olive-dove
 * Validates the Bible-word token, marks the email as verified,
 * and redirects to the inbox.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid-token", origin));
  }

  const tokenHash = hashToken(token);
  const supabase = createSupabaseServiceClient();

  const { data: verification, error } = await (supabase as any)
    .from("email_verifications")
    .select("*")
    .eq("token_hash", tokenHash)
    .is("verified_at", null)
    .single();

  if (error || !verification) {
    return NextResponse.redirect(
      new URL("/login?error=invalid-token", origin)
    );
  }

  if (new Date(verification.expires_at) < new Date()) {
    return NextResponse.redirect(
      new URL("/login?error=token-expired", origin)
    );
  }

  // Mark as verified
  await (supabase as any)
    .from("email_verifications")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", verification.id);

  // Update the user's profile to mark email as confirmed
  await (supabase as any).auth.admin.updateUserById(verification.user_id, {
    email_confirm: true,
  });

  // Best-effort welcome email with product + pricing.
  try {
    await sendWelcomeEmailForUser(verification.user_id as string);
  } catch (err) {
    console.error("Failed to send welcome email after verification:", err);
  }

  return NextResponse.redirect(new URL("/login?verified=true", origin));
}
