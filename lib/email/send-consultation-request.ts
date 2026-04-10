import { getResendClient, getFromAddress, RESEND_TIMEOUT_MS } from "@/lib/email/resend";
import { withRetry } from "@/lib/api/retry";
import crypto from "crypto";

export async function sendConsultationRequestEmail(args: {
  fromUserId: string;
  fromEmail: string | null;
  fromName: string | null;
}): Promise<void> {
  const resend = getResendClient();
  const fromLabel = args.fromName?.trim() || "ExpenseTerminal user";
  const replyTo = args.fromEmail?.trim() || undefined;

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height: 1.5;">
      <h2 style="margin:0 0 12px;">New free consultation request</h2>
      <p style="margin:0 0 8px;"><strong>User</strong>: ${escapeHtml(fromLabel)}</p>
      <p style="margin:0 0 8px;"><strong>Email</strong>: ${escapeHtml(args.fromEmail ?? "Unknown")}</p>
      <p style="margin:0 0 8px;"><strong>User ID</strong>: ${escapeHtml(args.fromUserId)}</p>
      <p style="margin:16px 0 0;color:#555;">Reply to this email to follow up.</p>
    </div>
  `;

  const text =
    `New free consultation request\n\n` +
    `User: ${fromLabel}\n` +
    `Email: ${args.fromEmail ?? "Unknown"}\n` +
    `User ID: ${args.fromUserId}\n`;

  const sendPromise = resend.emails.send({
    from: getFromAddress(),
    to: "expenseterminal@outlook.com",
    replyTo,
    subject: "ExpenseTerminal — Free consultation request",
    html,
    text,
    headers: {
      "X-Entity-Ref-ID": crypto.randomUUID(),
    },
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Email send timeout")), RESEND_TIMEOUT_MS),
  );

  await withRetry(() => Promise.race([sendPromise, timeoutPromise]), {
    maxRetries: 2,
    initialMs: 1000,
    maxMs: 10_000,
  });
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

