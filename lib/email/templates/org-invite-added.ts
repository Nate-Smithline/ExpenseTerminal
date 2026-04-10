export function orgInviteAddedEmailHtml(args: {
  orgName: string;
  inviterLabel: string;
  loginUrl: string;
}): string {
  const { orgName, inviterLabel, loginUrl } = args;
  return `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1d1d1f;">
  <p>${inviterLabel} added you to <strong>${escapeHtml(orgName)}</strong> on Expense Terminal.</p>
  <p><a href="${escapeAttr(loginUrl)}" style="color: #0071e3;">Open Expense Terminal</a></p>
</body>
</html>`.trim();
}

export function orgInviteAddedEmailText(args: {
  orgName: string;
  inviterLabel: string;
  loginUrl: string;
}): string {
  return `${args.inviterLabel} added you to ${args.orgName} on Expense Terminal.\n\nSign in: ${args.loginUrl}`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
