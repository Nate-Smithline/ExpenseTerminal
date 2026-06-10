export type SignupNotificationParams = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  signedUpAt: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function signupNotificationEmailHtml(
  params: SignupNotificationParams
): string {
  const fullName = [params.firstName, params.lastName].filter(Boolean).join(" ");
  const rows = [
    ["Name", fullName || "—"],
    ["Email", params.email],
    ...(params.phone ? [["Phone", params.phone]] : []),
    ["Signed up", params.signedUpAt],
  ];
  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px 8px 0;vertical-align:top;color:#6b7280;font-size:14px;">${escapeHtml(label)}</td><td style="padding:8px 0;font-size:14px;color:#111;">${escapeHtml(value)}</td></tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 16px;font-size:20px;">New account signup</h2>
  <p style="color:#6b7280;margin:0 0 20px;font-size:14px;">Someone just created an ExpenseTerminal account.</p>
  <table style="width:100%;border-collapse:collapse;">${tableRows}</table>
  <p style="margin-top:24px;font-size:12px;color:#9ca3af;">Sent via ExpenseTerminal signup.</p>
</body>
</html>`;
}

export function signupNotificationEmailText(
  params: SignupNotificationParams
): string {
  const fullName = [params.firstName, params.lastName].filter(Boolean).join(" ");
  const lines = [
    `Name: ${fullName || "—"}`,
    `Email: ${params.email}`,
    ...(params.phone ? [`Phone: ${params.phone}`] : []),
    `Signed up: ${params.signedUpAt}`,
  ];
  return `New account signup\n\n${lines.join("\n")}\n\n---\nSent via ExpenseTerminal signup.`;
}
