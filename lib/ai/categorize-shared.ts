/**
 * Shared Schedule C categorization: prompts, Plaid/meal signals, and result guardrails.
 * Used by lib/ai/analyze-transactions.ts and /api/transactions/analyze.
 */

export const CATEGORIZE_SYSTEM_PROMPT = `You categorize business transactions for IRS Schedule C.

Categories (Line: Name). Return scheduleCLine as the KEY ONLY (e.g. "8", "27a", "24b"), not "Line 8":
8:Advertising, 9:Car/truck, 10:Commissions/fees, 11:Contract labor,
13:Depreciation, 15:Insurance, 16b:Other interest, 17:Legal/professional,
18:Office expense, 21:Rent/lease, 22:Repairs, 23:Supplies, 24a:Travel,
24b:Meals, 25:Utilities, 26:Wages, 27a:Other expenses

CRITICAL — Food & drink (always line 24b when applicable):
- Restaurants, cafes, coffee shops, bakeries, fast food, bars with food, catering, food delivery (DoorDash, Uber Eats, etc.) → scheduleCLine "24b", category "Meals", isMeal: true
- When plaid_hint contains FOOD_AND_DRINK (except GROCERIES) → 24b Meals. Trust plaid_hint over guessing from a short vendor name.
- NEVER put restaurants, food merchants, or meal delivery on line 18 (Office expense). Line 18 is only office supplies, stationery, and business software/SaaS — not food.

Other rules:
- Prefer the MOST SPECIFIC line. Use 27a only when nothing else fits.
- Phone, internet, cloud hosting → 25 (Utilities).
- Coworking, office rent → 21.
- Equipment >$2500 → 13.
- Advertising / marketing → 8.
- Legal, accounting, tax prep, consulting → 17.
- Groceries (FOOD_AND_DRINK_GROCERIES) → 23 Supplies if clearly business inventory; else needs_review or likely_personal — not 18.
- Personal expenses → deductibility "likely_personal"
- If ambiguous → "needs_review"

Quick labels: 2-4 IRS-defensible reasons. For meals use: "Business Meal", "Client Dinner", "Working Lunch", "Team Meal".

Deduction %: 50 for meals (100 if clearly travel-related), 0 for likely_personal, 100 for clear business expenses.

Include "reasoning": one short sentence (max 120 chars) for the user on business vs personal.

Return ONLY a JSON array. No markdown fences.`;

/** Minimum vendor_patterns.confidence before reusing without re-running AI */
export const VENDOR_PATTERN_MIN_CONFIDENCE = 0.82;

export type CategorizeTxContext = {
  id: string;
  vendor: string;
  amount: number;
  date: string;
  description?: string | null;
  plaid_category?: string | null;
  hint_plaid_category?: string | null;
  category?: string | null;
};

export type ParsedCategorization = {
  id: string;
  category: string;
  scheduleCLine: string;
  confidence: number;
  quickLabels?: string[];
  suggestedDeductionPct?: number;
  deductibility?: string;
  reasoning?: string;
  isMeal?: boolean;
  isTravel?: boolean;
};

export const CATEGORY_DEDUCTION_DEFAULTS: Record<string, number> = {
  "24b": 50,
  "24a": 100,
  "18": 100,
  "8": 100,
  "9": 100,
  "25": 100,
  "27a": 100,
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

export function getDefaultDeduction(
  scheduleCLine: string | null,
  isMeal: boolean,
  isTravel: boolean
): number {
  if (isMeal && !isTravel) return 50;
  if (isMeal && isTravel) return 100;
  if (!scheduleCLine) return 100;
  const line = scheduleCLine.replace(/^Line\s*/i, "").trim();
  return CATEGORY_DEDUCTION_DEFAULTS[line] ?? 100;
}

export function normalizeScheduleLine(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.replace(/^Line\s*/i, "").trim() || null;
}

function normalizePlaidToken(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

/** Plaid personal_finance_category.primary values that indicate a meal (not groceries). */
const PLAID_MEAL_PRIMARIES = new Set([
  "food_and_drink",
  "food_and_drink_restaurant",
  "food_and_drink_fast_food",
  "food_and_drink_coffee",
  "food_and_drink_other_food_and_drink",
  "food_and_drink_vending_machines",
]);

const PLAID_GROCERY = "food_and_drink_groceries";

const FOOD_VENDOR_RE =
  /\b(restaurants?|caf[eé]s?|coffee|espresso|bakery|bistro|grill|pizzeria|pizza|sushi|taco|taqueria|eatery|deli|diner|steakhouse|seafood|ramen|pho|bbq|brewpub|taproom|cantina|trattoria|osteria|brasserie|bagel|donut|doughnut|smoothie|juice\s*bar|food\s*hall|canteen|refectory|tea\s*house|wine\s*bar|gastropub)\b/i;

const FOOD_DELIVERY_RE =
  /\b(doordash|uber\s*eats|grubhub|postmates|seamless|caviar|instacart\s*market|favor\s*delivery)\b/i;

export function plaidCategorySignalsMeal(
  plaidCategory?: string | null,
  hintPlaid?: string | null
): boolean {
  for (const raw of [plaidCategory, hintPlaid]) {
    const t = normalizePlaidToken(raw);
    if (!t) continue;
    if (t === PLAID_GROCERY) return false;
    if (PLAID_MEAL_PRIMARIES.has(t)) return true;
    if (t.startsWith("food_and_drink") && !t.includes("grocer")) return true;
  }
  return false;
}

export function vendorTextSignalsMeal(vendor: string, description?: string | null): boolean {
  const hay = `${vendor} ${description ?? ""}`;
  if (FOOD_DELIVERY_RE.test(hay)) return true;
  if (FOOD_VENDOR_RE.test(hay)) return true;
  return false;
}

export function transactionSignalsMeal(ctx: {
  vendor: string;
  description?: string | null;
  plaid_category?: string | null;
  hint_plaid_category?: string | null;
}): boolean {
  return (
    plaidCategorySignalsMeal(ctx.plaid_category, ctx.hint_plaid_category) ||
    vendorTextSignalsMeal(ctx.vendor, ctx.description)
  );
}

/** High-confidence meal classification without calling the model. */
export function getDeterministicMealResult(
  ctx: CategorizeTxContext
): ParsedCategorization | null {
  const fromPlaid = plaidCategorySignalsMeal(ctx.plaid_category, ctx.hint_plaid_category);
  if (fromPlaid) {
    return {
      id: ctx.id,
      category: "Meals",
      scheduleCLine: "24b",
      confidence: 0.96,
      quickLabels: ["Business Meal", "Client Dinner", "Working Lunch"],
      suggestedDeductionPct: 50,
      deductibility: "needs_review",
      reasoning: "Food & drink merchant — tag business vs personal use.",
      isMeal: true,
      isTravel: false,
    };
  }

  if (vendorTextSignalsMeal(ctx.vendor, ctx.description)) {
    return {
      id: ctx.id,
      category: "Meals",
      scheduleCLine: "24b",
      confidence: 0.9,
      quickLabels: ["Business Meal", "Working Lunch", "Client Dinner"],
      suggestedDeductionPct: 50,
      deductibility: "needs_review",
      reasoning: "Looks like a restaurant or meal — confirm business use.",
      isMeal: true,
      isTravel: false,
    };
  }

  return null;
}

export function shouldUseVendorPatternCache(
  tx: CategorizeTxContext,
  cached: {
    category: string | null;
    schedule_c_line: string | null;
    confidence: number | null;
  }
): boolean {
  if (!cached.category) return false;
  if ((cached.confidence ?? 0) < VENDOR_PATTERN_MIN_CONFIDENCE) return false;

  if (transactionSignalsMeal(tx)) {
    const line = normalizeScheduleLine(cached.schedule_c_line);
    if (line !== "24b") return false;
    const cat = cached.category.toLowerCase();
    if (cat.includes("office")) return false;
  }

  return true;
}

const OFFICE_LINES = new Set(["18"]);

/** Fix model mistakes when food signals are present. */
export function applyCategorizationGuardrails(
  result: ParsedCategorization,
  ctx: CategorizeTxContext
): ParsedCategorization {
  const line = normalizeScheduleLine(result.scheduleCLine) ?? result.scheduleCLine;
  const mealSignal = transactionSignalsMeal(ctx);
  const officeMislabel =
    mealSignal &&
    (OFFICE_LINES.has(line) ||
      result.category.toLowerCase().includes("office"));

  if (!officeMislabel) {
    return {
      ...result,
      scheduleCLine: line,
      isMeal: result.isMeal ?? line === "24b",
    };
  }

  return {
    ...result,
    category: "Meals",
    scheduleCLine: "24b",
    isMeal: true,
    confidence: Math.max(result.confidence ?? 0.5, 0.88),
    suggestedDeductionPct: result.suggestedDeductionPct ?? 50,
    deductibility: result.deductibility === "likely_personal" ? "likely_personal" : "needs_review",
    reasoning:
      result.reasoning?.trim() ||
      "Restaurant or food merchant — meals are Schedule C line 24b, not office expense.",
    quickLabels: result.quickLabels?.length
      ? result.quickLabels
      : ["Business Meal", "Client Dinner", "Working Lunch"],
  };
}

function escapeField(s: string): string {
  return s.replace(/\|/g, "/").replace(/\n/g, " ").trim();
}

export function buildBatchPrompt(txns: CategorizeTxContext[]): string {
  const lines = txns.map((t) => {
    const parts = [
      t.id,
      escapeField(t.vendor),
      `$${Math.abs(t.amount).toFixed(2)}`,
      t.date,
    ];
    const memo = (t.description ?? "").trim();
    if (memo && memo.toLowerCase() !== t.vendor.trim().toLowerCase()) {
      parts.push(escapeField(memo.slice(0, 120)));
    }
    const plaid = t.plaid_category ?? t.hint_plaid_category;
    if (plaid?.trim()) {
      parts.push(escapeField(plaid.trim()));
    } else if (t.category?.trim()) {
      parts.push(`hint:${escapeField(t.category.trim())}`);
    }
    return parts.join("|");
  });

  return `Categorize these ${txns.length} transactions. Return JSON array:
[{"id":"...","category":"Category Name","scheduleCLine":"24b","confidence":0.85,"quickLabels":["Reason 1","Reason 2"],"suggestedDeductionPct":50,"deductibility":"likely_deductible|needs_review|likely_personal","reasoning":"One sentence","isMeal":true,"isTravel":false}]

Use scheduleCLine as the line KEY only (e.g. "8", "18", "24b", "27a").

Each input line: id|vendor|amount|date|[memo]|[plaid_hint or hint:category]
${lines.join("\n")}`;
}

export function toCategorizeContext(row: {
  id: string;
  vendor: string;
  amount: number | string;
  date: string;
  description?: string | null;
  plaid_category?: string | null;
  hint_plaid_category?: string | null;
  category?: string | null;
}): CategorizeTxContext {
  return {
    id: row.id,
    vendor: row.vendor,
    amount: typeof row.amount === "number" ? row.amount : Number(row.amount),
    date: row.date,
    description: row.description ?? null,
    plaid_category: row.plaid_category ?? null,
    hint_plaid_category: row.hint_plaid_category ?? null,
    category: row.category ?? null,
  };
}

export function shouldCacheVendorPattern(result: ParsedCategorization): boolean {
  return (result.confidence ?? 0) >= 0.75;
}

/** Extract Plaid primary category for storage (lowercase snake). */
export function plaidPrimaryFromTransaction(tx: {
  personal_finance_category?: { primary?: string; detailed?: string } | null;
}): string | null {
  const primary = tx.personal_finance_category?.primary;
  if (!primary?.trim()) return null;
  return primary.trim().toLowerCase().replace(/\s+/g, "_");
}
