import { NextResponse } from "next/server";
import { rateLimitByIdentifier, passwordResetLimit } from "@/lib/middleware/rate-limit";
import { isValidEmail } from "@/lib/validation/email";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { createVerificationToken } from "@/lib/verification-tokens";
import { getResendClient, getFromAddress, RESEND_TIMEOUT_MS } from "@/lib/email/resend";
import { passwordResetEmailHtml, passwordResetEmailText } from "@/lib/email/templates/password-reset";
import { withRetry } from "@/lib/api/retry";
import crypto from "crypto";

/**
 * POST /api/auth/forgot-password
 * Validates and rate-limits reset requests, then sends a Resend email
 * with a one-time passphrase-style code the user can enter on the sign-in page.
 * Body: { email: string }
 */
export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const email = body.email?.trim();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  const { success } = await rateLimitByIdentifier(email, passwordResetLimit);
  if (!success) {
    return NextResponse.json(
      { error: "Too many reset attempts. Try again in an hour." },
      { status: 429 }
    );
  }

  const supabase = createSupabaseServiceClient();

  // Look up user by email (via profiles for consistent casing/duplicates handling).
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  // Always respond success even when no account exists for this email.
  if (!profile?.id) {
    return NextResponse.json({ ok: true });
  }

  const userId = profile.id as string;

  const { token, tokenHash, expiresAt } = createVerificationToken();

  // #region agent log
  fetch("http://127.0.0.1:7865/ingest/9d58918a-6794-4604-b799-6ec1d4d0bcb4", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "ec417b",
    },
    body: JSON.stringify({
      sessionId: "ec417b",
      runId: "reset-debug-1",
      hypothesisId: "H1",
      location: "app/api/auth/forgot-password/route.ts:afterCreateToken",
      message: "Created password reset token",
      data: {
        hasProfile: !!profile?.id,
        userIdPresent: Boolean(userId),
        expiresAt: expiresAt.toISOString(),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion agent log

  // Invalidate previous unused tokens for this user.
  await (supabase as any)
    .from("password_reset_tokens")
    .delete()
    .eq("user_id", userId)
    .is("used_at", null);

  await (supabase as any).from("password_reset_tokens").insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });

  // #region agent log
  fetch("http://127.0.0.1:7865/ingest/9d58918a-6794-4604-b799-6ec1d4d0bcb4", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "ec417b",
    },
    body: JSON.stringify({
      sessionId: "ec417b",
      runId: "reset-debug-1",
      hypothesisId: "H2",
      location: "app/api/auth/forgot-password/route.ts:afterInsert",
      message: "Inserted password reset token row",
      data: {
        userIdPresent: Boolean(userId),
        expiresAt: expiresAt.toISOString(),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion agent log

  const resend = getResendClient();
  const sendPromise = resend.emails.send({
    from: getFromAddress(),
    to: email,
    subject: "Reset your ExpenseTerminal password",
    html: passwordResetEmailHtml(token),
    text: passwordResetEmailText(token),
    headers: {
      "X-Entity-Ref-ID": crypto.randomUUID(),
    },
  });
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Email send timeout")), RESEND_TIMEOUT_MS)
  );

  try {
    await withRetry(() => Promise.race([sendPromise, timeoutPromise]), {
      maxRetries: 2,
      initialMs: 1000,
      maxMs: 10_000,
    });
  } catch (err) {
    console.error("Failed to send password reset email:", err);
    // Do not leak details to the client.
  }

  return NextResponse.json({ ok: true });
}

