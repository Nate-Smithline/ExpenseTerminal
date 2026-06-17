import type { TaxDraft } from "@/lib/triage/queue-map";
import { categoryLabelForLine, normalizeScheduleLineKey } from "@/lib/triage/schedule-c-display";

export function normalizedTaxDraftLine(line: string | null | undefined): string | null {
  return normalizeScheduleLineKey(line) ?? (line?.trim() || null);
}

export function isExpenseTriageComplete(draft: TaxDraft | undefined): boolean {
  if (!draft) return false;
  if (!normalizedTaxDraftLine(draft.scheduleCLine)) return false;
  const reason = draft.businessPurpose?.trim() || draft.quickLabel?.trim();
  return Boolean(reason);
}

export function categoryForTaxDraftLine(line: string | null | undefined): string | null {
  return categoryLabelForLine(normalizedTaxDraftLine(line) ?? line);
}
