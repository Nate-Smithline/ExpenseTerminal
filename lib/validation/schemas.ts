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
  // Bulk inbox / activity paging can exceed 10k rows; cap at a sane upper bound.
  .max(1_000_000, "Offset is too large")
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

/** Create a blank draft transaction; optional status and transaction_type from current table filters. */
export const transactionDraftBodySchema = z.object({
  draft: z.literal(true),
  status: z.enum(["pending", "completed", "auto_sorted", "personal"]).optional(),
  transaction_type: z.enum(["income", "expense"]).optional(),
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

/** POST /api/deductions/compute — server derives amounts from inputs (plans.md engine). */
export const deductionComputeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("home_office"),
    tax_year: taxYearSchema,
    workspace_sq_ft: z.number().positive(),
    total_home_sq_ft: z.number().positive(),
    monthly_rent: z.number().nonnegative(),
    monthly_utilities: z.number().nonnegative().optional(),
  }),
  z.object({
    type: z.literal("mileage"),
    tax_year: taxYearSchema,
    miles: z.number().nonnegative(),
  }),
  z.object({
    type: z.literal("phone"),
    tax_year: taxYearSchema,
    monthly_bill_amount: z.number().nonnegative(),
    business_use_percent: z.number().min(0).max(100),
  }),
  z.object({
    type: z.literal("internet"),
    tax_year: taxYearSchema,
    monthly_bill_amount: z.number().nonnegative(),
    business_use_percent: z.number().min(0).max(100),
  }),
  z.object({
    type: z.literal("health_insurance"),
    tax_year: taxYearSchema,
    annual_amount: z.number().nonnegative(),
  }),
  z.object({
    type: z.literal("retirement"),
    tax_year: taxYearSchema,
    annual_amount: z.number().nonnegative(),
  }),
  z.object({
    type: z.literal("other"),
    tax_year: taxYearSchema,
    annual_amount: z.number().nonnegative(),
    label: z.string().max(200).optional(),
  }),
]);

/** Allowed sort columns for activity table */
export const ACTIVITY_SORT_COLUMNS = [
  "date",
  "amount",
  "vendor",
  "status",
  "transaction_type",
  "category",
  "created_at",
] as const;
export type ActivitySortColumn = (typeof ACTIVITY_SORT_COLUMNS)[number];

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
] as const;
export type ActivityVisibleColumn = (typeof ACTIVITY_VISIBLE_COLUMNS)[number];

/** Filters stored in activity_view_settings.filters */
export const activityViewFiltersSchema = z.object({
  status: z.enum(["pending", "completed", "auto_sorted", "personal"]).nullable().optional(),
  transaction_type: z.enum(["expense", "income"]).nullable().optional(),
  search: z.string().max(500).optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  source: z.enum(["csv_upload", "manual", "data_feed"]).nullable().optional(),
});

export const activityViewSettingsPatchSchema = z.object({
  sort_column: z.enum(ACTIVITY_SORT_COLUMNS).optional(),
  sort_asc: z.boolean().optional(),
  visible_columns: z.array(z.enum(ACTIVITY_VISIBLE_COLUMNS)).optional(),
  filters: activityViewFiltersSchema.optional(),
});

// Notification preferences
export const notificationPreferencesSchema = z.object({
  type: z.enum(["count_based", "interval_based"]),
  value: z.string().min(1, "Value is required"),
});
