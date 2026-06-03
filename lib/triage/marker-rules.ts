import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeVendor } from "@/lib/vendor-matching";
import { ruleTransactionType } from "@/lib/vendor-prompt-key";
import type { Marker } from "@/components/MarkerPill";

export type MarkerRuleInput = {
  vendorNormalized: string;
  marker: Marker;
  businessPct: number;
  transactionType?: "income" | "expense";
  businessPurpose?: string | null;
};

export type MarkerRuleResult = {
  ruleId: string;
  updatedCount: number;
};

function markerQuickLabel(marker: Marker): string {
  if (marker === "Personal") return "Personal";
  if (marker === "Business") return "Business";
  if (marker === "Partial") return "Partial";
  return "Untagged";
}

function resolveBusinessPct(marker: Marker, businessPct: number): number {
  if (marker === "Personal") return 0;
  if (marker === "Business") return 100;
  return Math.min(100, Math.max(1, Math.round(businessPct)));
}

/** Apply a vendor marker rule to all untagged transactions and persist the rule for future imports. */
export async function applyMarkerRuleForVendor(
  supabase: SupabaseClient,
  userId: string,
  input: MarkerRuleInput,
): Promise<MarkerRuleResult> {
  const {
    vendorNormalized,
    marker,
    businessPurpose,
    transactionType = "expense",
  } = input;

  if (!marker) {
    throw new Error("Marker is required for marker rules");
  }

  const businessPct = resolveBusinessPct(marker, input.businessPct);
  const quickLabel = markerQuickLabel(marker);

  const conditions = {
    match: { field: "vendor_or_description" as const, pattern: vendorNormalized },
    source: null,
    transaction_type: transactionType,
  };
  const action = {
    type: "auto_categorize" as const,
    category: null,
    transaction_type: transactionType,
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

  let rule: { id: string };
  if (existing) {
    const { error: updateRuleError } = await (supabase as any)
      .from("auto_sort_rules")
      .update({
        quick_label: quickLabel,
        business_purpose: businessPurpose ?? null,
        marker,
        business_pct: businessPct,
        conditions,
        action,
        enabled: true,
      })
      .eq("id", existing.id)
      .eq("user_id", userId);
    if (updateRuleError) {
      throw new Error(updateRuleError.message);
    }
    rule = existing;
  } else {
    const { data: inserted, error: ruleError } = await (supabase as any)
      .from("auto_sort_rules")
      .insert({
        user_id: userId,
        vendor_pattern: vendorNormalized,
        quick_label: quickLabel,
        business_purpose: businessPurpose ?? null,
        marker,
        business_pct: businessPct,
        conditions,
        action,
      })
      .select("id")
      .single();
    if (ruleError || !inserted) {
      throw new Error(ruleError?.message ?? "Failed to create marker rule");
    }
    rule = inserted;
  }

  const { data: candidates, error: fetchErr } = await (supabase as any)
    .from("transactions")
    .select("id, vendor, vendor_normalized")
    .eq("user_id", userId)
    .is("marker", null)
    .eq("transaction_type", transactionType)
    .or(`vendor_normalized.eq.${vendorNormalized},vendor_normalized.is.null`);

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
    return { ruleId: rule.id, updatedCount: 0 };
  }

  const updatePayload: Record<string, unknown> = {
    marker,
    business_pct: businessPct,
    auto_sort_rule_id: rule.id,
    updated_at: new Date().toISOString(),
  };
  if (businessPurpose != null && businessPurpose !== "") {
    updatePayload.business_purpose = businessPurpose;
  }

  const { data: updated, error: updateError } = await (supabase as any)
    .from("transactions")
    .update(updatePayload)
    .in("id", idsToUpdate)
    .eq("user_id", userId)
    .is("marker", null)
    .select("id");

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    ruleId: rule.id,
    updatedCount: updated?.length ?? 0,
  };
}

/** Apply every saved marker rule to untagged transactions (e.g. after sync or account link). */
export async function applyAllMarkerRulesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ruleCount: number; updatedCount: number }> {
  const { data: rules, error } = await (supabase as any)
    .from("auto_sort_rules")
    .select("vendor_pattern, marker, business_pct, business_purpose, conditions")
    .eq("user_id", userId)
    .not("marker", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  let updatedCount = 0;
  for (const rule of rules ?? []) {
    if (!rule.marker) continue;
    const transactionType = ruleTransactionType(rule.conditions);
    const result = await applyMarkerRuleForVendor(supabase, userId, {
      vendorNormalized: rule.vendor_pattern,
      marker: rule.marker as Marker,
      businessPct: rule.business_pct ?? 50,
      transactionType,
      businessPurpose: rule.business_purpose ?? null,
    });
    updatedCount += result.updatedCount;
  }

  return { ruleCount: rules?.length ?? 0, updatedCount };
}
