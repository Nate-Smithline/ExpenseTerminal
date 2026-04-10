/**
 * Account sidebar / activity chip colors. Keys must match
 * `data_sources_brand_color_id_check` in Supabase (ensure_db_up_to_date.sql).
 */
export const BRAND_COLOR_IDS = [
  "black",
  "white",
  "blue",
  "purple",
  "pink",
  "red",
  "orange",
  "yellow",
  "green",
  "grey",
] as const;

export type BrandColorId = (typeof BRAND_COLOR_IDS)[number];

const HEX_BY_ID: Record<BrandColorId, string> = {
  black: "#1d1d1f",
  /** Readable on light UI; pure white would disappear on pale pill backgrounds. */
  white: "#636366",
  blue: "#0071e3",
  purple: "#5856d6",
  pink: "#ff375f",
  red: "#ff3b30",
  orange: "#ff9500",
  yellow: "#b45309",
  green: "#34c759",
  grey: "#8e8e93",
};

export const BRAND_COLOR_OPTIONS: { id: BrandColorId; label: string }[] = [
  { id: "black", label: "Black" },
  { id: "white", label: "White" },
  { id: "blue", label: "Blue" },
  { id: "purple", label: "Purple" },
  { id: "pink", label: "Pink" },
  { id: "red", label: "Red" },
  { id: "orange", label: "Orange" },
  { id: "yellow", label: "Yellow" },
  { id: "green", label: "Green" },
  { id: "grey", label: "Grey" },
];

export function isBrandColorId(v: unknown): v is BrandColorId {
  return typeof v === "string" && (BRAND_COLOR_IDS as readonly string[]).includes(v);
}

export function normalizeBrandColorId(v: unknown): BrandColorId {
  return isBrandColorId(v) ? v : "blue";
}

export function brandColorHex(id: unknown): string {
  return HEX_BY_ID[normalizeBrandColorId(id)];
}
