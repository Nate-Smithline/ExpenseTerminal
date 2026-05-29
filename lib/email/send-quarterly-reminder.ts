import { getResendClient, RESEND_TIMEOUT_MS } from "@/lib/email/resend";
import {
  quarterlyReminderEmailHtml,
  quarterlyReminderEmailText,
  type QuarterlyReminderParams,
} from "@/lib/email/templates/quarterly-reminder";
import { withRetry } from "@/lib/api/retry";
import crypto from "crypto";

const FROM = "Nate from ExpenseTerminal <hello@expenseterminal.com>";

export async function sendQuarterlyReminder(
  to: string,
  params: QuarterlyReminderParams
): Promise<void> {
  const daysLabel = params.daysUntilDue <= 3 ? `${params.daysUntilDue} days` : `${params.daysUntilDue} days`;
  const subject = `${params.quarter} estimated tax payment due in ${daysLabel} — ${params.dueDate}`;
  const html = quarterlyReminderEmailHtml(params);
  const text = quarterlyReminderEmailText(params);

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
