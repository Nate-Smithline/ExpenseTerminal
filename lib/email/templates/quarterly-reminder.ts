import { BRAND, FONT_STACK, renderButton, renderEmailShell } from "./brand";

export type QuarterlyReminderParams = {
  firstName: string | null;
  quarter: string;       // e.g. "Q2 2026"
  dueDate: string;       // e.g. "June 15, 2026"
  daysUntilDue: number;  // 3 or 14
  estimatedAmount: number | null;  // null if we can't calculate
  coversPeriod: string;  // e.g. "April – May income"
  irsPayUrl: string;     // IRS Direct Pay URL
  reviewUrl: string;     // App URL
};

function quarterlyStep(num: string, title: string, body: string): string {
  return `
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:${num === "1" ? "0" : "16px"};">
                      <tr>
                        <td style="padding-right:12px;vertical-align:top;">
                          <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background:${BRAND.forestWash};color:${BRAND.forestDeep};border-radius:6px;font-family:${FONT_STACK};font-size:12px;font-weight:700;">${num}</span>
                        </td>
                        <td>
                          <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:${BRAND.ink};">${title}</p>
                          <p style="margin:0;font-size:13px;color:${BRAND.ink3};line-height:1.6;">${body}</p>
                        </td>
                      </tr>
                    </table>`;
}

export function quarterlyReminderEmailHtml(p: QuarterlyReminderParams): string {
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  const daysLabel = p.daysUntilDue === 1 ? "1 day" : `${p.daysUntilDue} days`;
  const greeting = p.firstName ? `Hey ${p.firstName},` : "Hey,";

  const cardHtml = `
          <tr>
            <td style="padding:48px 48px 8px;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:${p.daysUntilDue <= 3 ? BRAND.ember : BRAND.forest};letter-spacing:0.05em;text-transform:uppercase;">Due in ${daysLabel}</p>
              <h1 style="margin:0;font-family:${FONT_STACK};font-size:26px;font-weight:700;color:${BRAND.ink};letter-spacing:-0.02em;">
                ${p.quarter} estimated tax payment
              </h1>
              <p style="margin:12px 0 0;font-size:15px;color:${BRAND.ink3};line-height:1.7;">
                ${greeting} Your ${p.quarter} estimated payment is due <strong style="color:${BRAND.ink};">${p.dueDate}</strong>. This covers ${p.coversPeriod}.
              </p>
            </td>
          </tr>

          ${p.estimatedAmount != null ? `
          <tr>
            <td style="padding:24px 48px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.forestWash};border-radius:12px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 2px;font-size:12px;color:${BRAND.forestDeep};letter-spacing:0.04em;text-transform:uppercase;">Estimated payment</p>
                    <p style="margin:0;font-family:${FONT_STACK};font-size:32px;font-weight:800;color:${BRAND.ink};letter-spacing:-0.02em;">${fmt(p.estimatedAmount)}</p>
                    <p style="margin:4px 0 0;font-size:13px;color:${BRAND.ink3};">Based on your categorized transactions. Review your deductions to confirm.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}

          <tr>
            <td style="padding:24px 48px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BRAND.border};">
                <tr>
                  <td style="padding:20px 0 0;">
                    <p style="margin:0 0 12px;font-size:12px;color:${BRAND.ink4};letter-spacing:0.05em;text-transform:uppercase;">What to do</p>
${quarterlyStep("1", "Review your transactions", "Make sure your deductions are up to date before paying.")}
${quarterlyStep("2", "Pay via IRS Direct Pay", `Free, instant, no account required. Select "Estimated Tax" and tax year ${new Date().getFullYear()}.`)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 48px 48px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:12px;">
                    ${renderButton({ href: p.irsPayUrl, label: "Pay on IRS.gov" })}
                  </td>
                  <td>
                    ${renderButton({ href: p.reviewUrl, label: "Review Transactions", variant: "secondary" })}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;

  return renderEmailShell({
    title: `${p.quarter} estimated tax payment due in ${daysLabel}`,
    preheader: `Your ${p.quarter} estimated payment is due ${p.dueDate}.`,
    cardHtml,
    footerNote: "Estimated amounts are based on your logged transactions and are not tax advice. Consult a CPA for your specific situation.",
  });
}

export function quarterlyReminderEmailText(p: QuarterlyReminderParams): string {
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  const daysLabel = p.daysUntilDue === 1 ? "1 day" : `${p.daysUntilDue} days`;

  return `${p.quarter} Estimated Tax Payment — Due in ${daysLabel}

${p.firstName ? `Hey ${p.firstName},` : "Hey,"}

Your ${p.quarter} estimated payment is due ${p.dueDate}. This covers ${p.coversPeriod}.

${p.estimatedAmount != null ? `Estimated payment: ${fmt(p.estimatedAmount)}\n(Based on your categorized transactions)\n` : ""}
What to do:
  1. Review your transactions to confirm deductions are up to date.
  2. Pay via IRS Direct Pay (free, instant, no account required).
     Select "Estimated Tax" and tax year ${new Date().getFullYear()}.

Pay now: ${p.irsPayUrl}
Review transactions: ${p.reviewUrl}

Estimated amounts are based on your logged transactions and are not tax advice.
— ExpenseTerminal`;
}
