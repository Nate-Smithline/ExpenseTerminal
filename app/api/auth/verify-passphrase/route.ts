import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { isValidEmail } from "@/lib/validation/email";
import { hashToken } from "@/lib/verification-tokens";
import { rateLimitByIdentifier, emailVerificationLimit } from "@/lib/middleware/rate-limit";
import { sendWelcomeEmailForUser } from "@/lib/email/send-welcome";

type VerifyPassphraseBody = {
  email?: string;
  passphrase?: string;
};

/**
 * POST /api/auth/verify-passphrase
 * Body: { email, passphrase }
 * Validates a Bible-word passphrase from the verification email,
 * marks the email as verified, updates the user to email_confirm=true,
 * and sends a welcome email.
 */
export async function POST(req: Request) {
  let body: VerifyPassphraseBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const passphrase = body.passphrase?.trim() ?? "";

  if (!email || !passphrase) {
    return NextResponse.json(
      { error: "Email and verification code are required." },
      { status: 400 }
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  const { success } = await rateLimitByIdentifier(email.toLowerCase(), emailVerificationLimit);
  if (!success) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later or resend the email." },
      { status: 429 }
    );
  }

  const supabase = createSupabaseServiceClient();

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (!profile?.id) {
    // Do not reveal whether the email exists.
    return NextResponse.json({ error: "Invalid code or email." }, { status: 400 });
  }

  const userId = profile.id as string;
  const tokenHash = hashToken(passphrase);

  const { data: verification, error } = await (supabase as any)
    .from("email_verifications")
    .select("*")
    .eq("user_id", userId)
    .eq("token_hash", tokenHash)
    .is("verified_at", null)
    .maybeSingle();

  if (error || !verification) {
    return NextResponse.json({ error: "Invalid code or email." }, { status: 400 });
  }

  if (new Date(verification.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "This code has expired. Please resend the verification email." },
      { status: 400 }
    );
  }

  await (supabase as any)
    .from("email_verifications")
    .update({ verified_at: new Date().toISOString() })
    .eq("id", verification.id);

  await (supabase as any).auth.admin.updateUserById(userId, {
    email_confirm: true,
  });

  try {
    await sendWelcomeEmailForUser(userId);
  } catch (err) {
    console.error("Failed to send welcome email after passphrase verification:", err);
  }

  return NextResponse.json({ ok: true });
}

