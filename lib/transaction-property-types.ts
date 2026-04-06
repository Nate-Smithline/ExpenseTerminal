import type { TransactionPropertyType } from "@/lib/validation/schemas";
import { TRANSACTION_PROPERTY_TYPES } from "@/lib/validation/schemas";

export { TRANSACTION_PROPERTY_TYPES };
export type { TransactionPropertyType };

export const TRANSACTION_PROPERTY_SYSTEM_TYPES: ReadonlySet<TransactionPropertyType> = new Set([
  "created_time",
  "created_by",
  "last_edited_date",
  "last_edited_time",
]);

export function isSystemTransactionPropertyType(type: string): boolean {
  return TRANSACTION_PROPERTY_SYSTEM_TYPES.has(type as TransactionPropertyType);
}

export type TransactionPropertyConfig = {
  options?: { id: string; label: string }[];
};
