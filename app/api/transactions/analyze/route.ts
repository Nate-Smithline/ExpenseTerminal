import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, expensiveOpLimit } from "@/lib/middleware/rate-limit";
import { withRetry } from "@/lib/api/retry";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { transactionIdsBodySchema } from "@/lib/validation/schemas";
import { normalizeVendor } from "@/lib/vendor-matching";
import type { Database } from "@/lib/types/database";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

/* ------------------------------------------------------------------ */
/*  Enhanced system prompt with contextual quick-label guidance        */
/* ------------------------------------------------------------------ */
const systemPrompt = `You categorize business transactions for IRS Schedule C.

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
These should be selectable labels the user can pick to justify the deduction.
Generate labels based on the CATEGORY, not generic labels:

- Meals (24b): "Business Meal", "Client Dinner", "Team Meal", "Working Lunch", "Prospect Meeting"
- Travel (24a): "Business Travel", "Client Visit", "Conference", "Site Visit"
- Office (18): "Office Supplies", "Printer/Ink", "Desk Equipment", "Stationery"
- Advertising (8): "Social Media Ads", "Google Ads", "Print Marketing", "Brand Promotion"
- Car/truck (9): "Client Visit", "Site Visit", "Business Errand", "Delivery"
- Utilities (25): "Phone/Internet", "Office Utilities", "Cloud Hosting", "Business Phone"
- Software/Other (27a): "Business Software", "SaaS Tool", "Subscription", "Dev Tools"
- Supplies (23): "Shipping Supplies", "Raw Materials", "Packaging", "Office Supplies"
- Rent/lease (21): "Office Rent", "Coworking", "Storage", "Equipment Lease"
- Insurance (15): "Business Insurance", "Liability Insurance", "Health Insurance"
- Legal/professional (17): "Legal Fees", "Accounting", "Tax Prep", "Consulting"
- Contract labor (11): "Freelancer", "Contractor", "Consultant"
- Commissions (10): "Sales Commission", "Referral Fee", "Platform Fee"
- Repairs (22): "Equipment Repair", "Office Repair", "Maintenance"

Also estimate a suggested deduction percentage:
- 50 for meals (unless clearly travel-related, then 100)
- 0 for likely_personal
- 100 for most clear business expenses
- Lower values (25-75) for mixed-use items

Return ONLY a JSON array. No markdown fences.`;

/* ------------------------------------------------------------------ */
/*  Deduction defaults by Schedule C line                              */
/* ------------------------------------------------------------------ */
const CATEGORY_DEDUCTION_DEFAULTS: Record<string, number> = {
  "24b": 50,   // Meals
  "24a": 100,  // Travel
  "18": 100,   // Office expense
  "8": 100,    // Advertising
  "9": 100,    // Car/truck
  "25": 100,   // Utilities
  "27a": 100,  // Other expenses / software
  "23": 100,   // Supplies
  "21": 100,   // Rent/lease
  "15": 100,   // Insurance
  "17": 100,   // Legal/professional
  "11": 100,   // Contract labor
  "10": 100,   // Commissions
  "13": 100,   // Depreciation
  "16b": 100,  // Other interest
  "22": 100,   // Repairs
  "26": 100,   // Wages
};

function getDefaultDeduction(scheduleCLine: string | null, isMeal: boolean, isTravel: boolean): number {
  if (isMeal && !isTravel) return 50;
  if (isMeal && isTravel) return 100;
  if (!scheduleCLine) return 100;
  const lineNum = scheduleCLine.replace(/^Line\s*/i, "").trim();
  return CATEGORY_DEDUCTION_DEFAULTS[lineNum] ?? 100;
}

/** Normalize AI output to stored form: "27a", "24b", etc. */
function normalizeScheduleLine(raw: string | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  const s = raw.replace(/^Line\s*/i, "").trim();
  return s || null;
}

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

function buildBatchPrompt(
  txns: { id: string; vendor: string; amount: number; date: string; category?: string }[]
) {
  const lines = txns.map(
    (t) => `${t.id}|${t.vendor}|$${Math.abs(t.amount).toFixed(2)}|${t.date}${t.category ? `|${t.category}` : ""}`
  );
  return `Categorize these ${txns.length} transactions. Return JSON array:
[{"id":"...","category":"Category Name","scheduleCLine":"27a","confidence":0.85,"quickLabels":["Specific Reason 1","Specific Reason 2","Specific Reason 3"],"suggestedDeductionPct":100,"deductibility":"likely_deductible|needs_review|likely_personal","isMeal":false,"isTravel":false}]

Use scheduleCLine as the line KEY only (e.g. "8", "18", "24b", "27a"), not "Line 27a".

id|vendor|amount|date[|hint]
${lines.join("\n")}`;
}

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
    const txCols = "id,vendor,amount,date,category,vendor_normalized,is_meal,is_travel,eligible_for_ai";
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
  result: ParsedResult,
) {
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !apiKey.startsWith("sk-ant-")) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY missing or invalid format." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const { data: fetchedTransactions, error: fetchError } = await fetchTransactionsInChunks(
    supabase as any, ids, userId,
  );
  if (fetchError) {
    return new Response(
      JSON.stringify({ error: `Database error: ${fetchError}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  const transactions = fetchedTransactions.filter(
    (t) => (t as TransactionRow & { eligible_for_ai?: boolean }).eligible_for_ai !== false
  );
  const skippedCount = fetchedTransactions.length - transactions.length;
  const overLimit = skippedCount > 0;

  if (transactions.length === 0) {
    return new Response(
      JSON.stringify({
        error: overLimit
          ? "None of the selected transactions are eligible for AI on your current plan. Upgrade to analyze more."
          : "No matching transactions found.",
      }),
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

      if (overLimit && skippedCount > 0) {
        send({
          type: "status",
          message: `${skippedCount} transaction(s) skipped (free-tier AI limit). Only the first 250 CSV transactions are eligible.`,
          overLimit: true,
          eligibleCount: total,
          skippedCount,
        });
      }

      const needsAI: TransactionRow[] = [];
      let successful = 0;
      let failed = 0;
      let cachedCount = 0;

      for (const t of transactions) {
        const vn = t.vendor_normalized || normalizeVendor(t.vendor);
        const cached = cachedPatterns.get(vn);
        if (cached && cached.category) {
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
                    system: systemPrompt,
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

              let parsedArray: ParsedResult[];
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

              const resultById = new Map<string, ParsedResult>();
              for (const r of parsedArray) {
                if (r.id) resultById.set(r.id, r);
              }

              for (const t of batch) {
                const vn = t.vendor_normalized || normalizeVendor(t.vendor);
                const group = vendorToTxns.get(vn)?.[0];
                const repId = group?.id ?? t.id;
                const result = resultById.get(repId) ?? resultById.get(t.id) ?? parsedArray[0];

                if (!result?.category || !result?.scheduleCLine) {
                  batchFailed++;
                  send({ type: "error", id: t.id, vendor: t.vendor, message: "Missing category in AI response" });
                  continue;
                }

                const scheduleLine = normalizeScheduleLine(result.scheduleCLine) ?? result.scheduleCLine;
                const isMealResult = result.isMeal ?? result.category.toLowerCase().includes("meal");
                const isTravelResult = result.isTravel ?? false;
                const deductPct = result.deductibility === "likely_personal"
                  ? 0
                  : result.suggestedDeductionPct ?? getDefaultDeduction(scheduleLine, isMealResult, isTravelResult);

                const { error: updateError } = await (supabase as any)
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
        overLimit: overLimit || undefined,
        eligibleCount: total,
        skippedCount: overLimit ? skippedCount : undefined,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
