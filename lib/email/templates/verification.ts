export function verificationEmailHtml(verifyUrl: string, token: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background-color:#f9f7f5;font-family:'Satoshi',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
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
            <td style="padding:48px 48px 20px;">
              <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;color:#2a2a2a;letter-spacing:-0.01em;text-align:center;">
                Verify your email
              </h1>
              <p style="margin:0;font-size:15px;color:#636363;line-height:1.7;text-align:center;">
                Welcome to ExpenseTerminal. Enter the code below or click the button to verify your account.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 48px;text-align:center;">
              <div style="background:#f9f7f5;border:1px solid #e8e2dc;border-radius:12px;padding:20px 32px;display:inline-block;">
                <code style="font-size:22px;font-weight:600;color:#3f5147;letter-spacing:2px;font-family:monospace;">${token}</code>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 48px 16px;text-align:center;">
              <a href="${verifyUrl}" style="display:inline-block;background:#3f5147;color:#ffffff;text-decoration:none;font-size:15px;font-weight:500;padding:14px 48px;border-radius:999px;font-family:'Satoshi',Helvetica,Arial,sans-serif;">
                Verify My Email
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 48px 48px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a3a3a3;line-height:1.6;">
                This link expires in 24 hours. If you didn&rsquo;t create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table role="presentation" width="520" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:32px 48px 0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#a3a3a3;line-height:1.6;">
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

export function verificationEmailText(verifyUrl: string, token: string): string {
  return `Verify your email

Welcome to ExpenseTerminal! Enter this code to verify your account:

${token}

Or visit this link: ${verifyUrl}

This link expires in 24 hours.

If you didn't create an account, you can safely ignore this email.

- ExpenseTerminal`;
}
