import type { Json, Database } from "@/lib/types/database";

export type AutoSortRuleRow = Database["public"]["Tables"]["auto_sort_rules"]["Row"];

export type RuleSource = "csv_upload" | "manual" | "data_feed";

export interface RuleMatchCondition {
  field: "vendor_or_description";
  pattern: string;
}

export interface RuleConditions {
  match: RuleMatchCondition;
  source?: RuleSource | null;
}

export type RuleAction =
  | {
      type: "auto_categorize";
      category?: string | null;
    }
  | {
      type: "exclude";
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
      field: match.field === "vendor_or_description" ? "vendor_or_description" : "vendor_or_description",
      pattern: typeof match.pattern === "string" ? match.pattern : "",
    },
    source:
      value.source === "csv_upload" || value.source === "manual" || value.source === "data_feed"
        ? value.source
        : null,
  };
}

export function parseRuleAction(json: Json | null): RuleAction {
  const value = (json ?? {}) as Record<string, any>;
  if (value.type === "exclude") {
    return { type: "exclude" };
  }
  return {
    type: "auto_categorize",
    category: typeof value.category === "string" ? value.category : null,
  };
}

