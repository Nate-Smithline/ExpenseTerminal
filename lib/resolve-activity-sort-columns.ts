import { ACTIVITY_SORT_COLUMNS, uuidSchema, type ActivitySortRule } from "@/lib/validation/schemas";

/**
 * Maps activity sort rules to PostgREST `.order()` columns.
 * Org "account" property columns (UUID) sort on `transactions.data_source_id`.
 */
export async function fetchAccountPropertyIdsForOrg(supabase: any, orgId: string | null): Promise<Set<string>> {
  const ids = new Set<string>();
  if (!orgId) return ids;
  const { data } = await supabase
    .from("transaction_property_definitions")
    .select("id")
    .eq("org_id", orgId)
    .eq("type", "account");
  for (const row of data ?? []) {
    if (row?.id && typeof row.id === "string") ids.add(row.id);
  }
  return ids;
}

export function mapActivitySortRulesToSqlColumns(
  rules: ActivitySortRule[],
  accountPropertyIds: Set<string>
): { column: string; asc: boolean }[] {
  return rules.map((r) => {
    const c = r.column;
    if ((ACTIVITY_SORT_COLUMNS as readonly string[]).includes(c)) {
      return { column: c, asc: r.asc };
    }
    if (uuidSchema.safeParse(c).success && accountPropertyIds.has(c)) {
      return { column: "data_source_id", asc: r.asc };
    }
    return { column: "date", asc: r.asc };
  });
}
