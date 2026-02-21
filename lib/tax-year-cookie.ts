/**
 * Sticky tax year: cookie for fast local reads, profile for cross-device sync.
 * Cookie name: tax_year (e.g. "2025"). Valid range: 2000–2100.
 */

export const TAX_YEAR_COOKIE_NAME = "tax_year";
export const TAX_YEAR_MIN = 2000;
export const TAX_YEAR_MAX = 2100;

function currentYear(): number {
  return new Date().getFullYear();
}

function parseYear(value: string | number | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (Number.isNaN(n) || n < TAX_YEAR_MIN || n > TAX_YEAR_MAX) return null;
  return n;
}

/**
 * Server: get sticky tax year from request cookies.
 * Pass the result of cookies() from next/headers (await cookies() in Next 15+).
 */
export function getStickyTaxYear(
  cookieStore: { get: (name: string) => { value: string } | undefined }
): number {
  const cookie = cookieStore.get(TAX_YEAR_COOKIE_NAME);
  return parseYear(cookie?.value) ?? currentYear();
}

/** Profile shape: at least onboarding_progress with optional selected_tax_year */
type ProfileOnboarding = {
  onboarding_progress?: { selected_tax_year?: number } | null;
} | null;

/**
 * Server: effective tax year from cookie (this device) or profile (other devices).
 * Use when you have both cookieStore and profile so the choice syncs across devices.
 */
export function getEffectiveTaxYear(
  cookieStore: { get: (name: string) => { value: string } | undefined },
  profile: ProfileOnboarding
): number {
  const fromCookie = parseYear(cookieStore.get(TAX_YEAR_COOKIE_NAME)?.value);
  if (fromCookie != null) return fromCookie;
  const fromProfile = parseYear(profile?.onboarding_progress?.selected_tax_year);
  if (fromProfile != null) return fromProfile;
  return currentYear();
}

/**
 * Client: get sticky tax year from document.cookie.
 * Use in client components; returns current year during SSR or if cookie missing/invalid.
 */
export function getStickyTaxYearClient(): number {
  if (typeof document === "undefined") return currentYear();
  const match = document.cookie.match(
    new RegExp("(?:^|;\\s*)" + TAX_YEAR_COOKIE_NAME + "=([^;]*)")
  );
  const value = match ? decodeURIComponent(match[1].trim()) : undefined;
  return parseYear(value) ?? currentYear();
}

/**
 * Client: persist selected tax year in a cookie (path=/, 1 year).
 * Call this whenever the user changes the year selector.
 */
export function setStickyTaxYear(year: number): void {
  if (typeof document === "undefined") return;
  const v = Math.min(TAX_YEAR_MAX, Math.max(TAX_YEAR_MIN, year));
  document.cookie = `${TAX_YEAR_COOKIE_NAME}=${v}; path=/; max-age=31536000; SameSite=Lax`;
}

/**
 * Client: persist selected tax year to cookie and to profile (cross-device).
 * Call whenever the user changes the year selector.
 */
export function persistTaxYear(year: number): void {
  const v = Math.min(TAX_YEAR_MAX, Math.max(TAX_YEAR_MIN, year));
  setStickyTaxYear(v);
  fetch("/api/profile/tax-year", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tax_year: v }),
  }).catch(() => {});
}
