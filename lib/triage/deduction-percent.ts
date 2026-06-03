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
