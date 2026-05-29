import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeVendor } from "@/lib/vendor-matching";
import { ruleTransactionType } from "@/lib/vendor-prompt-key";

export type AutoSortInput = {
  vendorNormalized: string;
  quickLabel: string;
  businessPurpose: string;
  category?: string;
  schedule_c_line?: string | null;
  taxYear?: number | null;
  transactionType?: "income" | "expense";
};

export type AutoSortResult = {
  ruleId: string;
  updatedCount: number;
};


export async function applyAutoSortForVendor(
  supabase: SupabaseClient,
  userId: string,
  input: AutoSortInput,
): Promise<AutoSortResult> {
  const {
    vendorNormalized,
    quickLabel,
    businessPurpose,
    category,
    taxYear,
    transactionType = "expense",
  } = input;
  const isIncome = transactionType === "income";

  const conditions = {
    match: { field: "vendor_or_description" as const, pattern: vendorNormalized },
    source: null,
    transaction_type: transactionType,
  };
  const action = {
    type: "auto_categorize" as const,
    category: category || null,
    transaction_type: transactionType,
    ...(input.schedule_c_line != null ? { schedule_c_line: input.schedule_c_line } : {}),
  };

  const { data: vendorRules, error: rulesFetchError } = await (supabase as any)
    .from("auto_sort_rules")
    .select("id, conditions")
    .eq("user_id", userId)
    .eq("vendor_pattern", vendorNormalized);

  if (rulesFetchError) {
    throw new Error(rulesFetchError.message);
  }

  const existing = (vendorRules ?? []).find(
    (row: { conditions?: unknown }) => ruleTransactionType(row.conditions) === transactionType,
  ) as { id: string } | undefined;

  // eslint-disable-next-line prefer-const
  let rule: { id: string } | null = existing ?? null;
  if (rule) {
    const { error: updateRuleError } = await (supabase as any)
      .from("auto_sort_rules")
      .update({
        quick_label: quickLabel,
        business_purpose: businessPurpose || null,
        category: category || null,
        conditions,
        action,
      })
      .eq("id", rule.id)
      .eq("user_id", userId);
    if (updateRuleError) {
      throw new Error(updateRuleError.message);
    }
  } else {
    const { data: inserted, error: ruleError } = await (supabase as any)
      .from("auto_sort_rules")
      .insert({
        user_id: userId,
        vendor_pattern: vendorNormalized,
        quick_label: quickLabel,
        business_purpose: businessPurpose || null,
        category: category || null,
        conditions,
        action,
      })
      .select("id")
      .single();
    if (ruleError || !inserted) {
      throw new Error(ruleError?.message ?? "Failed to create auto-sort rule");
    }
    rule = inserted;
  }

  const updatePayload: Record<string, unknown> = {
    quick_label: quickLabel,
    business_purpose: businessPurpose || null,
    auto_sort_rule_id: rule!.id,
    updated_at: new Date().toISOString(),
    transaction_type: transactionType,
    vendor_normalized: vendorNormalized,
  };

  if (!isIncome) {
    if (category != null && category !== "") {
      updatePayload.category = category;
    }
    if (input.schedule_c_line !== undefined) {
      updatePayload.schedule_c_line = input.schedule_c_line ?? null;
    }
  }

  if (quickLabel === "Personal") {
    updatePayload.status = "personal";
    updatePayload.deduction_percent = 0;
  } else if (isIncome) {
    updatePayload.status = "completed";
  } else {
    updatePayload.status = "auto_sorted";
  }

  let baseQuery = (supabase as any)
    .from("transactions")
    .select("id, vendor, vendor_normalized")
    .eq("user_id", userId)
    .eq("status", "pending")
    .eq("transaction_type", transactionType)
    .or(`vendor_normalized.eq.${vendorNormalized},vendor_normalized.is.null`);
  if (taxYear != null && Number.isFinite(taxYear)) {
    baseQuery = baseQuery.eq("tax_year", taxYear);
  }
  const { data: candidates, error: fetchErr } = await baseQuery;
  if (fetchErr) {
    throw new Error(fetchErr.message);
  }

  const idsToUpdate = (candidates ?? [])
    .filter(
      (row: { vendor?: string | null; vendor_normalized?: string | null }) =>
        row.vendor_normalized === vendorNormalized ||
        (row.vendor != null && normalizeVendor(String(row.vendor)) === vendorNormalized),
    )
    .map((row: { id: string }) => row.id);

  if (idsToUpdate.length === 0) {
    return { ruleId: rule!.id, updatedCount: 0 };
  }

  const { data: updated, error: updateError } = await (supabase as any)
    .from("transactions")
    .update(updatePayload)
    .in("id", idsToUpdate)
    .eq("user_id", userId)
    .select("id");

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (!isIncome) {
    try {
      await (supabase as any).from("vendor_patterns").upsert(
        {
          user_id: userId,
          vendor_normalized: vendorNormalized,
          category: quickLabel === "Personal" ? null : (category || null),
          schedule_c_line: quickLabel === "Personal" ? null : (input.schedule_c_line ?? null),
          deduction_percent: quickLabel === "Personal" ? 0 : 100,
          quick_labels: quickLabel === "Personal" ? ["Personal"] : [quickLabel],
          confidence: 1,
          times_used: 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,vendor_normalized" },
      );
    } catch {
      // vendor_patterns optional in older schemas
    }
  }

  return {
    ruleId: rule!.id,
    updatedCount: updated?.length ?? 0,
  };
}

/** Apply every saved vendor rule to pending transactions (e.g. after nightly sync). */
export async function applyAllAutoSortRulesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ruleCount: number; updatedCount: number }> {
  const { data: rules, error } = await (supabase as any)
    .from("auto_sort_rules")
    .select("vendor_pattern, quick_label, business_purpose, category, conditions, action")
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  let updatedCount = 0;
  for (const rule of rules ?? []) {
    const actionType = (rule.action as { type?: string } | null)?.type;
    if (actionType === "skip_similar_prompt") continue;

    const transactionType = ruleTransactionType(rule.conditions);
    const scheduleLine =
      typeof rule.action?.schedule_c_line === "string" ? rule.action.schedule_c_line : undefined;
    const result = await applyAutoSortForVendor(supabase, userId, {
      vendorNormalized: rule.vendor_pattern,
      quickLabel: rule.quick_label,
      businessPurpose: rule.business_purpose ?? "",
      category: rule.category ?? undefined,
      schedule_c_line: scheduleLine,
      transactionType,
    });
    updatedCount += result.updatedCount;
  }

  return { ruleCount: rules?.length ?? 0, updatedCount };
}
