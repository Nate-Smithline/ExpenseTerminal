import { getResendClient, RESEND_TIMEOUT_MS } from "@/lib/email/resend";
import {
  trialEndingEmailHtml,
  trialEndingEmailText,
  type TrialEndingParams,
} from "@/lib/email/templates/trial-ending";
import { withRetry } from "@/lib/api/retry";
import crypto from "crypto";

const FROM = "Nate from ExpenseTerminal <hello@expenseterminal.com>";

export async function sendTrialEnding(
  to: string,
  params: TrialEndingParams
): Promise<void> {
  const when =
    params.daysLeft <= 0
      ? "today"
      : params.daysLeft === 1
        ? "tomorrow"
        : `in ${params.daysLeft} days`;
  const subject = `Your ExpenseTerminal free trial ends ${when}`;
  const html = trialEndingEmailHtml(params);
  const text = trialEndingEmailText(params);

  const resend = getResendClient();
  const sendPromise = resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
    text,
    headers: { "X-Entity-Ref-ID": crypto.randomUUID() },
  });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Email send timeout")), RESEND_TIMEOUT_MS)
  );

  await withRetry(() => Promise.race([sendPromise, timeout]), {
    maxRetries: 2,
    initialMs: 1000,
    maxMs: 10_000,
  });
}
