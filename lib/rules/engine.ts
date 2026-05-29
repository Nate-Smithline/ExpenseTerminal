import type { Database } from "@/lib/types/database";
import type { RuleConditions, RuleAction, NormalizedRule } from "./types";
import { parseRuleConditions, parseRuleAction } from "./types";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"] & {
  /** Plaid/MCC category stored during sync (may not exist on older rows). */
  plaid_category?: string | null;
};

/**
 * Returns true if `tx` satisfies all conditions in the rule.
 *
 * Evaluation order:
 *  1. Source filter — if set, rule only applies to that source.
 *  2. Vendor/description pattern — substring (default) or regex (use_regex: true).
 *  3. Amount range — absolute value of tx.amount must be within [amount_min, amount_max].
 *  4. MCC/Plaid category codes — if set, tx.plaid_category must match one of the codes.
 */
export function matchesRule(tx: TransactionRow, conditions: RuleConditions): boolean {
  // 1. Source filter
  if (conditions.source && tx.source !== conditions.source) {
    return false;
  }

  // 2. Vendor / description pattern
  const pattern = conditions.match.pattern?.trim();
  if (!pattern) return false;

  const haystack = `${tx.vendor ?? ""} ${tx.description ?? ""}`.toLowerCase();

  if (conditions.match.use_regex) {
    try {
      if (!new RegExp(pattern, "i").test(haystack)) return false;
    } catch {
      // Invalid regex — fall back to substring so the rule doesn't silently break
      if (!haystack.includes(pattern.toLowerCase())) return false;
    }
  } else {
    if (!haystack.includes(pattern.toLowerCase())) return false;
  }

  // 3. Amount range (absolute value)
  if (conditions.amount_min != null || conditions.amount_max != null) {
    const abs = Math.abs(Number(tx.amount));
    if (conditions.amount_min != null && abs < conditions.amount_min) return false;
    if (conditions.amount_max != null && abs > conditions.amount_max) return false;
  }

  // 4. MCC / Plaid category codes
  if (conditions.mcc_codes && conditions.mcc_codes.length > 0) {
    const txCategory = (tx.plaid_category ?? "").toLowerCase();
    const matched = conditions.mcc_codes.some((code) =>
      txCategory.includes(code.toLowerCase())
    );
    if (!matched) return false;
  }

  return true;
}

export function buildUpdateForAction(
  tx: TransactionRow,
  action: RuleAction,
): { update?: Record<string, unknown>; shouldDelete?: boolean } {
  if (action.type === "exclude") {
    return { shouldDelete: true };
  }
  if (action.type === "skip_similar_prompt") {
    return {};
  }
  const update: Record<string, unknown> = {};
  // action.type === "auto_categorize" here
  if (action.category != null && action.category !== "") {
    update.category = action.category;
  }
  // Let existing inbox flows decide status; default to auto_sorted if we touch it here.
  if (!tx.status || tx.status === "pending") {
    update.status = "auto_sorted";
  }
  if (Object.keys(update).length === 0) {
    return {};
  }
  update.updated_at = new Date().toISOString();
  return { update };
}

export function normalizeRuleRow(row: Database["public"]["Tables"]["auto_sort_rules"]["Row"]): NormalizedRule {
  return {
    id: row.id,
    name: row.name ?? null,
    enabled: row.enabled ?? true,
    conditions: parseRuleConditions(row.conditions),
    action: parseRuleAction(row.action),
    created_at: row.created_at,
  };
}

