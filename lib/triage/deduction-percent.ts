/** Default deductible % by Schedule C line (aligned with analyze-transactions). */
const CATEGORY_DEDUCTION_DEFAULTS: Record<string, number> = {
  "24b": 50,
  "24a": 100,
  "18": 100,
  "8": 100,
  "9": 100,
  "25": 100,
  "27a": 100,
  "27": 100,
  "23": 100,
  "21": 100,
  "15": 100,
  "17": 100,
  "11": 100,
  "10": 100,
  "13": 100,
  "16b": 100,
  "22": 100,
  "26": 100,
};

import { normalizeScheduleLineKey } from "@/lib/triage/schedule-c-display";

export function defaultDeductionPercent(input: {
  scheduleCLine?: string | null;
  isMeal?: boolean;
  isTravel?: boolean;
}): number {
  if (input.isMeal && !input.isTravel) return 50;
  if (input.isMeal && input.isTravel) return 100;
  const key = normalizeScheduleLineKey(input.scheduleCLine);
  if (!key) return 100;
  return CATEGORY_DEDUCTION_DEFAULTS[key] ?? 100;
}

/** Stored deduction % for editing, or line default — not scaled by Partial business_pct. */
export function storedDeductionPercent(input: {
  deduction_percent?: number | null;
  schedule_c_line?: string | null;
  is_meal?: boolean | null;
  is_travel?: boolean | null;
}): number {
  if (input.deduction_percent != null && Number.isFinite(Number(input.deduction_percent))) {
    return Math.min(100, Math.max(0, Math.round(Number(input.deduction_percent))));
  }
  return defaultDeductionPercent({
    scheduleCLine: input.schedule_c_line,
    isMeal: Boolean(input.is_meal),
    isTravel: Boolean(input.is_travel),
  });
}

/** % to show in tax sidebar chips — matches tax list "Y% of $X" display. */
export function effectivePanelDeductionPercent(input: {
  marker?: string | null;
  business_pct?: number | null;
  deduction_percent?: number | null;
  schedule_c_line?: string | null;
  is_meal?: boolean | null;
  is_travel?: boolean | null;
}): number {
  const stored =
    input.deduction_percent != null && Number.isFinite(Number(input.deduction_percent))
      ? Math.min(100, Math.max(0, Math.round(Number(input.deduction_percent))))
      : null;

  if (stored != null && stored < 100) return stored;

  if (input.marker === "Partial") {
    return Math.min(100, Math.max(0, Math.round(Number(input.business_pct ?? 50))));
  }

  return storedDeductionPercent(input);
}

export function effectiveDisplayPercent(input: {
  marker?: string | null;
  business_pct?: number | null;
  deduction_percent?: number | null;
}): number | null {
  const stored =
    input.deduction_percent != null && Number.isFinite(Number(input.deduction_percent))
      ? Math.min(100, Math.max(0, Math.round(Number(input.deduction_percent))))
      : null;

  if (stored != null && stored < 100) return stored;

  if (input.marker === "Partial") {
    const biz = Math.min(100, Math.max(0, Math.round(Number(input.business_pct ?? 50))));
    if (biz < 100) return biz;
  }

  return null;
}

/** Deduction % for sidebar chips — matches list display when present, else line defaults. */
export function panelChipDeductionPercent(input: {
  marker?: string | null;
  business_pct?: number | null;
  deduction_percent?: number | null;
  schedule_c_line?: string | null;
  is_meal?: boolean | null;
  is_travel?: boolean | null;
}): number {
  return effectiveDisplayPercent(input) ?? effectivePanelDeductionPercent(input);
}

export function resolveTransactionDeductionPercent(input: {
  marker?: string | null;
  business_pct?: number | null;
  deduction_percent?: number | null;
  schedule_c_line?: string | null;
  is_meal?: boolean | null;
  is_travel?: boolean | null;
}): number {
  if (input.deduction_percent != null && Number.isFinite(Number(input.deduction_percent))) {
    return Math.min(100, Math.max(0, Math.round(Number(input.deduction_percent))));
  }
  const marker = input.marker ?? "Business";
  if (marker === "Personal") return 0;
  return resolveTriageDeductionPercent({
    marker: marker as "Personal" | "Business" | "Partial",
    businessPct: marker === "Partial" ? (input.business_pct ?? 50) : 100,
    scheduleCLine: input.schedule_c_line,
    isMeal: Boolean(input.is_meal),
    isTravel: Boolean(input.is_travel),
  });
}

export function resolveTriageDeductionPercent(input: {
  marker: "Personal" | "Business" | "Partial";
  businessPct: number;
  scheduleCLine?: string | null;
  deductionPercent?: number | null;
  isMeal?: boolean;
  isTravel?: boolean;
}): number {
  if (input.marker === "Personal") return 0;
  if (input.deductionPercent != null && Number.isFinite(input.deductionPercent)) {
    return Math.min(100, Math.max(0, Math.round(input.deductionPercent)));
  }
  if (input.marker === "Business") {
    return defaultDeductionPercent(input);
  }
  const lineDefault = defaultDeductionPercent(input);
  const scaled = Math.round((lineDefault * input.businessPct) / 100);
  return Math.min(100, Math.max(0, scaled));
}
