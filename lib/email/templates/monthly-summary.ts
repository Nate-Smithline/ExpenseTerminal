export type MonthlySummaryParams = {
  firstName: string | null;
  month: string;           // e.g. "April 2026"
  sideHustleIncome: number;
  deductionsTaken: number;
  netIncome: number;
  setAsideAmount: number;
  setAsidePct: number;     // e.g. 30
  ytdIncome: number;
  ytdSetAside: number;
  reviewUrl: string;
};

export function monthlySummaryEmailHtml(p: MonthlySummaryParams): string {
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  const greeting = p.firstName ? `Hey ${p.firstName},` : "Hey,";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your ${p.month} money summary</title>
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
              <p style="margin:0 0 4px;font-size:13px;color:#9a9a9a;letter-spacing:0.05em;text-transform:uppercase;">Your ${p.month} summary</p>
              <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;color:#2a2a2a;letter-spacing:-0.02em;">
                Set aside ${fmt(p.setAsideAmount)} this month.
              </h1>
              <p style="margin:12px 0 0;font-size:15px;color:#636363;line-height:1.7;">
                ${greeting} Here's where your money stood in ${p.month}.
              </p>
            </td>
          </tr>

          <!-- Stats rows -->
          <tr>
            <td style="padding:32px 48px 0;">

              <!-- Side hustle income -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e8e2dc;">
                <tr>
                  <td style="padding:16px 0 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:14px;color:#636363;">Side hustle income</td>
                        <td style="text-align:right;font-size:14px;font-weight:600;color:#2a2a2a;">${fmt(p.sideHustleIncome)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Deductions taken -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e8e2dc;">
                <tr>
                  <td style="padding:16px 0 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:14px;color:#636363;">Deductions taken</td>
                        <td style="text-align:right;font-size:14px;font-weight:600;color:#3f5147;">&minus;${fmt(p.deductionsTaken)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Net income -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e8e2dc;">
                <tr>
                  <td style="padding:16px 0 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:14px;color:#636363;">Net side hustle income</td>
                        <td style="text-align:right;font-size:14px;font-weight:600;color:#2a2a2a;">${fmt(p.netIncome)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Set aside callout -->
          <tr>
            <td style="padding:0 48px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f1;border-radius:12px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <p style="margin:0 0 2px;font-size:12px;color:#6a8073;letter-spacing:0.04em;text-transform:uppercase;">Recommended set aside</p>
                          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;color:#2a2a2a;">${fmt(p.setAsideAmount)}</p>
                          <p style="margin:4px 0 0;font-size:13px;color:#6a8073;">${p.setAsidePct}% of net income — covers self-employment &amp; income tax</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- YTD row -->
          <tr>
            <td style="padding:0 48px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e8e2dc;">
                <tr>
                  <td style="padding:20px 0 0;">
                    <p style="margin:0 0 12px;font-size:12px;color:#9a9a9a;letter-spacing:0.05em;text-transform:uppercase;">Year to date</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#636363;padding-bottom:8px;">Total side hustle income</td>
                        <td style="text-align:right;font-size:13px;font-weight:600;color:#2a2a2a;padding-bottom:8px;">${fmt(p.ytdIncome)}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#636363;">Total recommended set aside</td>
                        <td style="text-align:right;font-size:13px;font-weight:600;color:#2a2a2a;">${fmt(p.ytdSetAside)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 48px 48px;text-align:center;">
              <a href="${p.reviewUrl}" style="display:inline-block;background:#3f5147;color:#ffffff !important;font-size:15px;font-weight:500;text-decoration:none;padding:14px 40px;border-radius:999px;">
                Review Your Transactions
              </a>
            </td>
          </tr>

        </table>

        <!-- Footer -->
        <table role="presentation" width="520" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:32px 48px 0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#a3a3a3;line-height:1.6;">
                These are estimates based on your logged transactions. Talk to a CPA for tax advice.
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

export function monthlySummaryEmailText(p: MonthlySummaryParams): string {
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return `Your ${p.month} Money Summary — ExpenseTerminal

Set aside ${fmt(p.setAsideAmount)} this month.

${p.month} breakdown:
  Side hustle income:    ${fmt(p.sideHustleIncome)}
  Deductions taken:    - ${fmt(p.deductionsTaken)}
  Net income:            ${fmt(p.netIncome)}

Recommended set aside: ${fmt(p.setAsideAmount)} (${p.setAsidePct}% of net)
Covers self-employment & income tax.

Year to date:
  Total income:          ${fmt(p.ytdIncome)}
  Total set aside:       ${fmt(p.ytdSetAside)}

Review your transactions: ${p.reviewUrl}

These are estimates based on your logged transactions. Talk to a CPA for tax advice.
— ExpenseTerminal`;
}
