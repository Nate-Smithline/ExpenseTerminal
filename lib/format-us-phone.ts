/**
 * Format US phone as (123) 456-7890.
 * Accepts digits only; strips non-digits from input.
 */
export function formatUSPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Get raw 10 digits from formatted or partial input for storage. */
export function parseUSPhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

/** Format for display (storage value is digits only). */
export function displayUSPhone(digits: string | null | undefined): string {
  if (!digits) return "";
  return formatUSPhone(digits);
}
