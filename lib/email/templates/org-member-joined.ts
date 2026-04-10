export function orgMemberJoinedEmailHtml(args: {
  orgName: string;
  memberLabel: string;
  workspaceUrl: string;
}): string {
  const { orgName, memberLabel, workspaceUrl } = args;
  return `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1d1d1f;">
  <p><strong>${escapeHtml(memberLabel)}</strong> joined <strong>${escapeHtml(orgName)}</strong> on Expense Terminal.</p>
  <p><a href="${escapeAttr(workspaceUrl)}" style="color: #0071e3;">Open workspace</a></p>
  <p style="font-size: 12px; color: #6e6e73;">You are receiving this because you are an owner of this workspace.</p>
</body>
</html>`.trim();
}

export function orgMemberJoinedEmailText(args: {
  orgName: string;
  memberLabel: string;
  workspaceUrl: string;
}): string {
  return `${args.memberLabel} joined ${args.orgName} on Expense Terminal.\n\nOpen workspace: ${args.workspaceUrl}\n\nYou are receiving this because you are an owner of this workspace.`;
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
