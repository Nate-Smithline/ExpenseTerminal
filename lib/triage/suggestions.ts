import type { Marker } from "@/components/MarkerPill";

export type TriageSuggestion = {
  marker: Marker;
  businessPct: number;
  confidence: number;
  why: string;
};

/** Map AI analyze output to a Business/Personal/Partial suggestion for triage cards. */
export function suggestionFromAiFields(tx: {
  ai_confidence?: number | null;
  ai_reasoning?: string | null;
  deductibility?: string | null;
  category?: string | null;
}): TriageSuggestion {
  const conf = tx.ai_confidence != null ? Number(tx.ai_confidence) : 0.5;
  const why = tx.ai_reasoning?.trim() ?? "";

  const deduct = (tx as { deductibility?: string }).deductibility;
  if (deduct === "likely_personal") {
    return { marker: "Personal", businessPct: 0, confidence: conf, why };
  }
  if (deduct === "likely_deductible") {
    return { marker: "Business", businessPct: 100, confidence: conf, why };
  }
  if (deduct === "needs_review") {
    return { marker: "Partial", businessPct: 50, confidence: conf, why };
  }

  // Infer from category keywords when deductibility not stored on row
  const cat = (tx.category ?? "").toLowerCase();
  if (/personal|grocery|groceries|rent|mortgage|gift/.test(cat)) {
    return { marker: "Personal", businessPct: 0, confidence: conf * 0.9, why };
  }
  if (/software|saas|office|contract|client|business/.test(cat)) {
    return { marker: "Business", businessPct: 100, confidence: conf * 0.9, why };
  }

  return { marker: "Partial", businessPct: 50, confidence: conf * 0.7, why };
}

export function deductibilityFromMarker(marker: Marker): string {
  if (marker === "Personal") return "likely_personal";
  if (marker === "Business") return "likely_deductible";
  return "needs_review";
}
