import { getResendClient, RESEND_TIMEOUT_MS } from "@/lib/email/resend";
import {
  monthlySummaryEmailHtml,
  monthlySummaryEmailText,
  type MonthlySummaryParams,
} from "@/lib/email/templates/monthly-summary";
import { withRetry } from "@/lib/api/retry";
import crypto from "crypto";

const FROM = "Nate from ExpenseTerminal <hello@expenseterminal.com>";

export async function sendMonthlySummary(
  to: string,
  params: MonthlySummaryParams
): Promise<void> {
  const subject = `Here's what to set aside for ${params.month}`;
  const html = monthlySummaryEmailHtml(params);
  const text = monthlySummaryEmailText(params);

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
