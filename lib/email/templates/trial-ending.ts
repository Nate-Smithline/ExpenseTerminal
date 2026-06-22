import { BRAND, FONT_STACK, renderButton, renderEmailShell } from "./brand";

export type TrialEndingParams = {
  firstName: string | null;
  /** Whole days until the trial ends (1–3 by the time we send). */
  daysLeft: number;
  /** Formatted trial end date, e.g. "July 3, 2026". */
  trialEndsAt: string;
  /** Human price label, e.g. "$180/year" or "$18/month". Null if unknown. */
  priceLabel: string | null;
  /** Link to manage the subscription (billing settings). */
  manageUrl: string;
};

function daysLabel(n: number): string {
  if (n <= 0) return "today";
  return n === 1 ? "tomorrow" : `in ${n} days`;
}

export function trialEndingEmailHtml(p: TrialEndingParams): string {
  const greeting = p.firstName ? `Hey ${p.firstName},` : "Hey,";
  const when = daysLabel(p.daysLeft);
  const chargeSentence = p.priceLabel
    ? `your free trial ends ${when} and your plan begins at <strong style="color:${BRAND.ink};">${p.priceLabel}</strong>.`
    : `your free trial ends ${when} and your paid plan begins.`;

  const cardHtml = `
          <tr>
            <td style="padding:48px 48px 8px;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:${BRAND.forest};letter-spacing:0.05em;text-transform:uppercase;">Trial ends ${when}</p>
              <h1 style="margin:0;font-family:${FONT_STACK};font-size:26px;font-weight:700;color:${BRAND.ink};letter-spacing:-0.02em;">
                Your free trial is almost over
              </h1>
              <p style="margin:12px 0 0;font-size:15px;color:${BRAND.ink3};line-height:1.7;">
                ${greeting} just a heads-up — ${chargeSentence} Nothing to do if you'd like to keep going. Your transactions, budgets, and tax insights will keep humming along.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 48px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.forestWash};border-radius:12px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 2px;font-size:12px;color:${BRAND.forestDeep};letter-spacing:0.04em;text-transform:uppercase;">Trial ends</p>
                    <p style="margin:0;font-family:${FONT_STACK};font-size:24px;font-weight:800;color:${BRAND.ink};letter-spacing:-0.02em;">${p.trialEndsAt}</p>
                    ${p.priceLabel ? `<p style="margin:4px 0 0;font-size:13px;color:${BRAND.ink3};">First charge: ${p.priceLabel}. Cancel anytime before then and you won't be billed.</p>` : `<p style="margin:4px 0 0;font-size:13px;color:${BRAND.ink3};">Cancel anytime before then and you won't be billed.</p>`}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 48px 48px;">
              ${renderButton({ href: p.manageUrl, label: "Manage subscription" })}
            </td>
          </tr>`;

  return renderEmailShell({
    title: "Your ExpenseTerminal free trial is ending soon",
    preheader: `Your free trial ends ${when} (${p.trialEndsAt}).`,
    cardHtml,
    footerNote: "You're receiving this because you started a free trial of ExpenseTerminal. Manage or cancel your subscription anytime from billing settings.",
  });
}

export function trialEndingEmailText(p: TrialEndingParams): string {
  const when = daysLabel(p.daysLeft);
  const charge = p.priceLabel
    ? `your free trial ends ${when} (${p.trialEndsAt}) and your plan begins at ${p.priceLabel}.`
    : `your free trial ends ${when} (${p.trialEndsAt}) and your paid plan begins.`;

  return `Your ExpenseTerminal free trial is ending soon

${p.firstName ? `Hey ${p.firstName},` : "Hey,"}

Just a heads-up — ${charge}

Nothing to do if you'd like to keep going. Your transactions, budgets, and tax insights will keep humming along.

Want to make changes? Cancel anytime before ${p.trialEndsAt} and you won't be billed.

Manage subscription: ${p.manageUrl}

— ExpenseTerminal`;
}
