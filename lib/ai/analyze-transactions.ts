/**
 * Core AI transaction analysis engine — non-streaming, safe to call from cron jobs.
 *
 * The HTTP route at /api/transactions/analyze uses a streaming version of this same
 * logic for real-time UI progress. This module handles the same categorization in a
 * single awaitable call, which is what the nightly cron needs after each sync.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withRetry } from "@/lib/api/retry";
import { normalizeVendor } from "@/lib/vendor-matching";
import { applyAllAutoSortRulesForUser } from "@/lib/auto-sort";

// ─── Prompt ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You categorize business transactions for IRS Schedule C.

Categories (Line: Name). Return scheduleCLine as the KEY ONLY (e.g. "8", "27a", "24b"), not "Line 8":
8:Advertising, 9:Car/truck, 10:Commissions/fees, 11:Contract labor,
13:Depreciation, 15:Insurance, 16b:Other interest, 17:Legal/professional,
18:Office expense, 21:Rent/lease, 22:Repairs, 23:Supplies, 24a:Travel,
24b:Meals, 25:Utilities, 26:Wages, 27a:Other expenses

Rules:
- Prefer the MOST SPECIFIC category. Use 27a (Other expenses) ONLY when no other line fits.
- Office supplies, software for office work, productivity tools, and general business SaaS → 18 (Office expense). Do NOT use 27a for these.
- Phone, internet, cloud hosting, business phone → 25 (Utilities).
- Meals → 24b (50% deductible; 100% if overnight travel).
- Coworking, office rent → 21.
- Equipment >$2500 → 13.
- Advertising / marketing / Google Ads → 8.
- Legal, accounting, tax prep, consulting → 17.
- Use 27a only for: education, professional memberships, bank fees, or truly miscellaneous expenses that don't fit 8–26. When unsure between 18 and 27a for software/tools, prefer 18.
- Personal expenses → mark "likely_personal"
- If ambiguous → "needs_review"

Quick labels: Return 2-4 specific, IRS-defensible business reasons per transaction.

Also estimate a suggested deduction percentage:
- 50 for meals (unless clearly travel-related, then 100)
- 0 for likely_personal
- 100 for most clear business expenses
- Lower values (25-75) for mixed-use items

Return ONLY a JSON array. No markdown fences.`;

// ─── Constants ───────────────────────────────────────────────────────────────

const BATCH_SIZE = 25;
const DB_FETCH_CHUNK = 80;
const BATCH_CONCURRENCY = 3;
const ANTHROPIC_TIMEOUT_MS = 60_000;

const CATEGORY_DEDUCTION_DEFAULTS: Record<string, number> = {
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

// ─── Types ────────────────────────────────────────────────────────────────────

type TransactionRow = {
  id: string;
  vendor: string;
  amount: number;
  date: string;
  category: string | null;
  vendor_normalized: string | null;
  is_meal: boolean | null;
  is_travel: boolean | null;
  eligible_for_ai: boolean | null;
  status?: string | null;
};

type VendorPatternRow = {
  vendor_normalized: string;
  category: string | null;
  schedule_c_line: string | null;
  deduction_percent: number | null;
  confidence: number | null;
  quick_labels: string[] | null;
};

type ParsedResult = {
  id: string;
  category: string;
  scheduleCLine: string;
  confidence: number;
  quickLabels?: string[];
  suggestedDeductionPct?: number;
  deductibility?: string;
  isMeal?: boolean;
  isTravel?: boolean;
};

export type AnalysisRunResult = {
  successful: number;
  failed: number;
  cachedCount: number;
  total: number;
  skipped: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDefaultDeduction(
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

function normalizeScheduleLine(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.replace(/^Line\s*/i, "").trim() || null;
}

function buildBatchPrompt(
  txns: { id: string; vendor: string; amount: number; date: string; category?: string }[]
): string {
  const lines = txns.map(
    (t) =>
      `${t.id}|${t.vendor}|$${Math.abs(t.amount).toFixed(2)}|${t.date}${t.category ? `|${t.category}` : ""}`
  );
  return `Categorize these ${txns.length} transactions. Return JSON array:
[{"id":"...","category":"Category Name","scheduleCLine":"27a","confidence":0.85,"quickLabels":["Specific Reason 1","Specific Reason 2"],"suggestedDeductionPct":100,"deductibility":"likely_deductible|needs_review|likely_personal","isMeal":false,"isTravel":false}]

Use scheduleCLine as the line KEY only (e.g. "8", "18", "24b", "27a"), not "Line 27a".

id|vendor|amount|date[|hint]
${lines.join("\n")}`;
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      const item = items[i];
      if (item === undefined) break;
      results[i] = await fn(item, i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

async function fetchTransactions(
  supabase: SupabaseClient,
  ids: string[],
  userId: string
): Promise<TransactionRow[]> {
  const all: TransactionRow[] = [];
  for (let i = 0; i < ids.length; i += DB_FETCH_CHUNK) {
    const chunk = ids.slice(i, i + DB_FETCH_CHUNK);
    const { data } = await (supabase as any)
      .from("transactions")
      .select("id,vendor,amount,date,category,vendor_normalized,is_meal,is_travel,eligible_for_ai,status")
      .in("id", chunk)
      .eq("user_id", userId);
    if (data) all.push(...data);
  }
  return all;
}

async function getCachedPatterns(
  supabase: SupabaseClient,
  userId: string,
  vendors: string[]
): Promise<Map<string, VendorPatternRow>> {
  const map = new Map<string, VendorPatternRow>();
  const unique = [...new Set(vendors)];
  for (let i = 0; i < unique.length; i += DB_FETCH_CHUNK) {
    const chunk = unique.slice(i, i + DB_FETCH_CHUNK);
    const { data } = await (supabase as any)
      .from("vendor_patterns")
      .select("vendor_normalized,category,schedule_c_line,deduction_percent,confidence,quick_labels")
      .eq("user_id", userId)
      .in("vendor_normalized", chunk);
    if (data) {
      for (const row of data as VendorPatternRow[]) {
        map.set(row.vendor_normalized, row);
      }
    }
  }
  return map;
}

async function upsertVendorPattern(
  supabase: SupabaseClient,
  userId: string,
  vendorNormalized: string,
  result: ParsedResult
): Promise<void> {
  const deductPct =
    result.suggestedDeductionPct ??
    getDefaultDeduction(
      result.scheduleCLine,
      result.isMeal ?? false,
      result.isTravel ?? false
    );
  await (supabase as any).from("vendor_patterns").upsert(
    {
      user_id: userId,
      vendor_normalized: vendorNormalized,
      category: result.category,
      schedule_c_line: result.scheduleCLine,
      quick_labels: result.quickLabels ?? [],
      confidence: result.confidence,
      deduction_percent: deductPct,
      times_used: 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,vendor_normalized" }
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Run AI categorization on a set of transaction IDs.
 *
 * Called by:
 * - /api/cron/transaction-import — automatically after each nightly sync
 * - (optionally) any future background job
 *
 * Not for the HTTP analyze route, which uses its own streaming path.
 */
export async function runAnalysisForIds(
  supabase: SupabaseClient,
  userId: string,
  transactionIds: string[],
  businessIndustry?: string | null
): Promise<AnalysisRunResult> {
  if (transactionIds.length === 0) {
    return { successful: 0, failed: 0, cachedCount: 0, total: 0, skipped: 0 };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !apiKey.startsWith("sk-ant-")) {
    console.warn("[analyze-transactions] ANTHROPIC_API_KEY missing — skipping AI analysis");
    return { successful: 0, failed: 0, cachedCount: 0, total: transactionIds.length, skipped: transactionIds.length };
  }

  const transactions = await fetchTransactions(supabase, transactionIds, userId);
  if (transactions.length === 0) {
    return { successful: 0, failed: 0, cachedCount: 0, total: 0, skipped: 0 };
  }

  try {
    await applyAllAutoSortRulesForUser(supabase, userId);
  } catch {
    // Saved rules are best-effort before AI
  }

  const refreshed = await fetchTransactions(supabase, transactionIds, userId);
  const pendingTransactions = refreshed.filter(
    (t) => t.status === "pending" && !t.category,
  );
  if (pendingTransactions.length === 0) {
    return {
      successful: transactionIds.length,
      failed: 0,
      cachedCount: 0,
      total: transactionIds.length,
      skipped: 0,
    };
  }

  const vendorNorms = pendingTransactions.map(
    (t) => t.vendor_normalized || normalizeVendor(t.vendor)
  );

  let cachedPatterns = new Map<string, VendorPatternRow>();
  try {
    cachedPatterns = await getCachedPatterns(supabase, userId, vendorNorms);
  } catch {
    // vendor_patterns table may not exist yet in older schemas
  }

  const needsAI: TransactionRow[] = [];
  let successful = transactionIds.length - pendingTransactions.length;
  let failed = 0;
  let cachedCount = 0;

  // ── Apply cache hits first ─────────────────────────────────────────────────
  for (const t of pendingTransactions) {
    const vn = t.vendor_normalized || normalizeVendor(t.vendor);
    const cached = cachedPatterns.get(vn);
    if (cached?.category) {
      const deductPct =
        cached.deduction_percent ??
        getDefaultDeduction(cached.schedule_c_line, t.is_meal ?? false, t.is_travel ?? false);
      const { error } = await (supabase as any)
        .from("transactions")
        .update({
          category: cached.category,
          schedule_c_line: cached.schedule_c_line,
          ai_confidence: cached.confidence ?? 0.8,
          ai_suggestions: cached.quick_labels ?? [],
          deduction_percent: deductPct,
          updated_at: new Date().toISOString(),
        })
        .eq("id", t.id)
        .eq("user_id", userId);
      if (!error) {
        cachedCount++;
        successful++;
      } else {
        needsAI.push(t);
      }
    } else if (cached?.deduction_percent === 0) {
      const { error } = await (supabase as any)
        .from("transactions")
        .update({
          status: "personal",
          deduction_percent: 0,
          quick_label: "Personal",
          ai_suggestions: ["Personal"],
          updated_at: new Date().toISOString(),
        })
        .eq("id", t.id)
        .eq("user_id", userId);
      if (!error) {
        cachedCount++;
        successful++;
      } else {
        needsAI.push(t);
      }
    } else {
      needsAI.push(t);
    }
  }

  if (needsAI.length === 0) {
    return { successful, failed, cachedCount, total: transactions.length, skipped: 0 };
  }

  // ── AI batches ─────────────────────────────────────────────────────────────
  const anthropic = new Anthropic({ apiKey, timeout: ANTHROPIC_TIMEOUT_MS });

  const effectiveSystemPrompt = businessIndustry
    ? `${SYSTEM_PROMPT}\n\nBusiness context: The user's business industry is "${businessIndustry}". Use this as one factor when evaluating deductibility.`
    : SYSTEM_PROMPT;

  const batches: TransactionRow[][] = [];
  for (let i = 0; i < needsAI.length; i += BATCH_SIZE) {
    batches.push(needsAI.slice(i, i + BATCH_SIZE));
  }

  const batchResults = await runWithConcurrency(
    batches,
    BATCH_CONCURRENCY,
    async (batch) => {
      let batchSuccess = 0;
      let batchFailed = 0;

      // Deduplicate by vendor: one AI call per unique vendor in batch
      const vendorToTxns = new Map<string, TransactionRow[]>();
      for (const t of batch) {
        const vn = t.vendor_normalized || normalizeVendor(t.vendor);
        const list = vendorToTxns.get(vn) ?? [];
        list.push(t);
        vendorToTxns.set(vn, list);
      }
      const representatives = Array.from(vendorToTxns.values()).map((txns) => txns[0]!);
      const batchInput = representatives.map((t) => ({
        id: t.id,
        vendor: t.vendor,
        amount: Number(t.amount),
        date: t.date,
        category: t.category ?? undefined,
      }));

      try {
        const message = await withRetry(
          () =>
            anthropic.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 4096,
              system: effectiveSystemPrompt,
              messages: [{ role: "user", content: buildBatchPrompt(batchInput) }],
            }),
          { maxRetries: 3, initialMs: 1000, maxMs: 30_000 }
        );

        const first = message.content[0];
        if (!first || first.type !== "text") {
          batchFailed += batch.length;
          return { batchSuccess, batchFailed };
        }

        let jsonText = first.text.trim();
        if (jsonText.startsWith("```")) {
          jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }

        let parsedArray: ParsedResult[];
        try {
          const raw = JSON.parse(jsonText);
          parsedArray = Array.isArray(raw) ? raw : [raw];
        } catch {
          batchFailed += batch.length;
          return { batchSuccess, batchFailed };
        }

        const resultById = new Map<string, ParsedResult>();
        for (const r of parsedArray) {
          if (r.id) resultById.set(r.id, r);
        }

        for (const t of batch) {
          const vn = t.vendor_normalized || normalizeVendor(t.vendor);
          const rep = vendorToTxns.get(vn)?.[0];
          const result =
            resultById.get(rep?.id ?? t.id) ??
            resultById.get(t.id) ??
            parsedArray[0];

          if (!result?.category || !result?.scheduleCLine) {
            batchFailed++;
            continue;
          }

          const scheduleLine = normalizeScheduleLine(result.scheduleCLine) ?? result.scheduleCLine;
          const isMealResult = result.isMeal ?? result.category.toLowerCase().includes("meal");
          const isTravelResult = result.isTravel ?? false;
          const deductPct =
            result.deductibility === "likely_personal"
              ? 0
              : result.suggestedDeductionPct ??
                getDefaultDeduction(scheduleLine, isMealResult, isTravelResult);

          const { error } = await (supabase as any)
            .from("transactions")
            .update({
              category: result.category,
              schedule_c_line: scheduleLine,
              ai_confidence: result.confidence ?? 0.5,
              ai_suggestions: result.quickLabels ?? [],
              deduction_percent: deductPct,
              is_meal: isMealResult,
              is_travel: isTravelResult,
              updated_at: new Date().toISOString(),
            })
            .eq("id", t.id)
            .eq("user_id", userId);

          if (error) {
            batchFailed++;
            continue;
          }

          batchSuccess++;

          try {
            await upsertVendorPattern(supabase, userId, vn, {
              ...result,
              scheduleCLine: scheduleLine,
            });
          } catch {
            // vendor_patterns optional
          }
        }
      } catch (e) {
        console.error("[analyze-transactions] Batch error:", e instanceof Error ? e.message : e);
        batchFailed += batch.length;
      }

      return { batchSuccess, batchFailed };
    }
  );

  for (const r of batchResults) {
    successful += r.batchSuccess;
    failed += r.batchFailed;
  }

  return { successful, failed, cachedCount, total: transactions.length, skipped: 0 };
}
