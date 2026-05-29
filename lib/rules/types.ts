import type { Json, Database } from "@/lib/types/database";

export type AutoSortRuleRow = Database["public"]["Tables"]["auto_sort_rules"]["Row"];

export type RuleSource = "csv_upload" | "manual" | "data_feed";

export interface RuleMatchCondition {
  field: "vendor_or_description";
  pattern: string;
  /** When true, `pattern` is evaluated as a case-insensitive regular expression. */
  use_regex?: boolean;
}

export interface RuleConditions {
  match: RuleMatchCondition;
  source?: RuleSource | null;
  /**
   * Optional transaction amount filter (absolute value, before sign).
   * Both are inclusive. Either may be omitted to express an open-ended range.
   * Example: { amount_min: 0, amount_max: 25 } matches transactions ≤ $25.
   */
  amount_min?: number | null;
  amount_max?: number | null;
  /**
   * Plaid / MCC category codes to match on (e.g. ["FOOD_AND_DRINK", "5411"]).
   * Matched against the `plaid_category` column when present.
   * Leave empty or omit to skip category filtering.
   */
  mcc_codes?: string[] | null;
  transaction_type?: "income" | "expense" | null;
}

export type RuleAction =
  | {
      type: "auto_categorize";
      category?: string | null;
    }
  | {
      type: "exclude";
    }
  | {
      type: "skip_similar_prompt";
    };

export interface NormalizedRule {
  id: string;
  name: string | null;
  enabled: boolean;
  conditions: RuleConditions;
  action: RuleAction;
  created_at: string;
}

export function parseRuleConditions(json: Json | null): RuleConditions {
  const value = (json ?? {}) as Record<string, any>;
  const match = value.match ?? {};
  return {
    match: {
      field: "vendor_or_description",
      pattern: typeof match.pattern === "string" ? match.pattern : "",
      use_regex: match.use_regex === true,
    },
    source:
      value.source === "csv_upload" || value.source === "manual" || value.source === "data_feed"
        ? value.source
        : null,
    amount_min: typeof value.amount_min === "number" ? value.amount_min : null,
    amount_max: typeof value.amount_max === "number" ? value.amount_max : null,
    mcc_codes: Array.isArray(value.mcc_codes) ? value.mcc_codes : null,
    transaction_type:
      value.transaction_type === "income" || value.transaction_type === "expense"
        ? value.transaction_type
        : null,
  };
}

export function parseRuleAction(json: Json | null): RuleAction {
  const value = (json ?? {}) as Record<string, any>;
  if (value.type === "exclude") {
    return { type: "exclude" };
  }
  if (value.type === "skip_similar_prompt") {
    return { type: "skip_similar_prompt" };
  }
  return {
    type: "auto_categorize",
    category: typeof value.category === "string" ? value.category : null,
  };
}

