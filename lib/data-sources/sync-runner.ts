import type { SupabaseClient } from "@supabase/supabase-js";
import type { StripeMode } from "@/lib/stripe";
import { getStripeClient } from "@/lib/stripe";

export type SyncResult = {
  success: boolean;
  message?: string;
  error?: string;
  code?: string;
  status?: number;
};

export type SyncOptions = {
  stripeMode?: StripeMode;
  /** Override start date for this sync (Stripe FC transacted_at.gte). */
  startDate?: string | null;
  /** End date for this sync (Stripe FC transacted_at.lte). */
  endDate?: string | null;
};

/**
 * Run sync for a single data source. Used by Retry sync UI, callback, and cron.
 * - manual: no remote pull; just clear failure state if present.
 * - stripe: subscribe/refresh, pull transactions from Stripe FC, insert with source=data_feed, update metadata.
 */
export async function runSyncForDataSource(
  supabase: SupabaseClient,
  userId: string,
  dataSourceId: string,
  sourceType: string,
  options?: SyncOptions
): Promise<SyncResult> {
  if (sourceType === "manual") {
    const { error } = await (supabase as any)
      .from("data_sources")
      .update({
        last_failed_sync_at: null,
        last_error_summary: null,
      })
      .eq("id", dataSourceId)
      .eq("user_id", userId);
    if (error) {
      return { success: false, error: error.message, status: 500 };
    }
    return { success: true, message: "Manual source has no sync." };
  }

  if (sourceType === "stripe") {
    try {
      const { data: row, error: fetchError } = await (supabase as any)
        .from("data_sources")
        .select("id, financial_connections_account_id, stripe_sync_start_date")
        .eq("id", dataSourceId)
        .eq("user_id", userId)
        .single();

      if (fetchError || !row?.financial_connections_account_id) {
        await (supabase as any)
          .from("data_sources")
          .update({
            last_failed_sync_at: new Date().toISOString(),
            last_error_summary: "This account isn't linked to a bank. Use Repair connection to reconnect.",
          })
          .eq("id", dataSourceId)
          .eq("user_id", userId);
        return {
          success: false,
          error: "This account isn't linked to a bank. Use Repair connection on this card to reconnect, or add a new Direct Feed.",
          status: 400,
        };
      }

      const mode = options?.stripeMode ?? (process.env.STRIPE_MODE === "test" ? "test" : "live");
      const stripe = getStripeClient(mode);
      const fcAccountId = row.financial_connections_account_id as string;
      const startDate = (options?.startDate !== undefined ? options.startDate : row.stripe_sync_start_date) as string | null;
      const endDate = options?.endDate ?? null;

      const fc = (stripe as any).financialConnections;
      if (!fc?.accounts) {
        await (supabase as any)
          .from("data_sources")
          .update({
            last_failed_sync_at: new Date().toISOString(),
            last_error_summary: "Stripe Financial Connections not available.",
          })
          .eq("id", dataSourceId)
          .eq("user_id", userId);
        return { success: false, error: "Stripe FC not available", status: 501 };
      }

      try {
        await fc.accounts.subscribe(fcAccountId, { features: ["transactions"] });
      } catch {
        try {
          await fc.accounts.refresh(fcAccountId, { features: ["transactions"] });
        } catch {
          // Continue to list; prefetched data may be available.
        }
      }

      const allTx: Array<{ id: string; amount: number; description?: string; transacted_at: number; status?: string }> = [];
      let hasMore = true;
      let startingAfter: string | undefined;

      while (hasMore) {
        const listParams: Record<string, unknown> = {
          account: fcAccountId,
          limit: 100,
        };
        const transactedAt: Record<string, number> = {};
        if (startDate) transactedAt.gte = Math.floor(new Date(startDate).getTime() / 1000);
        if (endDate) transactedAt.lte = Math.floor(new Date(endDate).getTime() / 1000);
        if (Object.keys(transactedAt).length > 0) listParams.transacted_at = transactedAt;
        if (startingAfter) listParams.starting_after = startingAfter;

        const list = await (stripe as any).financialConnections.transactions.list(listParams);
        const data = list?.data ?? [];
        // Only include posted (completed) transactions; skip pending and void.
        const posted = data.filter((tx: { status?: string }) => tx?.status === "posted");
        allTx.push(...posted);
        hasMore = list?.has_more ?? false;
        if (data.length > 0) startingAfter = data[data.length - 1]?.id as string | undefined;
        else hasMore = false;
      }

      let inserted = 0;
      for (const tx of allTx) {
        const date = new Date((tx.transacted_at ?? 0) * 1000);
        const dateStr = date.toISOString().slice(0, 10);
        const year = date.getFullYear();
        const amount = Number((-(tx.amount ?? 0) / 100).toFixed(2));
        const vendor = ((tx.description ?? "Unknown") as string).slice(0, 255);
        const { error: insErr } = await (supabase as any)
          .from("transactions")
          .upsert(
            {
              user_id: userId,
              date: dateStr,
              vendor,
              description: tx.description ?? null,
              amount,
              status: "completed",
              tax_year: year,
              source: "data_feed",
              transaction_type: amount >= 0 ? "income" : "expense",
              data_source_id: dataSourceId,
              data_feed_external_id: tx.id,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "data_source_id,data_feed_external_id",
              ignoreDuplicates: true,
            }
          );
        if (!insErr) inserted++;
      }

      const { count } = await (supabase as any)
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("data_source_id", dataSourceId);
      const transactionCount = count ?? 0;

      await (supabase as any)
        .from("data_sources")
        .update({
          last_failed_sync_at: null,
          last_error_summary: null,
          last_successful_sync_at: new Date().toISOString(),
          transaction_count: transactionCount,
        })
        .eq("id", dataSourceId)
        .eq("user_id", userId);

      return { success: true, message: `Sync completed. ${inserted} new transactions.` };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      await (supabase as any)
        .from("data_sources")
        .update({
          last_failed_sync_at: new Date().toISOString(),
          last_error_summary: message.slice(0, 500),
        })
        .eq("id", dataSourceId)
        .eq("user_id", userId);
      return { success: false, error: message, status: 500 };
    }
  }

  return { success: false, error: "Unknown source type", status: 400 };
}
