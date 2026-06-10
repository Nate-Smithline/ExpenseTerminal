import { getResendClient, getFromAddress, RESEND_TIMEOUT_MS } from "@/lib/email/resend";
import { ADMIN_NOTIFY_EMAIL } from "@/lib/email/admin";
import {
  signupNotificationEmailHtml,
  signupNotificationEmailText,
  type SignupNotificationParams,
} from "@/lib/email/templates/signup-notification";
import { withRetry } from "@/lib/api/retry";
import crypto from "crypto";

export async function sendSignupNotificationEmail(
  params: SignupNotificationParams
): Promise<void> {
  const fullName = [params.firstName, params.lastName].filter(Boolean).join(" ");
  const subjectName = fullName || params.email;

  const resend = getResendClient();
  const sendPromise = resend.emails.send({
    from: getFromAddress(),
    to: ADMIN_NOTIFY_EMAIL,
    replyTo: params.email,
    subject: `New signup: ${subjectName}`,
    html: signupNotificationEmailHtml(params),
    text: signupNotificationEmailText(params),
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
