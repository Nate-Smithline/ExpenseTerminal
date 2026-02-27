export function welcomeEmailHtml(firstName: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://expenseterminal.com";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <title>Welcome to ExpenseTerminal</title>
</head>
<body style="margin:0;padding:0;background-color:#f9f7f5;font-family:'Work Sans',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f7f5;padding:48px 20px;">
    <tr>
      <td align="center">
        <!-- Logo -->
        <table role="presentation" width="520" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 0 32px;text-align:center;">
              <span style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:400;color:#2a2a2a;letter-spacing:-0.01em;">ExpenseTerminal</span>
            </td>
          </tr>
        </table>

        <!-- Main card -->
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px -4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding:48px 48px 24px;">
              <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;color:#2a2a2a;letter-spacing:-0.01em;">
                Welcome${firstName ? `, ${firstName}` : ""}
              </h1>
              <p style="margin:0;font-size:15px;color:#636363;line-height:1.7;">
                Your ExpenseTerminal account is verified and ready. We help you turn a year of messy transactions into clean, audit-ready deductions.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 48px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:16px 0;border-top:1px solid #e8e2dc;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:12px;vertical-align:top;">
                          <span style="font-family:Georgia,'Times New Roman',serif;font-size:13px;color:#b87c5e;font-style:italic;">01</span>
                        </td>
                        <td>
                          <strong style="color:#2a2a2a;font-size:14px;">Connect your data</strong>
                          <p style="margin:4px 0 0;font-size:13px;color:#636363;line-height:1.6;">Upload a CSV or Excel file from your bank or accounting tool.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 0;border-top:1px solid #e8e2dc;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:12px;vertical-align:top;">
                          <span style="font-family:Georgia,'Times New Roman',serif;font-size:13px;color:#b87c5e;font-style:italic;">02</span>
                        </td>
                        <td>
                          <strong style="color:#2a2a2a;font-size:14px;">Review your inbox</strong>
                          <p style="margin:4px 0 0;font-size:13px;color:#636363;line-height:1.6;">AI categorizes each transaction &mdash; confirm, adjust, or skip.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 0;border-top:1px solid #e8e2dc;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:12px;vertical-align:top;">
                          <span style="font-family:Georgia,'Times New Roman',serif;font-size:13px;color:#b87c5e;font-style:italic;">03</span>
                        </td>
                        <td>
                          <strong style="color:#2a2a2a;font-size:14px;">Export for tax time</strong>
                          <p style="margin:4px 0 0;font-size:13px;color:#636363;line-height:1.6;">Download a Schedule C summary or share with your CPA.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 48px 32px;">
              <p style="margin:0 0 12px;font-size:13px;color:#636363;line-height:1.7;">
                You can always see current plans and pricing at
                <a href="${appUrl}/pricing" style="color:#3f5147;text-decoration:underline;">expenseterminal.com/pricing</a>.
              </p>
              <p style="margin:0;font-size:13px;color:#636363;line-height:1.7;">
                Talk soon,<br/>
                <span style="font-weight:500;color:#3f5147;">Nate</span><br/>
                <span style="font-size:12px;color:#8a8a8a;">Founder, ExpenseTerminal</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 48px 48px;text-align:center;">
              <a href="${appUrl}/inbox" style="display:inline-block;background:#3f5147;color:#ffffff;text-decoration:none;font-size:15px;font-weight:500;padding:14px 48px;border-radius:999px;font-family:'Work Sans',Helvetica,Arial,sans-serif;">
                Go to Your Inbox
              </a>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="520" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:32px 48px 0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#a3a3a3;line-height:1.6;">
                Questions? Reply to this email &mdash; I read every message.
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

export function welcomeEmailText(firstName: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://expenseterminal.com";

  return `Welcome${firstName ? `, ${firstName}` : ""}!

Your ExpenseTerminal account is verified and ready. We help you turn a year of messy transactions into clean, audit-ready deductions.

Here are a few good next steps:
- Connect a CSV or Excel file with your transactions.
- Review the AI suggestions in your inbox.
- Export a summary for your records or your CPA.

You can always see current plans and pricing here: ${appUrl}/pricing

Go to your inbox: ${appUrl}/inbox

Questions or feedback? Just hit reply — I read every message.

- Nate from ExpenseTerminal`;
}

