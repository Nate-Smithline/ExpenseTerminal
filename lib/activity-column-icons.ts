import type { ActivitySortColumn } from "@/lib/validation/schemas";

/** Material Symbols names for activity table columns (toolbar sort, table headers). */
export const ACTIVITY_COLUMN_MATERIAL_ICONS: Record<ActivitySortColumn, string> = {
  date: "calendar_today",
  vendor: "storefront",
  description: "subject",
  amount: "attach_money",
  transaction_type: "merge_type",
  status: "flag",
  category: "folder",
  schedule_c_line: "receipt_long",
  source: "cloud",
  ai_confidence: "percent",
  business_purpose: "work",
  quick_label: "label",
  notes: "sticky_note_2",
  deduction_percent: "percent",
  vendor_normalized: "fingerprint",
  data_source_id: "database",
  created_at: "schedule",
  updated_at: "update",
};
