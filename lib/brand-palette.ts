/**
 * Brand palette keys aligned with app/brand (ExpenseTerminal color system).
 * Stored on data_sources.brand_color_id — always one of these (not nullable).
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

const HEX: Record<BrandColorId, string> = {
  black: "#000000",
  white: "#FFFFFF",
  blue: "#007aff",
  purple: "#953d96",
  pink: "#f84e9f",
  red: "#e0383e",
  orange: "#d57119",
  yellow: "#ffc724",
  green: "#62ba46",
  grey: "#989898",
};

const LABELS: Record<BrandColorId, string> = {
  black: "Black",
  white: "White",
  blue: "Blue",
  purple: "Purple",
  pink: "Pink",
  red: "Red",
  orange: "Orange",
  yellow: "Yellow",
  green: "Green",
  grey: "Grey",
};

export function isBrandColorId(v: string): v is BrandColorId {
  return (BRAND_COLOR_IDS as readonly string[]).includes(v);
}

export function normalizeBrandColorId(v: string | null | undefined): BrandColorId {
  if (v && isBrandColorId(v)) return v;
  return "blue";
}

export function brandColorHex(id: string | null | undefined): string {
  const k = normalizeBrandColorId(id ?? undefined);
  return HEX[k];
}

export function brandColorLabel(id: string | null | undefined): string {
  const k = normalizeBrandColorId(id ?? undefined);
  return LABELS[k];
}

export const BRAND_COLOR_OPTIONS: { id: BrandColorId; label: string; hex: string }[] = BRAND_COLOR_IDS.map(
  (id) => ({ id, label: LABELS[id], hex: HEX[id] })
);
