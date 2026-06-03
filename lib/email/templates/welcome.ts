import { BRAND, FONT_STACK, renderButton, renderEmailShell } from "./brand";

function welcomeStep(num: string, title: string, body: string): string {
  return `
                <tr>
                  <td style="padding:16px 0;border-top:1px solid ${BRAND.border};">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:12px;vertical-align:top;">
                          <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background:${BRAND.forestWash};color:${BRAND.forestDeep};border-radius:6px;font-family:${FONT_STACK};font-size:12px;font-weight:700;">${num}</span>
                        </td>
                        <td>
                          <strong style="color:${BRAND.ink};font-size:14px;">${title}</strong>
                          <p style="margin:4px 0 0;font-size:13px;color:${BRAND.ink3};line-height:1.6;">${body}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`;
}

export function welcomeEmailHtml(firstName: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://expenseterminal.com";

  const cardHtml = `
          <tr>
            <td style="padding:48px 48px 24px;">
              <h1 style="margin:0 0 16px;font-family:${FONT_STACK};font-size:24px;font-weight:700;color:${BRAND.ink};letter-spacing:-0.02em;">
                Welcome${firstName ? `, ${firstName}` : ""}
              </h1>
              <p style="margin:0;font-size:15px;color:${BRAND.ink3};line-height:1.7;">
                Your ExpenseTerminal account is verified and ready. We help you turn a year of messy transactions into clean, audit-ready deductions.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 48px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${welcomeStep("1", "Connect your data", "Upload a CSV or Excel file from your bank or accounting tool.")}
${welcomeStep("2", "Review your inbox", "AI categorizes each transaction &mdash; confirm, adjust, or skip.")}
${welcomeStep("3", "Export for tax time", "Download a Schedule C summary or share with your CPA.")}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 48px 32px;">
              <p style="margin:0 0 12px;font-size:13px;color:${BRAND.ink3};line-height:1.7;">
                You can always see current plans and pricing at
                <a href="${appUrl}/pricing" style="color:${BRAND.forest};text-decoration:underline;">expenseterminal.com/pricing</a>.
              </p>
              <p style="margin:0;font-size:13px;color:${BRAND.ink3};line-height:1.7;">
                Talk soon,<br/>
                <span style="font-weight:600;color:${BRAND.ink};">Nate</span><br/>
                <span style="font-size:12px;color:${BRAND.ink4};">Founder, ExpenseTerminal</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 48px 48px;text-align:center;">
              ${renderButton({ href: `${appUrl}/inbox`, label: "Go to Your Inbox" })}
            </td>
          </tr>`;

  return renderEmailShell({
    title: "Welcome to ExpenseTerminal",
    preheader: "Your account is verified — here's how to get started.",
    cardHtml,
    footerNote: "Questions? Reply to this email &mdash; I read every message.",
  });
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

