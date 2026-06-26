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
                Welcome${firstName ? `, ${firstName}` : ""}. Let's get your ledger tax-ready.
              </h1>
              <p style="margin:0;font-size:15px;color:${BRAND.ink3};line-height:1.7;">
                Your email is confirmed, your 15-day trial is ready, and ExpenseTerminal can start turning everyday transactions into deductions, budgets, and a cleaner Schedule C.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 48px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${welcomeStep("1", "Connect your first account", "Link a bank or card securely with Plaid so transactions flow in automatically.")}
${welcomeStep("2", "Tag the first few transactions", "Swipe Personal, Business, or Partial. Every business call becomes a tracked deduction.")}
${welcomeStep("3", "Turn on your tax profile", "Add your filing details so ExpenseTerminal can estimate quarterly set-asides and keep your Schedule C organized.")}
${welcomeStep("4", "Build a simple budget", "Give the month a plan once your cash flow is visible.")}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 48px 32px;">
              <div style="background:${BRAND.forestWash};border:1px solid ${BRAND.border};border-radius:12px;padding:16px 18px;margin-bottom:20px;">
                <p style="margin:0;font-size:13px;color:${BRAND.forestDeep};line-height:1.7;">
                  Start with one account and one transaction. The full setup checklist takes about three minutes, and you can come back anytime.
                </p>
              </div>
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
              ${renderButton({ href: `${appUrl}/onboarding`, label: "Finish Setup" })}
            </td>
          </tr>`;

  return renderEmailShell({
    title: "Welcome to ExpenseTerminal",
    preheader: "Your account is verified. Connect, swipe, and start building a tax-ready ledger.",
    cardHtml,
    footerNote: "Questions? Reply to this email &mdash; I read every message.",
  });
}

export function welcomeEmailText(firstName: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://expenseterminal.com";

  return `Welcome${firstName ? `, ${firstName}` : ""}. Let's get your ledger tax-ready.

Your email is confirmed, your 15-day trial is ready, and ExpenseTerminal can start turning everyday transactions into deductions, budgets, and a cleaner Schedule C.

Start here:
- Connect your first bank or card securely with Plaid.
- Tag the first few transactions as Personal, Business, or Partial.
- Set up your tax profile for quarterly set-aside estimates and Schedule C organization.
- Build a simple budget once your cash flow is visible.

Start with one account and one transaction. The full setup checklist takes about three minutes, and you can come back anytime.

You can always see current plans and pricing here: ${appUrl}/pricing

Finish setup: ${appUrl}/onboarding

Questions or feedback? Just hit reply — I read every message.

- Nate from ExpenseTerminal`;
}

