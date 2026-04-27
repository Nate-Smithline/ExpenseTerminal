import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, expensiveOpLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { withRetry } from "@/lib/api/retry";
import { transactionIdsBodySchema } from "@/lib/validation/schemas";
import { requireWorkspaceIdForApi } from "@/lib/workspaces/server";
import { lookupMerchantMemory, upsertMerchantMemory } from "@/lib/enrichment/merchant-memory";

type RenameResult = { displayName: string; confidence: number };
type CategorizeResult = {
  category: string;
  deductionSuggestions: Array<{ type: string; label: string; likelihood: "high" | "medium" | "low"; isSelected: boolean }>;
  deductionLikelihood: "high" | "medium" | "low" | "none";
};

const renamePrompt = (rawName: string, normalized: string, hint?: string | null) => `
You are a financial data cleaner. Convert this raw bank transaction name into a clean, human-readable merchant name.

Raw name: "${rawName}"
Normalized: "${normalized}"
${hint ? `Similar past transaction was renamed to: "${hint}"` : ""}

Rules:
- Return ONLY the merchant display name, nothing else
- If the merchant is a known brand, use its proper name with correct capitalization
- If uncertain, return the cleanest version of the raw name you can produce
- Never invent a name you aren't confident about

Respond with JSON: { "displayName": string, "confidence": number (0.0-1.0) }
`;

const categorizePrompt = (input: {
  displayName: string;
  amount: number;
  date: string;
  businessType: string | null;
  accountType: string | null;
  plaidCategory: string | null;
}) => `
You are a tax categorization assistant for self-employed professionals in the US.

Transaction details:
- Merchant: "${input.displayName}"
- Amount: $${input.amount}
- Date: ${input.date}
- Plaid category: "${input.plaidCategory ?? ""}"
- Business type: "${input.businessType ?? ""}"
- Account type: "${input.accountType ?? ""}"

Your job:
1. Assign a plain-English category (not IRS jargon). Use one of:
   Software & tools, Advertising & marketing, Meals & entertainment, Travel,
   Home office, Phone & internet, Professional services, Supplies & equipment,
   Education & training, Health insurance, Other business expense

2. Generate exactly 3 potential deduction types, ranked by fit.
   Pre-select the best match as isSelected: true.

3. Rate overall deduction likelihood: high | medium | low | none

Respond with JSON only:
{
  "category": string,
  "deductionSuggestions": [
    { "type": string, "label": string, "likelihood": "high"|"medium"|"low", "isSelected": boolean },
    { "type": string, "label": string, "likelihood": "high"|"medium"|"low", "isSelected": boolean },
    { "type": string, "label": string, "likelihood": "high"|"medium"|"low", "isSelected": boolean }
  ],
  "deductionLikelihood": "high"|"medium"|"low"|"none"
}
`;

export async function POST(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const { success: rlOk } = await rateLimitForRequest(req, userId, expensiveOpLimit);
  if (!rlOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const supabase = authClient;
  const wsRes = await requireWorkspaceIdForApi(supabase as any, userId, req);
  if ("error" in wsRes) return NextResponse.json({ error: wsRes.error }, { status: wsRes.status });
  const workspaceId = wsRes.workspaceId;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = transactionIdsBodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "Invalid request body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Fetch workspace business type (stored on workspaces) + account types (data_sources.account_type)
  const { data: wsRow } = await (supabase as any)
    .from("workspaces")
    .select("business_type")
    .eq("id", workspaceId)
    .maybeSingle();

  const { data: txs, error: txErr } = await (supabase as any)
    .from("transactions")
    .select("id,date,vendor,description,amount,display_name,plaid_raw_json,data_source_id")
    .eq("workspace_id", workspaceId)
    .in("id", parsed.data.transactionIds);
  if (txErr) {
    return NextResponse.json(
      { error: safeErrorMessage(txErr.message, "Failed to load transactions") },
      { status: 500 }
    );
  }

  const dataSourceIds = Array.from(
    new Set((txs ?? []).map((t: any) => t.data_source_id).filter(Boolean))
  );
  const { data: sources } = await (supabase as any)
    .from("data_sources")
    .select("id,account_type")
    .eq("workspace_id", workspaceId)
    .in("id", dataSourceIds.length ? dataSourceIds : ["00000000-0000-0000-0000-000000000000"]);
  const accountTypeBySource = new Map<string, string>(
    (sources ?? []).map((s: any) => [String(s.id), String(s.account_type)])
  );

  let renamed = 0;
  let categorized = 0;
  const errors: Array<{ id: string; step: string; error: string }> = [];

  for (const tx of txs ?? []) {
    const txId = String((tx as any).id);
    const rawName = String((tx as any).vendor ?? "");
    const existingDisplay = ((tx as any).display_name as string | null) ?? null;
    const accountType: string | null = (tx as any).data_source_id
      ? accountTypeBySource.get(String((tx as any).data_source_id)) ?? null
      : null;

    let displayName = existingDisplay;
    let renameSource: string | null = null;
    let renameConfidence: number | null = null;

    try {
      if (!displayName || displayName.trim().length === 0) {
        const mm = await lookupMerchantMemory(supabase as any, workspaceId, rawName);
        if (mm.displayName && mm.confidence != null && mm.confidence >= 0.9) {
          displayName = mm.displayName;
          renameSource = "merchant_memory";
          renameConfidence = mm.confidence;
        } else {
          const msg = renamePrompt(rawName, mm.normalized, mm.displayName);
          const res = await withRetry(() =>
            anthropic.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 200,
              messages: [{ role: "user", content: msg }],
            })
          );
          const text = (res.content?.[0] as any)?.text ?? "";
          const json = JSON.parse(text) as RenameResult;
          displayName = String(json.displayName ?? rawName).slice(0, 255);
          renameSource = "ai";
          renameConfidence = Number(json.confidence ?? 0.5);
          await upsertMerchantMemory(supabase as any, {
            workspaceId,
            rawName,
            displayName,
            source: "ai_generated",
          });
        }
        renamed += 1;
      }
    } catch (e) {
      errors.push({ id: txId, step: "rename", error: e instanceof Error ? e.message : String(e) });
    }

    try {
      const plaidCategory =
        (tx as any).plaid_raw_json?.personal_finance_category?.primary ??
        (tx as any).plaid_raw_json?.personal_finance_category?.detailed ??
        null;

      const amount = Math.abs(Number((tx as any).amount ?? 0));
      const msg = categorizePrompt({
        displayName: displayName ?? rawName,
        amount,
        date: String((tx as any).date),
        businessType: (wsRow?.business_type as string | null) ?? null,
        accountType,
        plaidCategory,
      });
      const res = await withRetry(() =>
        anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          messages: [{ role: "user", content: msg }],
        })
      );
      const text = (res.content?.[0] as any)?.text ?? "";
      const json = JSON.parse(text) as CategorizeResult;

      await (supabase as any)
        .from("transactions")
        .update({
          display_name: displayName ?? rawName,
          rename_source: renameSource,
          rename_confidence: renameConfidence,
          category: json.category ?? null,
          deduction_suggestions: json.deductionSuggestions ?? null,
          deduction_likelihood: json.deductionLikelihood ?? null,
          enrichment_status: "done",
          updated_at: new Date().toISOString(),
        })
        .eq("id", txId)
        .eq("workspace_id", workspaceId);

      categorized += 1;
    } catch (e) {
      errors.push({ id: txId, step: "categorize", error: e instanceof Error ? e.message : String(e) });
      await (supabase as any)
        .from("transactions")
        .update({ enrichment_status: "error", updated_at: new Date().toISOString() })
        .eq("id", txId)
        .eq("workspace_id", workspaceId);
    }
  }

  return NextResponse.json({ ok: true, renamed, categorized, errors });
}

