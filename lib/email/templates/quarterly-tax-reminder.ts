export function quarterlyTaxReminderHtml(params: {
  firstName: string | null;
  estimatedQuarterlyPayment: number;
  taxYear: number;
  dashboardUrl: string;
}): string {
  const { firstName, estimatedQuarterlyPayment, taxYear, dashboardUrl } = params;
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,";
  const amt = estimatedQuarterlyPayment.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  return `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #1a1a1a;">
  <p>${greeting}</p>
  <p>This is a friendly reminder that estimated quarterly taxes may apply for self-employment income. Based on your ${taxYear} activity in Expense Terminal, a rough per-quarter amount to plan for is <strong>${amt}</strong> (informational only, not tax advice).</p>
  <p><a href="${dashboardUrl}" style="color: #2563eb;">View your summary in Expense Terminal</a></p>
  <p style="font-size: 12px; color: #666;">Consult a tax professional for your situation. Amounts are estimates from your linked data and settings.</p>
</body>
</html>`;
}

export function quarterlyTaxReminderText(params: {
  firstName: string | null;
  estimatedQuarterlyPayment: number;
  taxYear: number;
  dashboardUrl: string;
}): string {
  const { firstName, estimatedQuarterlyPayment, taxYear, dashboardUrl } = params;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  const amt = estimatedQuarterlyPayment.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
  return `${greeting}

Estimated quarterly amount (informational): ${amt} (tax year ${taxYear}).

Open your dashboard: ${dashboardUrl}

Not tax advice — consult a professional.`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
