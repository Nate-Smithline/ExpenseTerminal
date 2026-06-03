import { BRAND, FONT_STACK, renderButton, renderEmailShell } from "./brand";

export function verificationEmailHtml(verifyUrl: string, token: string): string {
  const cardHtml = `
          <tr>
            <td style="padding:48px 48px 20px;">
              <h1 style="margin:0 0 8px;font-family:${FONT_STACK};font-size:24px;font-weight:700;color:${BRAND.ink};letter-spacing:-0.02em;text-align:center;">
                Verify your email
              </h1>
              <p style="margin:0;font-size:15px;color:${BRAND.ink3};line-height:1.7;text-align:center;">
                Welcome to ExpenseTerminal. Enter the code below or click the button to verify your account.
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
            <td style="padding:24px 48px 16px;text-align:center;">
              ${renderButton({ href: verifyUrl, label: "Verify My Email" })}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 48px 48px;text-align:center;">
              <p style="margin:0;font-size:12px;color:${BRAND.ink4};line-height:1.6;">
                This link expires in 24 hours. If you didn&rsquo;t create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>`;

  return renderEmailShell({
    title: "Verify your email",
    preheader: "Enter your code to verify your ExpenseTerminal account.",
    cardHtml,
  });
}

export function verificationEmailText(verifyUrl: string, token: string): string {
  return `Verify your email

Welcome to ExpenseTerminal! Enter this code to verify your account:

${token}

Or visit this link: ${verifyUrl}

This link expires in 24 hours.

If you didn't create an account, you can safely ignore this email.

- ExpenseTerminal`;
}
