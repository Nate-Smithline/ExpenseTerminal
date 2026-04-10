import { getResendClient, getFromAddress, RESEND_TIMEOUT_MS } from "@/lib/email/resend";
import { withRetry } from "@/lib/api/retry";
import crypto from "crypto";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendOrgInviteEmail(args: {
  to: string;
  orgName: string;
  inviterDisplay: string;
  actionLink: string;
}): Promise<void> {
  const resend = getResendClient();
  const org = escapeHtml(args.orgName);
  const inviter = escapeHtml(args.inviterDisplay);
  const linkText = escapeHtml(args.actionLink);
  const href = args.actionLink.replaceAll('"', "%22");

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height: 1.5; max-width: 560px;">
      <h2 style="margin:0 0 12px;">You&apos;re invited to ${org}</h2>
      <p style="margin:0 0 16px;color:#444;">${inviter} added you to this workspace on ExpenseTerminal.</p>
      <p style="margin:0 0 20px;">
        <a href="${href}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">Accept invitation</a>
      </p>
      <p style="margin:0;font-size:13px;color:#666;">If the button doesn&apos;t work, paste this link into your browser:<br/><span style="word-break:break-all;">${linkText}</span></p>
    </div>
  `;

  const text =
    `You're invited to ${args.orgName}\n\n` +
    `${args.inviterDisplay} added you to this workspace on ExpenseTerminal.\n\n` +
    `Open this link to accept:\n${args.actionLink}\n`;

  const sendPromise = resend.emails.send({
    from: getFromAddress(),
    to: args.to,
    subject: `Invitation to ${args.orgName} — ExpenseTerminal`,
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
