import type { ActivitySortRule } from "@/lib/validation/schemas";

/** Property definition ids of type `account` for the org (sort maps to `data_source_id`). */
export async function fetchAccountPropertyIdsForOrg(
  supabase: any,
  orgId: string | null
): Promise<Set<string>> {
  const out = new Set<string>();
  if (!orgId) return out;
  const { data } = await supabase
    .from("transaction_property_definitions")
    .select("id,type")
    .eq("org_id", orgId);
  for (const row of data ?? []) {
    if (row?.type === "account" && typeof row.id === "string") out.add(row.id);
  }
  return out;
}

/** Map multi-sort rules to PostgREST `.order()` columns. */
export function mapActivitySortRulesToSqlColumns(
  rules: ActivitySortRule[],
  accountPropertyIds: Set<string>
): { column: string; asc: boolean }[] {
  return rules.map((r) => {
    const key = String(r.column);
    if (accountPropertyIds.has(key)) return { column: "data_source_id", asc: r.asc };
    return { column: key, asc: r.asc };
  });
}
