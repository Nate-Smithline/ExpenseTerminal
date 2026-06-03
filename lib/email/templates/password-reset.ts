import { BRAND, FONT_STACK, renderEmailShell } from "./brand";

export function passwordResetEmailHtml(token: string): string {
  const cardHtml = `
          <tr>
            <td style="padding:48px 48px 20px;">
              <h1 style="margin:0 0 8px;font-family:${FONT_STACK};font-size:24px;font-weight:700;color:${BRAND.ink};letter-spacing:-0.02em;text-align:center;">
                Reset your password
              </h1>
              <p style="margin:0;font-size:15px;color:${BRAND.ink3};line-height:1.7;text-align:center;">
                You requested to reset the password for your ExpenseTerminal account.
              </p>
              <p style="margin:16px 0 0;font-size:14px;color:${BRAND.ink3};line-height:1.7;text-align:center;">
                Enter the code below on the ExpenseTerminal sign-in screen to choose a new password.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 48px;text-align:center;">
              <div style="background:${BRAND.forestWash};border:1px solid ${BRAND.border};border-radius:12px;padding:20px 32px;display:inline-block;">
                <code style="font-size:22px;font-weight:700;color:${BRAND.forestDeep};letter-spacing:2px;font-family:'JetBrains Mono',ui-monospace,monospace;">${token}</code>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 48px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:${BRAND.ink4};line-height:1.6;">
                This code expires in 1 hour. If you didn't request a reset, you can safely ignore this email and your password will stay the same.
              </p>
            </td>
          </tr>`;

  return renderEmailShell({
    title: "Reset your password",
    preheader: "Use your code to set a new ExpenseTerminal password.",
    cardHtml,
  });
}

export function passwordResetEmailText(token: string): string {
  return `Reset your ExpenseTerminal password

You requested to reset the password for your ExpenseTerminal account.

Use this code on the ExpenseTerminal sign-in screen to set a new password:

${token}

This code expires in 1 hour. If you didn't request a reset, you can safely ignore this email and your password will stay the same.

- Nate from ExpenseTerminal`;
}

