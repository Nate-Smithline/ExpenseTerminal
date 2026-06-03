import { BRAND, FONT_STACK, renderButton, renderEmailShell } from "./brand";

export function unsortedReminderEmailHtml(params: {
  unsortedCount: number;
  dateRange: string;
  workspaceName: string;
  sortNowUrl: string;
}): string {
  const { unsortedCount, dateRange, workspaceName, sortNowUrl } = params;
  const cardHtml = `
          <tr>
            <td style="padding:48px 48px 20px;">
              <h1 style="margin:0 0 8px;font-family:${FONT_STACK};font-size:24px;font-weight:700;color:${BRAND.ink};letter-spacing:-0.02em;text-align:center;">
                Reminder to sort expenses for tax deductions
              </h1>
              <p style="margin:0;font-size:15px;color:${BRAND.ink3};line-height:1.7;text-align:center;">
                You have <strong style="color:${BRAND.ink};">${unsortedCount}</strong> unsorted transaction${unsortedCount !== 1 ? "s" : ""} in ${workspaceName}.
              </p>
              <p style="margin:12px 0 0;font-size:14px;color:${BRAND.ink3};line-height:1.7;text-align:center;">
                Date range: ${dateRange}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 48px 40px;text-align:center;">
              ${renderButton({ href: sortNowUrl, label: "Sort Now" })}
            </td>
          </tr>`;

  return renderEmailShell({
    title: "Reminder to sort expenses",
    preheader: `${unsortedCount} unsorted transaction${unsortedCount !== 1 ? "s" : ""} waiting in ${workspaceName}.`,
    cardHtml,
  });
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
