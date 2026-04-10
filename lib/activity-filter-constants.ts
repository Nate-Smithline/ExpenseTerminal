import type { ActivityFilterableStandardColumn } from "@/lib/validation/schemas";

/** Human labels for standard activity filter columns (keep in sync with ActivityColumnFiltersBar). */
export const ACTIVITY_STANDARD_COLUMN_LABELS: Record<ActivityFilterableStandardColumn, string> = {
  date: "Date",
  vendor: "Vendor",
  description: "Description",
  amount: "Amount",
  transaction_type: "Type",
  status: "Status",
  category: "Category",
  schedule_c_line: "Schedule C",
  source: "Source",
  ai_confidence: "AI %",
  business_purpose: "Business purpose",
  quick_label: "Quick label",
  notes: "Notes",
  deduction_percent: "Deduction %",
  vendor_normalized: "Vendor key",
  data_source_id: "Account",
  created_at: "Created",
};

export const FILTER_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "auto_sorted", label: "Auto-sorted" },
  { value: "personal", label: "Personal" },
] as const;

export const FILTER_TRANSACTION_TYPE_OPTIONS = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
] as const;

export const FILTER_SOURCE_OPTIONS = [
  { value: "data_feed", label: "Direct Feed" },
  { value: "csv_upload", label: "CSV" },
  { value: "manual", label: "Manual" },
] as const;
