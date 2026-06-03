import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, expensiveOpLimit } from "@/lib/middleware/rate-limit";
import { withRetry } from "@/lib/api/retry";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { transactionIdsBodySchema } from "@/lib/validation/schemas";
import { normalizeVendor } from "@/lib/vendor-matching";
import type { Database } from "@/lib/types/database";
import { getUserPlan } from "@/lib/billing/get-user-plan";
import {
  CATEGORIZE_SYSTEM_PROMPT,
  applyCategorizationGuardrails,
  buildBatchPrompt,
  getDefaultDeduction,
  getDeterministicMealResult,
  normalizeScheduleLine,
  shouldCacheVendorPattern,
  shouldUseVendorPatternCache,
  toCategorizeContext,
  type ParsedCategorization,
} from "@/lib/ai/categorize-shared";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"] & {
  description?: string | null;
  plaid_category?: string | null;
  hint_plaid_category?: string | null;
};

const BATCH_SIZE = 25;
const DB_FETCH_CHUNK = 80;
const BATCH_CONCURRENCY = 4;

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
      const result = await fn(item, i);
      results[i] = result;
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function extractError(e: unknown): string {
  if (e && typeof e === "object") {
    const err = e as Record<string, unknown>;
    const status = err.status as number | undefined;
    const errorObj = err.error as { type?: string; message?: string } | undefined;
    const message = (err.message as string) || "";
    if (status && errorObj?.message) return `[${status}] ${errorObj.type ?? "error"}: ${errorObj.message}`;
    if (status && message) return `[${status}] ${message}`;
    return `Anthropic error: ${message || String(e)}`;
  }
  return `Error: ${String(e)}`;
}

async function fetchTransactionsInChunks(
  supabase: Awaited<ReturnType<typeof createSupabaseRouteClient>>,
  ids: string[],
  userId: string,
): Promise<{ data: TransactionRow[]; error: string | null }> {
  const all: TransactionRow[] = [];
  for (let i = 0; i < ids.length; i += DB_FETCH_CHUNK) {
    const chunk = ids.slice(i, i + DB_FETCH_CHUNK);
    const txCols =
      "id,vendor,amount,date,description,category,plaid_category,hint_plaid_category,vendor_normalized,is_meal,is_travel,eligible_for_ai";
    const { data, error } = await (supabase as any)
      .from("transactions")
      .select(txCols)
      .in("id", chunk)
      .eq("user_id", userId);
    if (error) return { data: [], error: safeErrorMessage(error.message, "Failed to load transactions") };
    if (data) all.push(...(data as TransactionRow[]));
  }
  return { data: all, error: null };
}

async function getCachedPatterns(
  supabase: Awaited<ReturnType<typeof createSupabaseRouteClient>>,
  userId: string,
  vendors: string[],
): Promise<Map<string, Database["public"]["Tables"]["vendor_patterns"]["Row"]>> {
  const map = new Map<string, Database["public"]["Tables"]["vendor_patterns"]["Row"]>();
  if (vendors.length === 0) return map;
  const unique = [...new Set(vendors)];
  for (let i = 0; i < unique.length; i += DB_FETCH_CHUNK) {
    const chunk = unique.slice(i, i + DB_FETCH_CHUNK);
    const vpCols = "vendor_normalized,category,schedule_c_line,deduction_percent,confidence,quick_labels";
    const { data } = await (supabase as any)
      .from("vendor_patterns")
      .select(vpCols)
      .eq("user_id", userId)
      .in("vendor_normalized", chunk);
    if (data) {
      for (const row of data as Database["public"]["Tables"]["vendor_patterns"]["Row"][]) {
        map.set(row.vendor_normalized, row);
      }
    }
  }
  return map;
}

async function upsertVendorPattern(
  supabase: Awaited<ReturnType<typeof createSupabaseRouteClient>>,
  userId: string,
  vendorNormalized: string,
  result: ParsedCategorization,
) {
  if (!shouldCacheVendorPattern(result)) return;
  await (supabase as any)
    .from("vendor_patterns")
    .upsert(
      {
        user_id: userId,
        vendor_normalized: vendorNormalized,
        category: result.category,
        schedule_c_line: result.scheduleCLine,
        quick_labels: result.quickLabels ?? [],
        confidence: result.confidence,
        deduction_percent: result.suggestedDeductionPct ?? getDefaultDeduction(result.scheduleCLine, result.isMeal ?? false, result.isTravel ?? false),
        times_used: 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,vendor_normalized" }
    );
}

export async function POST(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const userId = auth.userId;
  const { success: rlOk } = await rateLimitForRequest(req, userId, expensiveOpLimit);
  if (!rlOk) {
    return new Response(JSON.stringify({ error: "Too many requests. Try again later." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }
  const supabase = authClient;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const parsed = transactionIdsBodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "transactionIds array (1-1000 UUIDs) required";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const ids = parsed.data.transactionIds;

  const plan = await getUserPlan(supabase, userId);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !apiKey.startsWith("sk-ant-")) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY missing or invalid format." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const { data: orgRow } = await (supabase as any)
    .from("org_settings")
    .select("business_industry")
    .eq("user_id", userId)
    .single();
  const businessIndustry: string | null = orgRow?.business_industry ?? null;

  const { data: fetchedTransactions, error: fetchError } = await fetchTransactionsInChunks(
    supabase as any, ids, userId,
  );
  if (fetchError) {
    return new Response(
      JSON.stringify({ error: `Database error: ${fetchError}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  const transactions = fetchedTransactions;

  if (transactions.length === 0) {
    return new Response(
      JSON.stringify({ error: "No matching transactions found." }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  const vendorNorms = transactions.map((t) => t.vendor_normalized || normalizeVendor(t.vendor));
  let cachedPatterns = new Map<string, Database["public"]["Tables"]["vendor_patterns"]["Row"]>();
  try {
    cachedPatterns = await getCachedPatterns(supabase as any, userId, vendorNorms);
  } catch {
    console.log("[analyze] vendor_patterns table not available, skipping cache");
  }

  const total = transactions.length;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: Record<string, unknown>) {
        try { controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n")); } catch { /* closed */ }
      }

      const needsAI: TransactionRow[] = [];
      let successful = 0;
      let failed = 0;
      let cachedCount = 0;

      for (const t of transactions) {
        const vn = t.vendor_normalized || normalizeVendor(t.vendor);
        const ctx = toCategorizeContext({
          id: t.id,
          vendor: t.vendor,
          amount: t.amount,
          date: t.date,
          description: t.description ?? null,
          plaid_category: t.plaid_category ?? null,
          hint_plaid_category: t.hint_plaid_category ?? null,
          category: t.category,
        });

        const deterministic = getDeterministicMealResult(ctx);
        if (deterministic) {
          const scheduleLine = normalizeScheduleLine(deterministic.scheduleCLine) ?? deterministic.scheduleCLine;
          const deductPct = deterministic.suggestedDeductionPct ?? 50;
          const { error: updateError } = await (supabase as any)
            .from("transactions")
            .update({
              category: deterministic.category,
              schedule_c_line: scheduleLine,
              ai_confidence: deterministic.confidence,
              ai_reasoning: deterministic.reasoning,
              ai_suggestions: deterministic.quickLabels ?? [],
              deduction_percent: deductPct,
              is_meal: true,
              is_travel: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", t.id)
            .eq("user_id", userId);

          if (!updateError) {
            cachedCount++;
            successful++;
            send({
              type: "success",
              id: t.id,
              vendor: t.vendor,
              category: deterministic.category,
              line: scheduleLine,
              confidence: deterministic.confidence,
              quickLabels: deterministic.quickLabels ?? [],
              deductionPct: deductPct,
              isMeal: true,
              isTravel: false,
              reasoning: deterministic.reasoning,
            });
            try {
              await upsertVendorPattern(supabase as any, userId, vn, {
                ...deterministic,
                scheduleCLine: scheduleLine,
              });
            } catch {
              /* optional */
            }
          } else {
            needsAI.push(t);
          }
          continue;
        }

        const cached = cachedPatterns.get(vn);
        if (cached && shouldUseVendorPatternCache(ctx, cached)) {
          const cachedDeduction = cached.deduction_percent ?? getDefaultDeduction(
            cached.schedule_c_line, 
            t.is_meal ?? false, 
            t.is_travel ?? false
          );

          const { error: updateError } = await (supabase as any)
            .from("transactions")
            .update({
              category: cached.category,
              schedule_c_line: cached.schedule_c_line,
              ai_confidence: cached.confidence ?? 0.8,
              ai_suggestions: cached.quick_labels ?? [],
              deduction_percent: cachedDeduction,
              updated_at: new Date().toISOString(),
            })
            .eq("id", t.id)
            .eq("user_id", userId);

          if (!updateError) {
            cachedCount++;
            successful++;
            send({
              type: "success", id: t.id, vendor: t.vendor,
              category: cached.category, line: cached.schedule_c_line,
              confidence: cached.confidence ?? 0.8,
              quickLabels: cached.quick_labels ?? [],
              deductionPct: cachedDeduction,
              isMeal: t.is_meal ?? false,
              isTravel: t.is_travel ?? false,
              reasoning: "Matched from previous categorization",
            });
          } else {
            needsAI.push(t);
          }
        } else {
          needsAI.push(t);
        }
      }

      if (cachedCount > 0) {
        send({ type: "status", message: `${cachedCount} matched from cache, ${needsAI.length} need AI` });
      }

      send({
        type: "progress", completed: cachedCount, total,
        current: needsAI.length > 0 ? "Starting AI categorization..." : "Done",
      });

      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      if (needsAI.length > 0) {
        const ANTHROPIC_TIMEOUT_MS = 60_000; // 60 seconds
        let anthropic: Anthropic;
        try {
          anthropic = new Anthropic({ apiKey, timeout: ANTHROPIC_TIMEOUT_MS });
        } catch (e) {
          send({ type: "error", id: "init", vendor: "SDK", message: extractError(e) });
          send({ type: "done", successful, failed: needsAI.length, total, totalInputTokens: 0, totalOutputTokens: 0 });
          controller.close();
          return;
        }

        const batches: TransactionRow[][] = [];
        for (let i = 0; i < needsAI.length; i += BATCH_SIZE) {
          batches.push(needsAI.slice(i, i + BATCH_SIZE));
        }

        const batchResults = await runWithConcurrency(
          batches,
          BATCH_CONCURRENCY,
          async (batch, batchIndex) => {
            const batchStart = batchIndex * BATCH_SIZE;
            const batchNum = batchIndex + 1;
            const totalBatches = batches.length;
            send({
              type: "progress",
              completed: cachedCount + batchStart,
              total,
              current: `AI batch ${batchNum}/${totalBatches} (${batch.length} txns)`,
            });

            let batchSuccess = 0;
            let batchFailed = 0;
            let inputTokens = 0;
            let outputTokens = 0;

            // Deduplicate by vendor_normalized: one AI call per unique vendor in batch, then apply result to all txns with that vendor
            const vendorToTxns = new Map<string, TransactionRow[]>();
            for (const t of batch) {
              const vn = t.vendor_normalized || normalizeVendor(t.vendor);
              const list = vendorToTxns.get(vn) ?? [];
              list.push(t);
              vendorToTxns.set(vn, list);
            }
            const representatives = Array.from(vendorToTxns.values()).map((txns) => txns[0]);
            const batchInput = representatives.map((t) => toCategorizeContext({
              id: t.id,
              vendor: t.vendor,
              amount: t.amount,
              date: t.date,
              description: t.description ?? null,
              plaid_category: t.plaid_category ?? null,
              hint_plaid_category: t.hint_plaid_category ?? null,
              category: t.category ?? undefined,
            }));

            try {
              const effectiveSystemPrompt = businessIndustry
                ? `${CATEGORIZE_SYSTEM_PROMPT}\n\nBusiness context: The user's business industry is "${businessIndustry}". Use this as one factor when evaluating deductibility — expenses common in this industry are more likely business-related. This is guidance, not a hard rule; still evaluate each transaction individually.`
                : CATEGORIZE_SYSTEM_PROMPT;

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

              inputTokens = message.usage?.input_tokens ?? 0;
              outputTokens = message.usage?.output_tokens ?? 0;

              const first = message.content[0];
              if (!first || first.type !== "text") {
                for (const t of batch) {
                  batchFailed++;
                  send({ type: "error", id: t.id, vendor: t.vendor, message: "No text in response" });
                }
                return { batchSuccess, batchFailed, inputTokens, outputTokens };
              }

              let jsonText = first.text.trim();
              if (jsonText.startsWith("```")) {
                jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
              }

              let parsedArray: ParsedCategorization[];
              try {
                const parsed = JSON.parse(jsonText);
                parsedArray = Array.isArray(parsed) ? parsed : [parsed];
              } catch {
                for (const t of batch) {
                  batchFailed++;
                  send({ type: "error", id: t.id, vendor: t.vendor, message: `Invalid JSON: "${jsonText.slice(0, 60)}..."` });
                }
                return { batchSuccess, batchFailed, inputTokens, outputTokens };
              }

              const resultById = new Map<string, ParsedCategorization>();
              for (const r of parsedArray) {
                if (r.id) resultById.set(r.id, r);
              }

              for (const t of batch) {
                const vn = t.vendor_normalized || normalizeVendor(t.vendor);
                const ctx = toCategorizeContext({
                  id: t.id,
                  vendor: t.vendor,
                  amount: t.amount,
                  date: t.date,
                  description: t.description ?? null,
                  plaid_category: t.plaid_category ?? null,
                  hint_plaid_category: t.hint_plaid_category ?? null,
                  category: t.category,
                });
                const group = vendorToTxns.get(vn)?.[0];
                const repId = group?.id ?? t.id;
                const rawResult = resultById.get(repId) ?? resultById.get(t.id) ?? parsedArray[0];

                if (!rawResult?.category || !rawResult?.scheduleCLine) {
                  batchFailed++;
                  send({ type: "error", id: t.id, vendor: t.vendor, message: "Missing category in AI response" });
                  continue;
                }

                const result = applyCategorizationGuardrails(
                  { ...rawResult, id: t.id },
                  ctx
                );
                const scheduleLine = normalizeScheduleLine(result.scheduleCLine) ?? result.scheduleCLine;
                const isMealResult = result.isMeal ?? scheduleLine === "24b";
                const isTravelResult = result.isTravel ?? false;
                const deductPct = result.deductibility === "likely_personal"
                  ? 0
                  : result.suggestedDeductionPct ?? getDefaultDeduction(scheduleLine, isMealResult, isTravelResult);

                const aiReasoning =
                  result.reasoning?.trim()?.slice(0, 500) ||
                  "Likely a business expense for your work.";

                const { error: updateError } = await (supabase as any)
                  .from("transactions")
                  .update({
                    category: result.category,
                    schedule_c_line: scheduleLine,
                    ai_confidence: result.confidence ?? 0.5,
                    ai_reasoning: aiReasoning,
                    ai_suggestions: result.quickLabels ?? [],
                    deduction_percent: deductPct,
                    is_meal: isMealResult,
                    is_travel: isTravelResult,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", t.id)
                  .eq("user_id", userId);

                if (updateError) {
                  batchFailed++;
                  send({ type: "error", id: t.id, vendor: t.vendor, message: safeErrorMessage(updateError.message, "DB update failed") });
                  continue;
                }

                batchSuccess++;
                send({
                  type: "success", id: t.id, vendor: t.vendor,
                  category: result.category, line: scheduleLine,
                  confidence: result.confidence,
                  quickLabels: result.quickLabels ?? [],
                  deductionPct: deductPct,
                  isMeal: isMealResult,
                  isTravel: isTravelResult,
                  reasoning: aiReasoning,
                });

                try {
                  await upsertVendorPattern(supabase as any, userId, vn, { ...result, scheduleCLine: scheduleLine });
                } catch {
                  // vendor_patterns table may not exist yet
                }
              }
            } catch (e) {
              const detail = extractError(e);
              for (const t of batch) {
                batchFailed++;
                send({ type: "error", id: t.id, vendor: t.vendor, message: detail });
              }
            }

            send({
              type: "progress",
              completed: cachedCount + Math.min(batchStart + BATCH_SIZE, needsAI.length),
              total,
            });
            return { batchSuccess, batchFailed, inputTokens, outputTokens };
          }
        );

        for (const r of batchResults) {
          successful += r.batchSuccess;
          failed += r.batchFailed;
          totalInputTokens += r.inputTokens;
          totalOutputTokens += r.outputTokens;
        }
      }

      send({
        type: "done",
        successful,
        failed,
        total,
        totalInputTokens,
        totalOutputTokens,
        cachedCount,
        eligibleCount: total,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
