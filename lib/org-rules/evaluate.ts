import type { OrgRuleConditions } from "./schemas";
import { matchesOrgRuleColumnFilter } from "./filter-match";
import type { OrgRuleTransactionRow } from "./filter-match";

export type { OrgRuleTransactionRow } from "./filter-match";

export function evaluateOrgRuleConditions(
  tx: OrgRuleTransactionRow,
  root: OrgRuleConditions,
  orgTypes: Map<string, string>,
): boolean {
  const results = root.conditions.map((c) =>
    matchesOrgRuleColumnFilter(
      tx,
      { column: c.column, op: c.op, value: c.value, value2: c.value2 },
      orgTypes,
    ),
  );
  return root.op === "or" ? results.some(Boolean) : results.every(Boolean);
}

export function ruleHasAiAction(actions: { type: string }[]): boolean {
  return actions.some((a) => a.type === "ai_categorize");
}

export function ruleDeterministicActions<T extends { type: string }>(actions: T[]): T[] {
  return actions.filter((a) => a.type !== "ai_categorize");
}
