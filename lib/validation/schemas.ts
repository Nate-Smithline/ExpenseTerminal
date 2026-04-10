import { z } from "zod";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const uuidSchema = z.string().regex(UUID_REGEX, "Invalid UUID");

export const limitSchema = z.coerce
  .number()
  .int()
  .min(1, "Limit must be at least 1")
  .max(1000, "Limit must be at most 1000")
  .default(100);

export const offsetSchema = z.coerce
  .number()
  .int()
  .min(0, "Offset must be non-negative")
  .max(10000, "Offset must be at most 10000")
  .default(0);

export const taxYearSchema = z.coerce
  .number()
  .int()
  .min(2000, "Tax year must be 2000 or later")
  .max(2100, "Tax year must be 2100 or earlier");

export const amountSchema = z.number().finite().refine(
  (n) => Math.abs(n) < 10_000_000,
  "Amount must be between -10,000,000 and 10,000,000"
);

export const deductionPercentSchema = z.coerce
  .number()
  .min(0, "Deduction percent must be 0-100")
  .max(100, "Deduction percent must be 0-100");

export const maxString = (max: number) => z.string().max(max);
export const vendorSchema = maxString(500);
export const descriptionSchema = maxString(2000);
export const notesSchema = maxString(2000);
export const businessPurposeSchema = maxString(2000);

/** Date input from CSV/Excel can be long (e.g. "Monday, January 15, 2024"); normalized to YYYY-MM-DD before insert. */
const dateInputSchema = z.string().max(500);

export const transactionRowSchema = z.object({
  date: dateInputSchema,
  vendor: vendorSchema,
  description: maxString(2000).optional(),
  amount: z.union([z.number().finite(), z.string()]).transform((v) => (typeof v === "string" ? parseFloat(v) : v)).pipe(z.number().finite()),
  category: z.string().max(200).optional(),
  notes: notesSchema.optional(),
  transaction_type: z.enum(["income", "expense"]).optional(),
});

export const transactionUploadBodySchema = z.object({
  rows: z.array(transactionRowSchema).min(1).max(5000),
  taxYear: z.coerce.number().int().min(2000).max(2100).optional(),
  dataSourceId: uuidSchema.nullable().optional(),
  suppressDuplicates: z.boolean().optional(),
});

export const transactionIdsBodySchema = z.object({
  transactionIds: z.array(uuidSchema).min(1).max(1000),
});

export const transactionUpdateBodySchema = z.object({
  id: uuidSchema,
  quick_label: maxString(500).optional(),
  business_purpose: businessPurposeSchema.optional(),
  notes: notesSchema.optional(),
  status: z.enum(["pending", "completed", "auto_sorted", "personal"]).optional(),
  deduction_percent: deductionPercentSchema.optional(),
  category: maxString(200).nullable().optional(),
  schedule_c_line: maxString(50).nullable().optional(),
  date: dateInputSchema.optional(),
  vendor: vendorSchema.optional(),
  amount: amountSchema.optional(),
  description: descriptionSchema.nullable().optional(),
  transaction_type: z.enum(["income", "expense"]).optional(),
  source: z.enum(["csv_upload", "manual"]).optional(),
  /** Partial patch: keys are transaction_property_definitions.id for the active org */
  custom_fields: z.record(z.string(), z.unknown()).optional(),
});

export const transactionDeleteBodySchema = z.object({
  id: uuidSchema,
});

/** Single transaction for POST /api/transactions (manual log) */
export const transactionPostBodySchema = z.object({
  date: dateInputSchema,
  vendor: vendorSchema,
  amount: amountSchema,
  description: descriptionSchema.optional(),
  transaction_type: z.enum(["income", "expense"]).optional(),
});

/** Create a blank draft transaction; optional fields align new rows with the current activity view filters. */
export const transactionDraftBodySchema = z.object({
  draft: z.literal(true),
  status: z.enum(["pending", "completed", "auto_sorted", "personal"]).optional(),
  transaction_type: z.enum(["income", "expense"]).optional(),
  date_from: z.string().trim().optional(),
  date_to: z.string().trim().optional(),
  source: z.enum(["manual", "csv_upload", "data_feed"]).optional(),
  data_source_id: z.string().uuid().optional().nullable(),
});

export function parseQueryLimit(value: string | null): number {
  const parsed = limitSchema.safeParse(value ?? "100");
  return parsed.success ? parsed.data : 100;
}

export function parseQueryOffset(value: string | null): number {
  const parsed = offsetSchema.safeParse(value ?? "0");
  return parsed.success ? parsed.data : 0;
}

export function parseQueryTaxYear(value: string | null): number | null {
  if (value == null || value === "") return null;
  const parsed = taxYearSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export const taxYearSettingsPostSchema = z.object({
  tax_year: taxYearSchema,
  tax_rate: z.number().min(0, "Tax rate must be 0 or more").max(1, "Tax rate must be 1 or less"),
  expected_income_range: z.string().trim().min(1).max(64).optional(),
});

export const deductionPostSchema = z.object({
  type: z.string().min(1, "Type is required").max(200),
  tax_year: taxYearSchema,
  amount: amountSchema,
  tax_savings: amountSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const deductionDeleteSchema = z.object({
  type: z.string().min(1, "Type is required").max(200),
  tax_year: taxYearSchema,
});

/** Allowed sort columns for activity table (PostgREST `.order()` on `transactions`) */
export const ACTIVITY_SORT_COLUMNS = [
  "date",
  "vendor",
  "description",
  "amount",
  "transaction_type",
  "status",
  "category",
  "schedule_c_line",
  "source",
  "ai_confidence",
  "business_purpose",
  "quick_label",
  "notes",
  "deduction_percent",
  "vendor_normalized",
  "data_source_id",
  "created_at",
  "updated_at",
] as const;
export type ActivitySortColumn = (typeof ACTIVITY_SORT_COLUMNS)[number];

/** Built-in sort field or UUID of an org property (e.g. type `account` → orders by `data_source_id`). */
export const activitySortColumnSchema = z.union([z.enum(ACTIVITY_SORT_COLUMNS), uuidSchema]);

export type ActivitySortColumnKey = z.infer<typeof activitySortColumnSchema>;

export type ActivitySortRule = {
  column: ActivitySortColumnKey;
  asc: boolean;
};

export const activitySortRuleSchema = z.object({
  column: activitySortColumnSchema,
  asc: z.boolean(),
});

export const activitySortRulesSchema = z.array(activitySortRuleSchema).min(1).max(5);

/** Allowed visible column keys for activity table */
export const ACTIVITY_VISIBLE_COLUMNS = [
  "date",
  "vendor",
  "description",
  "amount",
  "transaction_type",
  "status",
  "category",
  "schedule_c_line",
  "source",
  "ai_confidence",
  "business_purpose",
  "quick_label",
  "notes",
  "created_at",
  "data_source_id",
] as const;
export type ActivityVisibleColumn = (typeof ACTIVITY_VISIBLE_COLUMNS)[number];

const visibleColumnKeySchema = z.union([z.enum(ACTIVITY_VISIBLE_COLUMNS), uuidSchema]);

/** Standard activity columns that support Notion-style column filters */
export const ACTIVITY_FILTERABLE_STANDARD_COLUMNS = [
  "date",
  "vendor",
  "description",
  "amount",
  "transaction_type",
  "status",
  "category",
  "schedule_c_line",
  "source",
  "ai_confidence",
  "business_purpose",
  "quick_label",
  "notes",
  "deduction_percent",
  "vendor_normalized",
  "data_source_id",
  "created_at",
] as const;
export type ActivityFilterableStandardColumn = (typeof ACTIVITY_FILTERABLE_STANDARD_COLUMNS)[number];

export const activityFilterableStandardColumnSchema = z.enum(ACTIVITY_FILTERABLE_STANDARD_COLUMNS);

/** One persisted Notion-style column filter row */
export const activityColumnFilterRowSchema = z.object({
  id: uuidSchema,
  column: z.union([activityFilterableStandardColumnSchema, uuidSchema]),
  op: z.string().min(1).max(40),
  value: z.string().max(500).optional(),
  value2: z.string().max(500).optional(),
});

export const activityColumnFiltersArraySchema = z.array(activityColumnFilterRowSchema).max(20);

/** Filters stored in activity_view_settings.filters */
export const activityViewFiltersSchema = z.object({
  status: z.enum(["pending", "completed", "auto_sorted", "personal"]).nullable().optional(),
  transaction_type: z.enum(["expense", "income"]).nullable().optional(),
  data_source_id: uuidSchema.nullable().optional(),
  search: z.string().max(500).optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  source: z.enum(["csv_upload", "manual", "data_feed"]).nullable().optional(),
  column_filters: activityColumnFiltersArraySchema.optional(),
});

export const columnWidthsSchema = z
  .record(z.string().max(40), z.number().int().min(40).max(800))
  .optional();

export const activityViewSettingsPatchSchema = z.object({
  sort_column: z.enum(ACTIVITY_SORT_COLUMNS).optional(),
  sort_asc: z.boolean().optional(),
  visible_columns: z.array(visibleColumnKeySchema).optional(),
  column_widths: columnWidthsSchema,
  filters: activityViewFiltersSchema.optional(),
});

/** Org-wide transaction property definitions (Notion-style columns) */
export const TRANSACTION_PROPERTY_TYPES = [
  "multi_select",
  "select",
  "date",
  "short_text",
  "long_text",
  "checkbox",
  "org_user",
  "number",
  "files",
  "phone",
  "email",
  "created_time",
  "created_by",
  "last_edited_date",
  "last_edited_time",
  "account",
] as const;

export type TransactionPropertyType = (typeof TRANSACTION_PROPERTY_TYPES)[number];

export const transactionPropertyTypeSchema = z.enum(TRANSACTION_PROPERTY_TYPES);

export const transactionPropertyDefinitionPostSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  type: transactionPropertyTypeSchema,
  config: z.record(z.string(), z.unknown()).optional(),
  position: z.number().int().min(0).max(100000).optional(),
});

export const transactionPropertyDefinitionPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  position: z.number().int().min(0).max(100000).optional(),
});

// Pages (saved views)
export const pageIconTypeSchema = z.enum(["emoji", "material"]);

export const pageCreateSchema = z.object({
  title: z.string().max(200).optional(),
  icon_type: pageIconTypeSchema.optional(),
  icon_value: z.string().max(64).optional(),
  icon_color: z.string().max(32).optional(),
});

export const pageVisibilitySchema = z.enum(["org", "restricted"]);

export const pagePatchSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  icon_type: pageIconTypeSchema.optional(),
  icon_value: z.string().max(64).optional(),
  icon_color: z.string().max(32).optional(),
  full_width: z.boolean().optional(),
  visibility: pageVisibilitySchema.optional(),
});

export const pageSharePatchSchema = z.object({
  visibility: pageVisibilitySchema,
});

export const pageShareInviteSchema = z.object({
  user_id: z.string().uuid().optional(),
  user_ids: z.array(z.string().uuid()).optional(),
});

export const pagePublishPatchSchema = z.object({
  published: z.boolean(),
});

export const pageActivityViewSettingsPatchSchema = activityViewSettingsPatchSchema.extend({
  sort_rules: activitySortRulesSchema.optional(),
});

// Notification preferences
export const notificationPreferencesSchema = z.object({
  type: z.enum(["count_based", "interval_based", "never"]),
  value: z.string().min(1, "Value is required"),
});
