export function orgInviteSignupEmailHtml(args: {
  orgName: string;
  inviterLabel: string;
  actionLink: string;
}): string {
  const { orgName, inviterLabel, actionLink } = args;
  return `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1d1d1f;">
  <p>${escapeHtml(inviterLabel)} invited you to join <strong>${escapeHtml(orgName)}</strong> on Expense Terminal.</p>
  <p><a href="${escapeAttr(actionLink)}" style="color: #0071e3;">Accept invitation</a></p>
  <p style="font-size: 12px; color: #6e6e73;">If you did not expect this, you can ignore this email.</p>
</body>
</html>`.trim();
}

export function orgInviteSignupEmailText(args: {
  orgName: string;
  inviterLabel: string;
  actionLink: string;
}): string {
  return `${args.inviterLabel} invited you to join ${args.orgName} on Expense Terminal.\n\nAccept: ${args.actionLink}`;
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
