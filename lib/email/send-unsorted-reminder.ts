import { getResendClient, RESEND_TIMEOUT_MS } from "@/lib/email/resend";
import {
  unsortedReminderEmailHtml,
  unsortedReminderEmailText,
} from "@/lib/email/templates/unsorted-reminder";
import { withRetry } from "@/lib/api/retry";
import crypto from "crypto";

const REMINDER_FROM = "ExpenseTerminal <hello@expenseterminal.com>";
const SUBJECT = "Reminder to sort expenses for tax deductions";

export type SendUnsortedReminderParams = {
  to: string;
  unsortedCount: number;
  dateRange: string;
  workspaceName: string;
  sortNowUrl: string;
};

/**
 * Send the unsorted-expenses reminder email via Resend.
 * Used by both count-based and interval-based notification cron flows.
 */
export async function sendUnsortedReminder(
  params: SendUnsortedReminderParams
): Promise<void> {
  const { to, unsortedCount, dateRange, workspaceName, sortNowUrl } = params;
  const html = unsortedReminderEmailHtml({
    unsortedCount,
    dateRange,
    workspaceName,
    sortNowUrl,
  });
  const text = unsortedReminderEmailText({
    unsortedCount,
    dateRange,
    workspaceName,
    sortNowUrl,
  });

  const resend = getResendClient();
  const sendPromise = resend.emails.send({
    from: REMINDER_FROM,
    to,
    subject: SUBJECT,
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
