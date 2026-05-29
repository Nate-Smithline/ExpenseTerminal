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

export function quarterlyReminderEmailHtml(p: QuarterlyReminderParams): string {
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  const urgency = p.daysUntilDue <= 3 ? "final" : "upcoming";
  const daysLabel = p.daysUntilDue === 1 ? "1 day" : `${p.daysUntilDue} days`;
  const greeting = p.firstName ? `Hey ${p.firstName},` : "Hey,";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${p.quarter} estimated tax payment due in ${daysLabel}</title>
</head>
<body style="margin:0;padding:0;background-color:#f9f7f5;font-family:'Satoshi',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f7f5;padding:48px 20px;">
    <tr>
      <td align="center">

        <!-- Wordmark -->
        <table role="presentation" width="520" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 0 32px;text-align:center;">
              <span style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:400;color:#2a2a2a;letter-spacing:-0.01em;">ExpenseTerminal</span>
            </td>
          </tr>
        </table>

        <!-- Card -->
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px -4px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="padding:48px 48px 8px;">
              <p style="margin:0 0 4px;font-size:13px;color:${p.daysUntilDue <= 3 ? "#c0392b" : "#9a9a9a"};letter-spacing:0.05em;text-transform:uppercase;">${urgency === "final" ? "Due in " + daysLabel : "Due in " + daysLabel}</p>
              <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;color:#2a2a2a;letter-spacing:-0.02em;">
                ${p.quarter} estimated tax payment
              </h1>
              <p style="margin:12px 0 0;font-size:15px;color:#636363;line-height:1.7;">
                ${greeting} Your ${p.quarter} estimated payment is due <strong>${p.dueDate}</strong>. This covers ${p.coversPeriod}.
              </p>
            </td>
          </tr>

          ${p.estimatedAmount != null ? `
          <!-- Estimated amount callout -->
          <tr>
            <td style="padding:24px 48px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f1;border-radius:12px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 2px;font-size:12px;color:#6a8073;letter-spacing:0.04em;text-transform:uppercase;">Estimated payment</p>
                    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:400;color:#2a2a2a;">${fmt(p.estimatedAmount)}</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#6a8073;">Based on your categorized transactions. Review your deductions to confirm.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}

          <!-- What to do -->
          <tr>
            <td style="padding:24px 48px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e8e2dc;">
                <tr>
                  <td style="padding:20px 0 0;">
                    <p style="margin:0 0 12px;font-size:12px;color:#9a9a9a;letter-spacing:0.05em;text-transform:uppercase;">What to do</p>
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:12px;vertical-align:top;">
                          <span style="font-family:Georgia,'Times New Roman',serif;font-size:13px;color:#b87c5e;font-style:italic;">01</span>
                        </td>
                        <td>
                          <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#2a2a2a;">Review your transactions</p>
                          <p style="margin:0;font-size:13px;color:#636363;line-height:1.6;">Make sure your deductions are up to date before paying.</p>
                        </td>
                      </tr>
                    </table>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                      <tr>
                        <td style="padding-right:12px;vertical-align:top;">
                          <span style="font-family:Georgia,'Times New Roman',serif;font-size:13px;color:#b87c5e;font-style:italic;">02</span>
                        </td>
                        <td>
                          <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#2a2a2a;">Pay via IRS Direct Pay</p>
                          <p style="margin:0;font-size:13px;color:#636363;line-height:1.6;">Free, instant, no account required. Select "Estimated Tax" and tax year ${new Date().getFullYear()}.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTAs -->
          <tr>
            <td style="padding:32px 48px 48px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:12px;">
                    <a href="${p.irsPayUrl}" style="display:inline-block;background:#3f5147;color:#ffffff !important;font-size:15px;font-weight:500;text-decoration:none;padding:14px 28px;border-radius:999px;">
                      Pay on IRS.gov
                    </a>
                  </td>
                  <td>
                    <a href="${p.reviewUrl}" style="display:inline-block;background:transparent;color:#3f5147 !important;font-size:15px;font-weight:500;text-decoration:none;padding:14px 28px;border-radius:999px;border:1.5px solid #3f5147;">
                      Review Transactions
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!-- Footer -->
        <table role="presentation" width="520" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:32px 48px 0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#a3a3a3;line-height:1.6;">
                Estimated amounts are based on your logged transactions and are not tax advice. Consult a CPA for your specific situation.
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#a3a3a3;">
                &copy; ${new Date().getFullYear()} ExpenseTerminal &middot; AI-powered business deduction tracking
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
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
