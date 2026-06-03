/**
 * Shared branding for transactional + notification emails.
 * Mirrors the in-app design tokens (app/design/styles.css) so emails match
 * the current ExpenseTerminal identity: emerald "forest" primary, cool-gray
 * surfaces, and the Hanken Grotesk wordmark with the "XT" square mark.
 */

export const BRAND = {
  // Surfaces
  bg: "#F9FAFB", // --bone
  surface: "#FFFFFF",
  // Ink (text)
  ink: "#202020", // --ink
  ink2: "#374151", // --ink-2
  ink3: "#6B7280", // --ink-3
  ink4: "#9CA3AF", // --ink-4
  // Borders
  border: "#E5E7EB", // --border
  // Primary (emerald / forest)
  forest: "#047857", // --forest
  forestDeep: "#065F46", // --forest-deep
  forestMid: "#10B981", // --forest-mid
  forestWash: "#ECFDF5", // --forest-wash
  // Alert
  ember: "#DC2626", // --ember
} as const;

/** Email-safe font stack. Hanken Grotesk loads in clients that support web fonts; the rest fall back to the system sans stack. */
export const FONT_STACK =
  "'Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/** `<head>` font import — best-effort; ignored by clients that strip <link>/<style>. */
const FONT_IMPORT = `<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet" />`;

/** The "XT" square mark + ExpenseTerminal wordmark, matching the app header. */
export function renderWordmark(): string {
  return `
        <table role="presentation" width="520" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 0 32px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <span style="display:inline-block;width:30px;height:30px;line-height:30px;text-align:center;background:${BRAND.forest};color:#ffffff;border-radius:6px;font-family:${FONT_STACK};font-size:14px;font-weight:800;letter-spacing:-0.03em;">XT</span>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-family:${FONT_STACK};font-size:17px;font-weight:700;color:${BRAND.ink};letter-spacing:-0.02em;">ExpenseTerminal</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>`;
}

type ButtonVariant = "primary" | "secondary";

/** A pill CTA button matching the in-app forest button. */
export function renderButton({
  href,
  label,
  variant = "primary",
}: {
  href: string;
  label: string;
  variant?: ButtonVariant;
}): string {
  if (variant === "secondary") {
    return `<a href="${href}" style="display:inline-block;background:transparent;color:${BRAND.forest} !important;font-family:${FONT_STACK};font-size:15px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:999px;border:1.5px solid ${BRAND.forest};">${label}</a>`;
  }
  return `<a href="${href}" style="display:inline-block;background:${BRAND.forest};color:#ffffff !important;font-family:${FONT_STACK};font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:999px;">${label}</a>`;
}

/** Footer with optional disclaimer note above the copyright line. */
export function renderFooter(noteHtml?: string): string {
  const year = new Date().getFullYear();
  return `
        <table role="presentation" width="520" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:32px 48px 0;text-align:center;">
              ${noteHtml ? `<p style="margin:0 0 8px;font-size:11px;color:${BRAND.ink4};line-height:1.6;">${noteHtml}</p>` : ""}
              <p style="margin:0;font-size:11px;color:${BRAND.ink4};">
                &copy; ${year} ExpenseTerminal &middot; AI-powered business deduction tracking
              </p>
            </td>
          </tr>
        </table>`;
}

/**
 * Wraps card content in the full branded document: background, centered column,
 * wordmark on top, and footer below.
 */
export function renderEmailShell({
  title,
  preheader,
  cardHtml,
  footerNote,
}: {
  title: string;
  preheader?: string;
  cardHtml: string;
  footerNote?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <title>${title}</title>
  ${FONT_IMPORT}
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:${FONT_STACK};-webkit-font-smoothing:antialiased;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bg};padding:48px 20px;">
    <tr>
      <td align="center">
${renderWordmark()}
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:${BRAND.surface};border-radius:16px;overflow:hidden;box-shadow:0 4px 16px -4px rgba(0,0,0,0.08);border:1px solid ${BRAND.border};">
${cardHtml}
        </table>
${renderFooter(footerNote)}
      </td>
    </tr>
  </table>
</body>
</html>`;
}
