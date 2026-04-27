import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { isValidEmail } from "@/lib/validation/email";
import { hashToken, isSixDigitOtp } from "@/lib/verification-tokens";
import { rateLimitByIdentifier, emailVerificationLimit } from "@/lib/middleware/rate-limit";
import { sendWelcomeEmailForUser } from "@/lib/email/send-welcome";

type VerifyPassphraseBody = {
  email?: string;
  passphrase?: string;
  /** Preferred: 6-digit email OTP */
  code?: string;
};

/**
 * POST /api/auth/verify-passphrase
 * Body: { email, code } or { email, passphrase }
 * Validates a 6-digit OTP (or legacy passphrase) from the verification email,
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
  const rawCode = (body.code ?? body.passphrase)?.trim() ?? "";
  const passphrase = isSixDigitOtp(rawCode)
    ? rawCode
    : rawCode.toLowerCase().replace(/\s+/g, "-");

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

  // Resolve user ID for this email. Prefer profiles (for existing installs),
  // but fall back to Supabase Auth if needed, using case-insensitive match.
  let userId: string | null = null;

  const { data: profile, error: profileError } = await (supabase as any)
    .from("profiles")
    .select("id, email")
    .ilike("email", email)
    .maybeSingle();

  if (profileError) {
    console.error("verify-passphrase: failed to look up profile by email", {
      email,
      error: profileError,
    });
  }

  if (profile?.id) {
    userId = profile.id as string;
  }

  if (!userId) {
    try {
      const { data: authUser, error: authError } = await (supabase as any)
        .from("auth.users")
        .select("id, email")
        .ilike("email", email)
        .maybeSingle();

      if (authError) {
        console.error("verify-passphrase: failed to query auth.users", {
          email,
          error: authError,
        });
      } else if (authUser?.id) {
        userId = authUser.id as string;
      }
    } catch (authErr) {
      console.error("verify-passphrase: unexpected error querying auth.users", {
        email,
        error: authErr,
      });
    }
  }

  if (!userId) {
    // Do not reveal whether the email exists.
    return NextResponse.json({ error: "Invalid code or email." }, { status: 400 });
  }
  const tokenHash = hashToken(passphrase);

  const { data: verification, error } = await (supabase as any)
    .from("email_verifications")
    .select("*")
    .eq("user_id", userId)
    .eq("token_hash", tokenHash)
    .is("verified_at", null)
    .maybeSingle();

  if (error || !verification) {
    if (process.env.NODE_ENV === "development") {
      console.error("verify-passphrase: no matching verification row", {
        email,
        userId,
        error,
      });
    }
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

  // Best-effort: ensure profiles.email is populated from auth.users so
  // any logic that depends on profiles.email can rely on it.
  try {
    const { data: authUser, error: authError } =
      await (supabase as any).auth.admin.getUserById(userId);
    if (authError) {
      console.error("verify-passphrase: failed to load auth user for profile sync", {
        userId,
        error: authError,
      });
    } else if (authUser?.user?.email) {
      await (supabase as any)
        .from("profiles")
        .upsert(
          {
            id: userId,
            email: authUser.user.email,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
    }
  } catch (profileErr) {
    console.error("verify-passphrase: failed to sync profiles.email from auth.users", {
      userId,
      error: profileErr,
    });
  }

  try {
    await sendWelcomeEmailForUser(userId);
  } catch (err) {
    console.error("Failed to send welcome email after passphrase verification:", err);
  }

  return NextResponse.json({ ok: true });
}

