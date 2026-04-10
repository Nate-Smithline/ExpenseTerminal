import type { ActivitySortColumn } from "@/lib/validation/schemas";

/** Material Symbols Rounded names for activity / transaction table column headers. */
export const ACTIVITY_COLUMN_MATERIAL_ICONS: Record<ActivitySortColumn, string> = {
  date: "calendar_today",
  vendor: "storefront",
  description: "subject",
  amount: "payments",
  transaction_type: "swap_horiz",
  status: "flag",
  category: "category",
  schedule_c_line: "receipt_long",
  source: "cloud_upload",
  ai_confidence: "auto_awesome",
  business_purpose: "work",
  quick_label: "new_label",
  notes: "sticky_note_2",
  deduction_percent: "percent",
  vendor_normalized: "rule",
  data_source_id: "account_balance",
  created_at: "schedule",
  updated_at: "update",
};
