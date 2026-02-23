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
    const { success: rateLimitOk } = await rateLimitByIp(req, emailVerificationLimit);
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429 }
      );
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
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id")
        .eq("email", email)
        .single();
      resolvedUserId = data?.id;
    }

    if (!resolvedUserId) {
      return NextResponse.json({ ok: true });
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
    await withRetry(() => Promise.race([sendPromise, timeoutPromise]), {
      maxRetries: 2,
      initialMs: 1000,
      maxMs: 10_000,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to send verification email:", err);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
