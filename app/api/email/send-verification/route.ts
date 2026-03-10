import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { createVerificationToken } from "@/lib/verification-tokens";
import { getResendClient, getFromAddress, RESEND_TIMEOUT_MS } from "@/lib/email/resend";
import {
  verificationEmailHtml,
  verificationEmailText,
} from "@/lib/email/templates/verification";
import { rateLimitByIp, emailVerificationLimit } from "@/lib/middleware/rate-limit";
import { withRetry } from "@/lib/api/retry";
import { isValidEmail } from "@/lib/validation/email";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    // In development, avoid rate-limiting email verification to make local testing easier.
    if (process.env.NODE_ENV !== "development") {
      const { success: rateLimitOk } = await rateLimitByIp(req, emailVerificationLimit);
      if (!rateLimitOk) {
        return NextResponse.json(
          { error: "Too many requests. Try again later." },
          { status: 429 }
        );
      }
    }

    const { email, userId } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();

    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const { data: profile, error: profileError } = await (supabase as any)
        .from("profiles")
        .select("id, email")
        .ilike("email", email)
        .maybeSingle();

      if (profileError) {
        console.error("send-verification: failed to look up profile by email", {
          email,
          error: profileError,
        });
      }

      resolvedUserId = profile?.id;
    }

    // Fallback: look up directly in auth.users by email (case-insensitive)
    if (!resolvedUserId) {
      try {
        const { data: authUser, error: authError } = await (supabase as any)
          .from("auth.users")
          .select("id, email")
          .ilike("email", email)
          .maybeSingle();

        if (authError) {
          console.error("send-verification: failed to query auth.users", {
            email,
            error: authError,
          });
        } else if (authUser?.id) {
          resolvedUserId = authUser.id as string;
        }
      } catch (authErr) {
        console.error("send-verification: unexpected error querying auth.users", {
          email,
          error: authErr,
        });
      }
    }

    if (!resolvedUserId) {
      const message =
        process.env.NODE_ENV === "development"
          ? "No user found for this email when trying to resend verification."
          : "If this email exists, a verification link has been sent.";
      // In dev, surface a clear 404-style error so issues are obvious; in prod, keep behavior non-enumerating.
      const status = process.env.NODE_ENV === "development" ? 404 : 200;
      return NextResponse.json({ ok: status === 200, error: message }, { status });
    }

    // Ensure a corresponding profile row exists for this user so that
    // downstream flows relying on public.profiles can function, even if
    // the database trigger hasn't run or was misconfigured.
    try {
      await (supabase as any)
        .from("profiles")
        .upsert(
          {
            id: resolvedUserId,
            email,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
    } catch (profileErr) {
      console.error("send-verification: failed to upsert profile", {
        email,
        userId: resolvedUserId,
        error: profileErr,
      });
      // Non-fatal; email verification can still proceed.
    }

    const { token, tokenHash, expiresAt } = createVerificationToken();

    await (supabase as any)
      .from("email_verifications")
      .delete()
      .eq("user_id", resolvedUserId)
      .is("verified_at", null);

    await (supabase as any).from("email_verifications").insert({
      user_id: resolvedUserId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/auth/verify?token=${token}`;

    const resend = getResendClient();
    const sendPromise = resend.emails.send({
      from: getFromAddress(),
      replyTo: "expenseterminal@outlook.com",
      to: email,
      subject: "Verify your ExpenseTerminal account",
      html: verificationEmailHtml(verifyUrl, token),
      text: verificationEmailText(verifyUrl, token),
      headers: {
        "X-Entity-Ref-ID": crypto.randomUUID(),
        "List-Unsubscribe": `<mailto:expenseterminal@outlook.com?subject=unsubscribe>`,
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
    } catch (sendErr) {
      console.error("send-verification: failed to send verification email", {
        email,
        userId: resolvedUserId,
        error: sendErr,
      });
      const message =
        process.env.NODE_ENV === "development"
          ? "Failed to send verification email. Check server logs for details."
          : "Failed to send email";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("send-verification: unexpected error", err);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
