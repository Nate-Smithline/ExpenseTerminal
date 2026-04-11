import type { Database, Json } from "@/lib/types/database";
import type { TransactionDetailUpdate } from "@/components/TransactionDetailPanel";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

/**
 * Apply a detail-panel patch to a transaction row for optimistic UI updates.
 * Mirrors server-side field handling in POST /api/transactions/update.
 */
export function mergeTransactionDetailPatch(
  row: TransactionRow,
  patch: TransactionDetailUpdate & { status?: string }
): TransactionRow {
  const next = { ...row } as TransactionRow;
  if (patch.category !== undefined) next.category = patch.category;
  if (patch.schedule_c_line !== undefined) next.schedule_c_line = patch.schedule_c_line;
  if (patch.deduction_percent !== undefined) next.deduction_percent = patch.deduction_percent;
  if (patch.business_purpose !== undefined) next.business_purpose = patch.business_purpose;
  if (patch.notes !== undefined) next.notes = patch.notes;
  if (patch.vendor !== undefined) next.vendor = patch.vendor;
  if (patch.date !== undefined) next.date = new Date(patch.date).toISOString().slice(0, 10);
  if (patch.amount !== undefined) next.amount = String(patch.amount);
  if (patch.transaction_type !== undefined) next.transaction_type = patch.transaction_type;
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.source !== undefined) next.source = patch.source;
  if (patch.custom_fields !== undefined && typeof patch.custom_fields === "object" && !Array.isArray(patch.custom_fields)) {
    const prevCf =
      row.custom_fields && typeof row.custom_fields === "object" && !Array.isArray(row.custom_fields)
        ? { ...(row.custom_fields as Record<string, Json>) }
        : {};
    next.custom_fields = {
      ...prevCf,
      ...(patch.custom_fields as Record<string, Json>),
    } as TransactionRow["custom_fields"];
  }
  next.updated_at = new Date().toISOString();
  return next;
}
