/** Canonical app origin for redirects and email links (no trailing slash). */
export function getAppBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "https://expenseterminal.com";
}
