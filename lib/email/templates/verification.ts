const OTP_EXPIRY_COPY = "This code expires in 1 hour.";

export function verificationEmailHtml(verifyUrl: string, otp: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <title>Your code</title>
</head>
<body style="margin:0;padding:0;background-color:#f9f7f5;font-family:system-ui,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f7f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
          <tr>
            <td style="padding:36px 32px 16px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#5B82B4;letter-spacing:0.04em;text-transform:uppercase;">ExpenseTerminal</p>
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#2a2a2a;line-height:1.25;">
                Your verification code
              </h1>
              <p style="margin:0;font-size:15px;color:#636363;line-height:1.6;">
                Enter this 6-digit code in the app to confirm your email. If you didn&rsquo;t sign up, ignore this message.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 28px;text-align:center;">
              <div style="background:#E8EEF5;border-radius:12px;padding:20px 24px;display:inline-block;min-width:200px;">
                <span style="font-size:28px;font-weight:700;letter-spacing:0.35em;color:#3f5147;font-family:ui-monospace,Menlo,monospace;">${otp}</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;text-align:center;">
              <a href="${verifyUrl}" style="display:inline-block;color:#5B82B4;font-size:14px;font-weight:500;text-decoration:underline;">
                Or verify in one tap
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 36px;">
              <p style="margin:0;font-size:12px;color:#a3a3a3;line-height:1.5;text-align:center;">
                ${OTP_EXPIRY_COPY} Don&rsquo;t share this code with anyone.
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

export function verificationEmailText(verifyUrl: string, otp: string): string {
  return `ExpenseTerminal — verify your email

Your code: ${otp}

${OTP_EXPIRY_COPY}

Optional link: ${verifyUrl}

If you didn't create an account, ignore this email.`;
}
