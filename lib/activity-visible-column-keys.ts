import { ACTIVITY_VISIBLE_COLUMNS } from "@/lib/validation/schemas";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidColumnKey(key: string): boolean {
  return UUID_REGEX.test(key);
}

/** Built-in activity column or org property definition id (UUID). */
export function isActivityVisibleColumnKey(key: string): boolean {
  return (ACTIVITY_VISIBLE_COLUMNS as readonly string[]).includes(key) || UUID_REGEX.test(key);
}

export function filterActivityVisibleColumns(keys: string[]): string[] {
  return keys.filter(isActivityVisibleColumnKey);
}

export function filterColumnWidthKeys(
  widths: Record<string, number>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(widths)) {
    if (isActivityVisibleColumnKey(k) && typeof v === "number") out[k] = v;
  }
  return out;
}
