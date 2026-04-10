import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { hashToken } from "@/lib/verification-tokens";
import { sendWelcomeEmailForUser } from "@/lib/email/send-welcome";

/**
 * GET /auth/verify?token=ark-the-olive-dove
 * Validates the Bible-word token, marks the email as verified,
 * and redirects into the app.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenParam = searchParams.get("token");
  const token = tokenParam
    ? tokenParam.toLowerCase().trim().replace(/\s+/g, "-")
    : null;

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

  // Best-effort: ensure profiles.email is populated from auth.users so
  // any logic that depends on profiles.email can rely on it.
  try {
    const { data: authUser, error: authError } =
      await (supabase as any).auth.admin.getUserById(verification.user_id);
    if (authError) {
      console.error("verify: failed to load auth user for profile sync", {
        userId: verification.user_id,
        error: authError,
      });
    } else if (authUser?.user?.email) {
      await (supabase as any)
        .from("profiles")
        .upsert(
          {
            id: verification.user_id,
            email: authUser.user.email,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
    }
  } catch (profileErr) {
    console.error("verify: failed to sync profiles.email from auth.users", {
      userId: verification.user_id,
      error: profileErr,
    });
  }

  // Best-effort welcome email with product + pricing.
  try {
    await sendWelcomeEmailForUser(verification.user_id as string);
  } catch (err) {
    console.error("Failed to send welcome email after verification:", err);
  }

  return NextResponse.redirect(new URL("/login?verified=true", origin));
}
