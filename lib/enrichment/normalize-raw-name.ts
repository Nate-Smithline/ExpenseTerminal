/**
 * Normalize raw Plaid transaction names for merchant memory / fuzzy matching.
 * Aligned with docs/plans.md spec.
 */
export function normalizeRawName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(sq|tst|pp|amzn mktp|checkcard|purchase)\s*\*/gi, "")
    .replace(/\b\d{4,}\b/g, "")
    .replace(/\b[A-Z]{2}\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
