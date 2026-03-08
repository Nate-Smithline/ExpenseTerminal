export function unsortedReminderEmailHtml(params: {
  unsortedCount: number;
  dateRange: string;
  workspaceName: string;
  sortNowUrl: string;
}): string {
  const { unsortedCount, dateRange, workspaceName, sortNowUrl } = params;
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <title>Reminder to sort expenses</title>
</head>
<body style="margin:0;padding:0;background-color:#f9f7f5;font-family:'Satoshi',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f7f5;padding:48px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 0 32px;text-align:center;">
              <span style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:400;color:#2a2a2a;letter-spacing:-0.01em;">ExpenseTerminal</span>
            </td>
          </tr>
        </table>
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px -4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding:48px 48px 20px;">
              <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;color:#2a2a2a;letter-spacing:-0.01em;text-align:center;">
                Reminder to sort expenses for tax deductions
              </h1>
              <p style="margin:0;font-size:15px;color:#636363;line-height:1.7;text-align:center;">
                You have <strong>${unsortedCount}</strong> unsorted transaction${unsortedCount !== 1 ? "s" : ""} in ${workspaceName}.
              </p>
              <p style="margin:12px 0 0;font-size:14px;color:#636363;line-height:1.7;text-align:center;">
                Date range: ${dateRange}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 48px 32px;text-align:center;">
              <a href="${sortNowUrl}" style="display:inline-block;background:#3f5147;color:#ffffff !important;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:10px;">Sort Now</a>
            </td>
          </tr>
        </table>
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

export function unsortedReminderEmailText(params: {
  unsortedCount: number;
  dateRange: string;
  workspaceName: string;
  sortNowUrl: string;
}): string {
  const { unsortedCount, dateRange, workspaceName, sortNowUrl } = params;
  return `Reminder to sort expenses for tax deductions

You have ${unsortedCount} unsorted transaction${unsortedCount !== 1 ? "s" : ""} in ${workspaceName}.
Date range: ${dateRange}

Sort now: ${sortNowUrl}

— ExpenseTerminal`;
}
