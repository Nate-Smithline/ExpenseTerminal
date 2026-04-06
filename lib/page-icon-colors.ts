/** Stored on pages.icon_color; legacy `gray` maps to `grey`; legacy `brown` maps to `orange`. */
export function normalizePageIconColorId(raw: string | null | undefined): string {
  const id = (raw ?? "grey").toLowerCase().trim();
  if (id === "gray") return "grey";
  if (id === "brown") return "orange";
  const allowed = new Set(PAGE_ICON_COLOR_IDS);
  if (allowed.has(id as (typeof PAGE_ICON_COLOR_IDS)[number])) return id;
  return "grey";
}

/** Apple-style system primaries (order matches picker). */
export const PAGE_ICON_COLOR_IDS = [
  "black",
  "grey",
  "orange",
  "red",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
] as const;

type IconColorId = (typeof PAGE_ICON_COLOR_IDS)[number];

/**
 * Apple system–adjacent fills (swatches, triggers) + matching glyph colors on white UI.
 * Yellow uses a dark glyph on the filled chip (same as iOS contrast).
 */
const PAGE_ICON_COLOR_STYLES: Record<
  IconColorId,
  { fill: string; textPlain: string; textOnFill: string }
> = {
  black: {
    fill: "bg-[#1C1C1E]",
    textPlain: "text-[#1C1C1E]",
    textOnFill: "text-white",
  },
  grey: {
    fill: "bg-[#8E8E93]",
    textPlain: "text-[#8E8E93]",
    textOnFill: "text-white",
  },
  orange: {
    fill: "bg-[#FF9500]",
    textPlain: "text-[#FF9500]",
    textOnFill: "text-white",
  },
  red: {
    fill: "bg-[#FF3B30]",
    textPlain: "text-[#FF3B30]",
    textOnFill: "text-white",
  },
  yellow: {
    fill: "bg-[#FFCC00]",
    textPlain: "text-[#C9A000]",
    textOnFill: "text-[#1C1C1E]",
  },
  green: {
    fill: "bg-[#34C759]",
    textPlain: "text-[#34C759]",
    textOnFill: "text-white",
  },
  blue: {
    fill: "bg-[#007AFF]",
    textPlain: "text-[#007AFF]",
    textOnFill: "text-white",
  },
  purple: {
    fill: "bg-[#AF52DE]",
    textPlain: "text-[#AF52DE]",
    textOnFill: "text-white",
  },
  pink: {
    fill: "bg-[#FF2D55]",
    textPlain: "text-[#FF2D55]",
    textOnFill: "text-white",
  },
};

/** Tailwind text class for plain icon / sidebar (matches swatch hue). */
export function pageIconTextClass(color: string | null | undefined): string {
  const id = normalizePageIconColorId(color) as IconColorId;
  return PAGE_ICON_COLOR_STYLES[id]?.textPlain ?? PAGE_ICON_COLOR_STYLES.grey.textPlain;
}

/** Filled trigger (default variant) — background matches swatch. */
export function pageIconTriggerClass(color: string | null | undefined): string {
  const id = normalizePageIconColorId(color) as IconColorId;
  const s = PAGE_ICON_COLOR_STYLES[id] ?? PAGE_ICON_COLOR_STYLES.grey;
  return `${s.fill} ${s.textOnFill}`;
}

/** Solid fill class for picker swatches (same as trigger background). */
export function pageIconSwatchFillClass(color: string | null | undefined): string {
  const id = normalizePageIconColorId(color) as IconColorId;
  return PAGE_ICON_COLOR_STYLES[id]?.fill ?? PAGE_ICON_COLOR_STYLES.grey.fill;
}
