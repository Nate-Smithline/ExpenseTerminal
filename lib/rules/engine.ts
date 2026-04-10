import type { Database } from "@/lib/types/database";
import type { RuleConditions, RuleAction, NormalizedRule } from "./types";
import { parseRuleConditions, parseRuleAction } from "./types";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

export function matchesRule(tx: TransactionRow, conditions: RuleConditions): boolean {
  const pattern = conditions.match.pattern?.trim();
  if (!pattern) return false;

  if (conditions.source && tx.source !== conditions.source) {
    return false;
  }

  const haystack = `${tx.vendor ?? ""} ${tx.description ?? ""}`.toLowerCase();
  return haystack.includes(pattern.toLowerCase());
}

export function buildUpdateForAction(
  tx: TransactionRow,
  action: RuleAction,
): { update?: Record<string, unknown>; shouldDelete?: boolean } {
  if (action.type === "exclude") {
    return { shouldDelete: true };
  }
  const update: Record<string, unknown> = {};
  if (action.category != null && action.category !== "") {
    update.category = action.category;
  }
  // Let existing review flows decide status; default to auto_sorted if we touch it here.
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

