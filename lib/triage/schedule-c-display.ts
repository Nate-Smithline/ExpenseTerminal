import {
  SCHEDULE_C_LINE_MAP,
  SCHEDULE_C_LINES,
  type ScheduleCLine,
} from "@/lib/tax/schedule-c-lines";

/** Normalize AI line keys (e.g. "27a", "Line 18") to a map key. */
export function normalizeScheduleLineKey(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const trimmed = raw.replace(/^Line\s*/i, "").trim();
  if (!trimmed) return null;
  if (SCHEDULE_C_LINE_MAP.has(trimmed)) return trimmed;
  const base = trimmed.replace(/[a-z]+$/i, "");
  if (base && SCHEDULE_C_LINE_MAP.has(base)) return base;
  return trimmed;
}

export function scheduleLineByKey(line: string | null | undefined): ScheduleCLine | null {
  const key = normalizeScheduleLineKey(line);
  if (!key) return null;
  return SCHEDULE_C_LINE_MAP.get(key) ?? null;
}

export function categoryLabelForLine(line: string | null | undefined): string | null {
  return scheduleLineByKey(line)?.label ?? null;
}

export function formatScheduleCLine(line: string | null | undefined): string {
  const entry = scheduleLineByKey(line);
  if (!entry) return "Not set";
  return `Line ${entry.line} · ${entry.label}`;
}

/** Compact label for inline card rows. */
export function formatScheduleCLineShort(line: string | null | undefined): string {
  const entry = scheduleLineByKey(line);
  if (!entry) return "—";
  return `${entry.line} · ${entry.label}`;
}

export function parseAiSuggestions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, 6);
}

export { SCHEDULE_C_LINES };
