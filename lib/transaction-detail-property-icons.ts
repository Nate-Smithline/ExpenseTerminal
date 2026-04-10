import type { TransactionPropertyType } from "@/lib/validation/schemas";

const PROPERTY_TYPE_ICONS: Record<TransactionPropertyType, string> = {
  short_text: "title",
  long_text: "notes",
  number: "numbers",
  select: "arrow_drop_down_circle",
  multi_select: "list",
  date: "calendar_today",
  checkbox: "check_box",
  org_user: "person",
  files: "attach_file",
  phone: "call",
  email: "alternate_email",
  created_time: "schedule",
  created_by: "person",
  last_edited_date: "calendar_month",
  last_edited_time: "schedule",
  account: "database",
};

/** Material Symbols names (rounded) — Notion-style property icons */
export function transactionPropertyTypeIcon(type: string): string {
  return PROPERTY_TYPE_ICONS[type as TransactionPropertyType] ?? "tune";
}

/** Core transaction sidebar fields (not org properties) */
export const CORE_FIELD_ICONS = {
  vendor: "storefront",
  date: "calendar_today",
  amount: "payments",
  transaction_type: "swap_vert",
  status: "flag",
  category: "category",
  schedule_c_line: "receipt_long",
  deduction: "percent",
  ai_confidence: "auto_awesome",
  ai_reasoning: "lightbulb",
  business_purpose: "work",
  quick_label: "label",
  description: "subject",
  notes: "sticky_note_2",
  source: "cloud_upload",
  vendor_normalized: "key",
} as const;
