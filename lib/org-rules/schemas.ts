import { z } from "zod";
import { uuidSchema, activityFilterableStandardColumnSchema } from "@/lib/validation/schemas";
import { ORG_RULE_STANDARD_WRITABLE_FIELDS } from "./standard-field-actions";

export const orgRuleTriggerModeSchema = z.enum(["new_and_existing", "new_only", "existing_only"]);

export type OrgRuleTriggerMode = z.infer<typeof orgRuleTriggerModeSchema>;

export function orgRuleRunsOnIngest(mode: string): boolean {
  return mode === "new_and_existing" || mode === "new_only";
}

export function orgRuleRunsOnDaily(mode: string): boolean {
  return mode === "new_and_existing" || mode === "existing_only";
}

/** Full backfill over all org transactions (manual). */
export function orgRuleAllowsFullBackfill(mode: string): boolean {
  return mode === "new_and_existing" || mode === "existing_only";
}

/** One condition: same shape as activity column filters (standard column key or property definition UUID). */
export const orgRuleFilterConditionSchema = z.object({
  id: uuidSchema.optional(),
  column: z.union([activityFilterableStandardColumnSchema, uuidSchema]),
  op: z.string().min(1).max(40),
  value: z.string().max(500).optional(),
  value2: z.string().max(500).optional(),
});

export type OrgRuleFilterCondition = z.infer<typeof orgRuleFilterConditionSchema>;

export const orgRuleConditionsSchema = z.object({
  op: z.enum(["and", "or"]).default("and"),
  conditions: z.array(orgRuleFilterConditionSchema).min(1).max(30),
});

export type OrgRuleConditions = z.infer<typeof orgRuleConditionsSchema>;

/* --- Legacy v1 conditions (vendor/amount/date/source only) — migrated on read --- */

const legacyAmountCmpSchema = z.enum(["gt", "gte", "lt", "lte", "eq"]);
const legacyDateCmpSchema = z.enum(["gt", "gte", "lt", "lte", "eq"]);
const legacyVendorCmpSchema = z.enum(["contains", "icontains"]);

const legacyAtomicSchema = z.discriminatedUnion("field", [
  z.object({
    field: z.literal("amount"),
    cmp: legacyAmountCmpSchema,
    value: z.number().finite(),
  }),
  z.object({
    field: z.literal("date"),
    cmp: legacyDateCmpSchema,
    value: z.string().min(1).max(32),
  }),
  z.object({
    field: z.literal("vendor"),
    cmp: legacyVendorCmpSchema,
    value: z.string().min(1).max(500),
  }),
  z.object({
    field: z.literal("source"),
    cmp: z.literal("eq"),
    value: z.enum(["data_feed", "csv_upload", "manual"]),
  }),
]);

const legacyConditionsSchema = z.object({
  op: z.enum(["and", "or"]).default("and"),
  conditions: z.array(legacyAtomicSchema).min(1),
});

function migrateLegacyAtomic(c: z.infer<typeof legacyAtomicSchema>): OrgRuleFilterCondition {
  switch (c.field) {
    case "vendor":
      return { column: "vendor", op: "contains", value: c.value };
    case "amount":
      return { column: "amount", op: c.cmp, value: String(c.value) };
    case "date": {
      const opMap: Record<string, string> = {
        eq: "is",
        lt: "before",
        lte: "on_or_before",
        gt: "after",
        gte: "on_or_after",
      };
      return { column: "date", op: opMap[c.cmp] ?? "is", value: c.value.slice(0, 10) };
    }
    case "source":
      return { column: "source", op: "is", value: c.value };
    default:
      return { column: "vendor", op: "contains", value: "" };
  }
}

const orgRuleStandardFieldSchema = z.enum(
  ORG_RULE_STANDARD_WRITABLE_FIELDS as unknown as [string, ...string[]],
);

export const orgRuleActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ai_categorize") }),
  z.object({
    type: z.literal("set_standard_field"),
    field: orgRuleStandardFieldSchema,
    value: z.unknown(),
  }),
  z.object({
    type: z.literal("set_custom_property"),
    propertyDefinitionId: uuidSchema,
    value: z.unknown(),
  }),
]);

export type OrgRuleAction = z.infer<typeof orgRuleActionSchema>;

const legacyOrgRuleActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_category"), value: z.string().min(1).max(200) }),
  z.object({
    type: z.literal("set_property_select"),
    propertyDefinitionId: uuidSchema,
    optionId: uuidSchema,
  }),
  z.object({
    type: z.literal("set_property_checkbox"),
    propertyDefinitionId: uuidSchema,
    value: z.boolean(),
  }),
]);

function migrateLegacyOrgRuleAction(a: z.infer<typeof legacyOrgRuleActionSchema>): OrgRuleAction {
  switch (a.type) {
    case "set_category":
      return { type: "set_standard_field", field: "category", value: a.value };
    case "set_property_select":
      return {
        type: "set_custom_property",
        propertyDefinitionId: a.propertyDefinitionId,
        value: a.optionId,
      };
    case "set_property_checkbox":
      return {
        type: "set_custom_property",
        propertyDefinitionId: a.propertyDefinitionId,
        value: a.value,
      };
  }
}

export const orgRuleActionsArraySchema = z.array(orgRuleActionSchema).min(1);

export const orgRulePostSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
  position: z.number().int().optional(),
  conditions: orgRuleConditionsSchema,
  actions: orgRuleActionsArraySchema,
  trigger_mode: orgRuleTriggerModeSchema.optional(),
});

export const orgRulePatchSchema = z.object({
  name: z.string().min(1).max(200).nullable().optional(),
  enabled: z.boolean().optional(),
  position: z.number().int().optional(),
  conditions: orgRuleConditionsSchema.optional(),
  actions: orgRuleActionsArraySchema.optional(),
  trigger_mode: orgRuleTriggerModeSchema.optional(),
});

export const orgRuleRunBodySchema = z.object({
  transactionIds: z.array(uuidSchema).max(2000).optional(),
  ruleId: uuidSchema.optional(),
  scope: z.enum(["transaction_ids", "daily_window", "once_backfill"]).default("transaction_ids"),
});

export function parseOrgRuleConditions(json: unknown): OrgRuleConditions | null {
  const parsed = orgRuleConditionsSchema.safeParse(json);
  if (parsed.success) return parsed.data;
  const legacy = legacyConditionsSchema.safeParse(json);
  if (legacy.success) {
    return {
      op: legacy.data.op,
      conditions: legacy.data.conditions.map(migrateLegacyAtomic),
    };
  }
  return null;
}

export function parseOrgRuleActions(json: unknown): OrgRuleAction[] | null {
  const arr = z.array(z.unknown()).safeParse(json);
  if (!arr.success) return null;
  const out: OrgRuleAction[] = [];
  for (const item of arr.data) {
    const cur = orgRuleActionSchema.safeParse(item);
    if (cur.success) {
      out.push(cur.data);
      continue;
    }
    const leg = legacyOrgRuleActionSchema.safeParse(item);
    if (leg.success) {
      out.push(migrateLegacyOrgRuleAction(leg.data));
      continue;
    }
    return null;
  }
  const valid = orgRuleActionsArraySchema.safeParse(out);
  return valid.success ? valid.data : null;
}
