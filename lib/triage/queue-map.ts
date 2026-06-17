import type { Marker } from "@/components/MarkerPill";
import { normalizeVendor } from "@/lib/vendor-matching";
import { suggestionFromAiFields } from "@/lib/triage/suggestions";
import { parseAiSuggestions } from "@/lib/triage/schedule-c-display";
import { normalizedTaxDraftLine, categoryForTaxDraftLine } from "@/lib/triage/tax-draft";

export type TriageQueueItem = {
  id: string;
  date: string;
  vendor: string;
  vendorKey: string;
  seen: number;
  source: string;
  amount: number;
  cat: string;
  conf: number;
  suggest: Marker;
  pct: number;
  why: string;
  transactionType: "income" | "expense";
  scheduleCLine: string | null;
  category: string | null;
  reasonSuggestions: string[];
  businessPurpose: string | null;
  quickLabel: string | null;
  deductionPercent: number | null;
  isMeal: boolean;
  isTravel: boolean;
};

type TxRow = {
  id: string;
  date: string;
  vendor: string;
  vendor_normalized: string | null;
  amount: number | string;
  category: string | null;
  schedule_c_line: string | null;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  ai_suggestions: unknown;
  business_purpose: string | null;
  quick_label: string | null;
  deduction_percent: number | null;
  description: string | null;
  is_meal: boolean | null;
  is_travel: boolean | null;
  transaction_type: string | null;
  data_source_id: string | null;
  data_sources?: { name?: string; institution?: string; mask?: string } | null;
};

function formatSource(ds: TxRow["data_sources"]): string {
  if (!ds) return "Manual";
  const inst = ds.institution || ds.name || "Account";
  const mask = ds.mask ? ` ·· ${ds.mask}` : "";
  return `${inst}${mask}`;
}

function markerToSuggestKey(marker: Marker): string {
  if (marker === "Personal") return "personal";
  if (marker === "Business") return "business";
  if (marker === "Partial") return "partial";
  return "partial";
}

export function mapTransactionToQueueItem(
  tx: TxRow,
  seenByVendor: Map<string, number>,
): TriageQueueItem {
  const vendorKey = tx.vendor_normalized || normalizeVendor(tx.vendor);
  const suggestion = suggestionFromAiFields({
    ai_confidence: tx.ai_confidence,
    ai_reasoning: tx.ai_reasoning,
    category: tx.category,
  });
  const amount = Number(tx.amount);
  const transactionType =
    tx.transaction_type === "income" ? "income" : "expense";

  const reasonSuggestions = parseAiSuggestions(tx.ai_suggestions);
  const isMeal =
    tx.is_meal ?? (tx.category?.toLowerCase().includes("meal") ?? false);
  const isTravel = tx.is_travel ?? false;

  return {
    id: tx.id,
    date: typeof tx.date === "string" ? tx.date.slice(0, 10) : String(tx.date),
    vendor: tx.vendor,
    vendorKey,
    seen: seenByVendor.get(vendorKey) ?? 0,
    source: formatSource(tx.data_sources),
    amount,
    cat: tx.category ?? "Uncategorized",
    conf: suggestion.confidence,
    suggest: suggestion.marker ?? "Partial",
    pct: suggestion.businessPct / 100,
    why: suggestion.why,
    transactionType,
    scheduleCLine: tx.schedule_c_line,
    category: tx.category,
    reasonSuggestions,
    businessPurpose: tx.business_purpose,
    quickLabel: tx.quick_label,
    deductionPercent: tx.deduction_percent,
    isMeal,
    isTravel,
  };
}

export type TaxDraft = {
  scheduleCLine: string | null;
  category: string | null;
  quickLabel: string | null;
  businessPurpose: string | null;
};

export function taxDraftFromQueueItem(item: TriageQueueItem): TaxDraft {
  const line = normalizedTaxDraftLine(item.scheduleCLine);
  const purpose =
    item.businessPurpose?.trim() ||
    item.quickLabel?.trim() ||
    item.reasonSuggestions[0] ||
    null;
  return {
    scheduleCLine: line,
    category: item.category ?? categoryForTaxDraftLine(line),
    quickLabel: item.quickLabel ?? item.reasonSuggestions[0] ?? null,
    businessPurpose: purpose,
  };
}

export { markerToSuggestKey };
