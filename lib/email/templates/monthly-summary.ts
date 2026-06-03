import { BRAND, FONT_STACK, renderButton, renderEmailShell } from "./brand";

export type MonthlySummaryParams = {
  firstName: string | null;
  month: string;           // e.g. "April 2026"
  sideHustleIncome: number;
  deductionsTaken: number;
  netIncome: number;
  setAsideAmount: number;
  setAsidePct: number;     // e.g. 30
  ytdIncome: number;
  ytdSetAside: number;
  reviewUrl: string;
};

function statRow(label: string, value: string, valueColor: string): string {
  return `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BRAND.border};">
                <tr>
                  <td style="padding:16px 0 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:14px;color:${BRAND.ink3};">${label}</td>
                        <td style="text-align:right;font-size:14px;font-weight:600;color:${valueColor};">${value}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`;
}

export function monthlySummaryEmailHtml(p: MonthlySummaryParams): string {
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  const greeting = p.firstName ? `Hey ${p.firstName},` : "Hey,";

  const cardHtml = `
          <tr>
            <td style="padding:48px 48px 8px;">
              <p style="margin:0 0 4px;font-size:13px;color:${BRAND.forest};font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">Your ${p.month} summary</p>
              <h1 style="margin:0;font-family:${FONT_STACK};font-size:26px;font-weight:700;color:${BRAND.ink};letter-spacing:-0.02em;">
                Set aside ${fmt(p.setAsideAmount)} this month.
              </h1>
              <p style="margin:12px 0 0;font-size:15px;color:${BRAND.ink3};line-height:1.7;">
                ${greeting} Here's where your money stood in ${p.month}.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 48px 0;">
${statRow("Side hustle income", fmt(p.sideHustleIncome), BRAND.ink)}
${statRow("Deductions taken", `&minus;${fmt(p.deductionsTaken)}`, BRAND.forest)}
${statRow("Net side hustle income", fmt(p.netIncome), BRAND.ink)}
            </td>
          </tr>

          <tr>
            <td style="padding:0 48px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.forestWash};border-radius:12px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <p style="margin:0 0 2px;font-size:12px;color:${BRAND.forestDeep};letter-spacing:0.04em;text-transform:uppercase;">Recommended set aside</p>
                          <p style="margin:0;font-family:${FONT_STACK};font-size:26px;font-weight:800;color:${BRAND.ink};letter-spacing:-0.02em;">${fmt(p.setAsideAmount)}</p>
                          <p style="margin:4px 0 0;font-size:13px;color:${BRAND.ink3};">${p.setAsidePct}% of net income — covers self-employment &amp; income tax</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 48px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BRAND.border};">
                <tr>
                  <td style="padding:20px 0 0;">
                    <p style="margin:0 0 12px;font-size:12px;color:${BRAND.ink4};letter-spacing:0.05em;text-transform:uppercase;">Year to date</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:${BRAND.ink3};padding-bottom:8px;">Total side hustle income</td>
                        <td style="text-align:right;font-size:13px;font-weight:600;color:${BRAND.ink};padding-bottom:8px;">${fmt(p.ytdIncome)}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:${BRAND.ink3};">Total recommended set aside</td>
                        <td style="text-align:right;font-size:13px;font-weight:600;color:${BRAND.ink};">${fmt(p.ytdSetAside)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 48px 48px;text-align:center;">
              ${renderButton({ href: p.reviewUrl, label: "Review Your Transactions" })}
            </td>
          </tr>`;

  return renderEmailShell({
    title: `Your ${p.month} money summary`,
    preheader: `Set aside ${fmt(p.setAsideAmount)} for ${p.month}.`,
    cardHtml,
    footerNote: "These are estimates based on your logged transactions. Talk to a CPA for tax advice.",
  });
}

export function monthlySummaryEmailText(p: MonthlySummaryParams): string {
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return `Your ${p.month} Money Summary — ExpenseTerminal

Set aside ${fmt(p.setAsideAmount)} this month.

${p.month} breakdown:
  Side hustle income:    ${fmt(p.sideHustleIncome)}
  Deductions taken:    - ${fmt(p.deductionsTaken)}
  Net income:            ${fmt(p.netIncome)}

Recommended set aside: ${fmt(p.setAsideAmount)} (${p.setAsidePct}% of net)
Covers self-employment & income tax.

Year to date:
  Total income:          ${fmt(p.ytdIncome)}
  Total set aside:       ${fmt(p.ytdSetAside)}

Review your transactions: ${p.reviewUrl}

These are estimates based on your logged transactions. Talk to a CPA for tax advice.
— ExpenseTerminal`;
}
