import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getResendClient, getFromAddress, RESEND_TIMEOUT_MS } from "@/lib/email/resend";
import { welcomeEmailHtml, welcomeEmailText } from "@/lib/email/templates/welcome";
import { withRetry } from "@/lib/api/retry";
import crypto from "crypto";

export async function sendWelcomeEmailForUser(userId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();

  const { data: profile, error } = await (supabase as any)
    .from("profiles")
    .select("email, first_name")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile?.email) {
    return;
  }

  const firstName = (profile.first_name as string | null) ?? "";
  const html = welcomeEmailHtml(firstName);
  const text = welcomeEmailText(firstName);

  const resend = getResendClient();
  const sendPromise = resend.emails.send({
    from: getFromAddress(),
    to: profile.email as string,
    subject: "Welcome to ExpenseTerminal",
    html,
    text,
    headers: {
      "X-Entity-Ref-ID": crypto.randomUUID(),
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
}

