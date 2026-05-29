import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = SupabaseClient<any>;

export type DeleteDataSourceResult =
  | { ok: true; transactionsDeleted: number }
  | { ok: false; status: number; error: string };

/**
 * Deletes a data source owned by `userId` and all rows that reference it.
 * Uses the service client for transaction cleanup so orphaned rows (e.g. wrong
 * user_id from older imports) do not block the account delete via FK.
 */
export async function deleteDataSourceForUser(
  userClient: Supa,
  userId: string,
  dataSourceId: string
): Promise<DeleteDataSourceResult> {
  const { data: row, error: fetchError } = await userClient
    .from("data_sources")
    .select("id")
    .eq("id", dataSourceId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !row) {
    return { ok: false, status: 404, error: "Data source not found" };
  }

  const service = createSupabaseServiceClient();

  const { data: deletedTx, error: delTxError } = await service
    .from("transactions")
    .delete()
    .eq("data_source_id", dataSourceId)
    .select("id");

  if (delTxError) {
    return {
      ok: false,
      status: 500,
      error: delTxError.message || "Failed to delete transactions",
    };
  }

  await service
    .from("net_worth_snapshots")
    .delete()
    .eq("data_source_id", dataSourceId)
    .eq("user_id", userId);

  const { error: delSourceError } = await userClient
    .from("data_sources")
    .delete()
    .eq("id", dataSourceId)
    .eq("user_id", userId);

  if (delSourceError) {
    return {
      ok: false,
      status: 500,
      error: delSourceError.message || "Failed to delete account",
    };
  }

  return { ok: true, transactionsDeleted: deletedTx?.length ?? 0 };
}
