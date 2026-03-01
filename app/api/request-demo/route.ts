import { NextResponse } from "next/server";
import { getResendClient, getFromAddress, RESEND_TIMEOUT_MS } from "@/lib/email/resend";
import { withRetry } from "@/lib/api/retry";
import { isValidEmail } from "@/lib/validation/email";

const DEMO_REQUEST_TO =
  process.env.REQUEST_DEMO_TO || "expenseterminal@outlook.com";

function demoRequestEmailHtml(body: {
  companyName: string;
  contactName: string;
  email: string;
  businessType?: string;
  message?: string;
}) {
  const rows = [
    ["Company / business", body.companyName],
    ["Contact name", body.contactName],
    ["Email", body.email],
    ...(body.businessType ? [["Business type", body.businessType]] : []),
    ...(body.message ? [["Message", body.message]] : []),
  ];
  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px 8px 0;vertical-align:top;color:#6b7280;font-size:14px;">${label}</td><td style="padding:8px 0;font-size:14px;color:#111;">${value.replace(/\n/g, "<br>")}</td></tr>`
    )
    .join("");
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 16px;font-size:20px;">New demo request</h2>
  <p style="color:#6b7280;margin:0 0 20px;font-size:14px;">Someone submitted a request from the ExpenseTerminal landing page.</p>
  <table style="width:100%;border-collapse:collapse;">${tableRows}</table>
  <p style="margin-top:24px;font-size:12px;color:#9ca3af;">Sent via ExpenseTerminal request-demo form.</p>
</body>
</html>`;
}

function demoRequestEmailText(body: {
  companyName: string;
  contactName: string;
  email: string;
  businessType?: string;
  message?: string;
}) {
  const lines = [
    `Company: ${body.companyName}`,
    `Contact: ${body.contactName}`,
    `Email: ${body.email}`,
    ...(body.businessType ? [`Business type: ${body.businessType}`] : []),
    ...(body.message ? [`Message:\n${body.message}`] : []),
  ];
  return `New demo request\n\n${lines.join("\n")}\n\n---\nSent via ExpenseTerminal request-demo form.`;
}

function confirmationEmailHtml(contactName: string) {
  const name = contactName || "there";
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 16px;font-size:20px;">We got your request</h2>
  <p style="margin:0 0 16px;font-size:14px;color:#374151;">Hi ${name},</p>
  <p style="margin:0 0 16px;font-size:14px;color:#374151;">Thanks for requesting a demo of ExpenseTerminal. We've received your details and will be in touch soon.</p>
  <p style="margin:0;font-size:14px;color:#374151;">— The ExpenseTerminal team</p>
</body>
</html>`;
}

function confirmationEmailText(contactName: string) {
  const name = contactName || "there";
  return `Hi ${name},\n\nThanks for requesting a demo of ExpenseTerminal. We've received your details and will be in touch soon.\n\n— The ExpenseTerminal team`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      companyName,
      contactName,
      email,
      businessType,
      message,
    } = body;

    if (!companyName?.trim()) {
      return NextResponse.json(
        { error: "Company / business name is required" },
        { status: 400 }
      );
    }
    if (!contactName?.trim()) {
      return NextResponse.json(
        { error: "Your name is required" },
        { status: 400 }
      );
    }
    if (!email?.trim()) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }
    if (!isValidEmail(email.trim())) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    const payload = {
      companyName: String(companyName).trim(),
      contactName: String(contactName).trim(),
      email: String(email).trim(),
      businessType: businessType ? String(businessType).trim() : undefined,
      message: message ? String(message).trim() : undefined,
    };

    const resend = getResendClient();
    const from = getFromAddress();

    // 1) Send to you (Outlook)
    const sendToYou = resend.emails.send({
      from,
      to: DEMO_REQUEST_TO,
      replyTo: payload.email,
      subject: `Demo request: ${payload.companyName}`,
      html: demoRequestEmailHtml(payload),
      text: demoRequestEmailText(payload),
    });

    // 2) Confirmation to the requester
    const sendConfirmation = resend.emails.send({
      from,
      to: payload.email,
      subject: "We received your ExpenseTerminal demo request",
      html: confirmationEmailHtml(payload.contactName),
      text: confirmationEmailText(payload.contactName),
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Email send timeout")), RESEND_TIMEOUT_MS)
    );

    await withRetry(
      () =>
        Promise.all([
          Promise.race([sendToYou, timeoutPromise]),
          Promise.race([sendConfirmation, timeoutPromise]),
        ]),
      { maxRetries: 2, initialMs: 1000, maxMs: 10_000 }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Request demo email failed:", err);
    return NextResponse.json(
      { error: "Failed to send your request. Please try again or email us directly." },
      { status: 500 }
    );
  }
}
