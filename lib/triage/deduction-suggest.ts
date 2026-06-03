import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeVendor } from "@/lib/vendor-matching";
import {
  categoryLabelForLine,
  normalizeScheduleLineKey,
  parseAiSuggestions,
} from "@/lib/triage/schedule-c-display";
import { defaultDeductionPercent } from "@/lib/triage/deduction-percent";
import {
  applyCategorizationGuardrails,
  getDeterministicMealResult,
  shouldUseVendorPatternCache,
  toCategorizeContext,
} from "@/lib/ai/categorize-shared";

export type DeductionSuggestResult = {
  scheduleCLine: string | null;
  category: string | null;
  quickLabels: string[];
  businessPurpose: string | null;
  deductionPercent: number;
  isMeal: boolean;
  isTravel: boolean;
  fromCache: boolean;
};

const SYSTEM_PROMPT = `You categorize a single business expense for IRS Schedule C.
Return ONLY JSON: {"scheduleCLine":"24b","category":"Meals","quickLabels":["Business Meal","Client Dinner"],"businessPurpose":"Short audit reason max 12 words","isMeal":true,"isTravel":false}
Use scheduleCLine as KEY only (8, 18, 24b, 27a, etc). Restaurants and food merchants → 24b Meals, never 18 Office expense. quickLabels: 2-4 IRS-defensible reasons.`;

type TxRow = {
  id: string;
  vendor: string;
  amount: number;
  date: string;
  category: string | null;
  schedule_c_line: string | null;
  business_purpose: string | null;
  ai_suggestions: unknown;
  description: string | null;
  plaid_category: string | null;
  hint_plaid_category: string | null;
  vendor_normalized: string | null;
  is_meal: boolean | null;
  is_travel: boolean | null;
  deduction_percent: number | null;
};

function rowToResult(
  row: TxRow,
  fromCache: boolean,
): DeductionSuggestResult {
  const scheduleCLine = normalizeScheduleLineKey(row.schedule_c_line);
  const category =
    row.category ?? categoryLabelForLine(scheduleCLine) ?? null;
  const quickLabels = parseAiSuggestions(row.ai_suggestions);
  const isMeal =
    row.is_meal ?? (category?.toLowerCase().includes("meal") ?? false);
  const isTravel = row.is_travel ?? false;
  const businessPurpose = row.business_purpose?.trim() || null;

  return {
    scheduleCLine,
    category,
    quickLabels,
    businessPurpose:
      businessPurpose ||
      quickLabels[0] ||
      null,
    deductionPercent:
      row.deduction_percent ??
      defaultDeductionPercent({ scheduleCLine, isMeal, isTravel }),
    isMeal,
    isTravel,
    fromCache,
  };
}

function hasCachedTaxFields(row: TxRow): boolean {
  const line = normalizeScheduleLineKey(row.schedule_c_line);
  const suggestions = parseAiSuggestions(row.ai_suggestions);
  const purpose = row.business_purpose?.trim();
  return Boolean(line && (purpose || suggestions.length > 0));
}

function deterministicToSuggest(
  row: TxRow,
  det: ReturnType<typeof getDeterministicMealResult>,
): DeductionSuggestResult | null {
  if (!det) return null;
  const scheduleCLine = normalizeScheduleLineKey(det.scheduleCLine);
  const quickLabels = det.quickLabels ?? [];
  return {
    scheduleCLine,
    category: det.category,
    quickLabels,
    businessPurpose:
      det.reasoning?.trim().slice(0, 72) || quickLabels[0] || null,
    deductionPercent: det.suggestedDeductionPct ?? 50,
    isMeal: true,
    isTravel: false,
    fromCache: false,
  };
}

async function loadVendorPattern(
  supabase: SupabaseClient,
  userId: string,
  row: TxRow,
): Promise<DeductionSuggestResult | null> {
  const vendorNormalized = row.vendor_normalized || normalizeVendor(row.vendor);
  const ctx = toCategorizeContext(row);

  const { data } = await (supabase as any)
    .from("vendor_patterns")
    .select(
      "category,schedule_c_line,deduction_percent,quick_labels,confidence",
    )
    .eq("user_id", userId)
    .eq("vendor_normalized", vendorNormalized)
    .maybeSingle();

  if (!data?.schedule_c_line) return null;
  if (!shouldUseVendorPatternCache(ctx, data)) return null;

  const scheduleCLine = normalizeScheduleLineKey(data.schedule_c_line);
  const quickLabels = parseAiSuggestions(data.quick_labels);
  const isMeal =
    (data.category as string | null)?.toLowerCase().includes("meal") ?? false;

  return {
    scheduleCLine,
    category:
      (data.category as string) ?? categoryLabelForLine(scheduleCLine),
    quickLabels,
    businessPurpose: quickLabels[0] ?? null,
    deductionPercent:
      data.deduction_percent ??
      defaultDeductionPercent({ scheduleCLine, isMeal, isTravel: false }),
    isMeal,
    isTravel: false,
    fromCache: true,
  };
}

async function suggestWithAi(row: TxRow): Promise<DeductionSuggestResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const user = [
    `Vendor: ${row.vendor}`,
    `Amount: $${Math.abs(Number(row.amount)).toFixed(2)}`,
    `Date: ${row.date}`,
    row.description ? `Memo: ${row.description}` : null,
    row.category ? `Hint category: ${row.category}` : null,
    row.plaid_category ? `Plaid: ${row.plaid_category}` : null,
    row.hint_plaid_category && row.hint_plaid_category !== row.plaid_category
      ? `Plaid hint: ${row.hint_plaid_category}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: user }],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return null;

    const raw = block.text.trim().replace(/^```json?\s*|\s*```$/g, "");
    const parsed = JSON.parse(raw) as {
      scheduleCLine?: string;
      category?: string;
      quickLabels?: string[];
      businessPurpose?: string;
      isMeal?: boolean;
      isTravel?: boolean;
    };

    const guarded = applyCategorizationGuardrails(
      {
        id: row.id,
        category: parsed.category?.trim() || "Other expenses",
        scheduleCLine: parsed.scheduleCLine ?? "27a",
        confidence: 0.75,
        quickLabels: parsed.quickLabels,
        isMeal: parsed.isMeal,
        isTravel: parsed.isTravel,
      },
      toCategorizeContext(row),
    );
    const scheduleCLine = normalizeScheduleLineKey(guarded.scheduleCLine);
    const category =
      guarded.category?.trim() ||
      categoryLabelForLine(scheduleCLine) ||
      null;
    const quickLabels = (parsed.quickLabels ?? [])
      .filter((s) => typeof s === "string" && s.trim())
      .map((s) => s.trim())
      .slice(0, 4);
    const isMeal = guarded.isMeal ?? scheduleCLine === "24b";
    const isTravel = guarded.isTravel ?? false;

    return {
      scheduleCLine,
      category,
      quickLabels,
      businessPurpose:
        parsed.businessPurpose?.trim().slice(0, 72) ||
        quickLabels[0] ||
        null,
      deductionPercent: defaultDeductionPercent({
        scheduleCLine,
        isMeal,
        isTravel,
      }),
      isMeal,
      isTravel,
      fromCache: false,
    };
  } catch {
    return null;
  }
}

export async function suggestDeductionFields(
  supabase: SupabaseClient,
  userId: string,
  transactionId: string,
): Promise<DeductionSuggestResult | null> {
  const { data: tx, error } = await (supabase as any)
    .from("transactions")
    .select(
      "id,vendor,amount,date,category,schedule_c_line,business_purpose,ai_suggestions,description,plaid_category,hint_plaid_category,vendor_normalized,is_meal,is_travel,deduction_percent",
    )
    .eq("id", transactionId)
    .eq("user_id", userId)
    .single();

  if (error || !tx) return null;

  const row = tx as TxRow;
  if (hasCachedTaxFields(row)) {
    return rowToResult(row, true);
  }

  const fromDeterministic = deterministicToSuggest(
    row,
    getDeterministicMealResult(toCategorizeContext(row)),
  );
  if (fromDeterministic) return fromDeterministic;

  const fromPattern = await loadVendorPattern(supabase, userId, row);
  if (fromPattern) return fromPattern;

  const fromAi = await suggestWithAi(row);
  if (fromAi) return fromAi;

  return rowToResult(row, true);
}
