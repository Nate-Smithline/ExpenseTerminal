import type { SupabaseClient } from "@supabase/supabase-js";
import type { StripeMode } from "@/lib/stripe";
import { getStripeClient } from "@/lib/stripe";
import { normalizeVendor } from "@/lib/vendor-matching";

/**
 * Stripe Financial Connections `transactions.list` accepts `limit` between 1 and 100 (inclusive).
 * API default is 10; we use 100 to minimize round-trips. Pagination uses `has_more` + `starting_after`
 * until no further pages — there is no larger single-page limit on Stripe’s side.
 * @see https://docs.stripe.com/api/financial_connections/transactions/list
 */
const STRIPE_FC_TRANSACTIONS_PAGE_LIMIT = 100;

/** Returned on successful Stripe FC sync to compare against bank exports (e.g. Chase CSV). */
export type StripeSyncDiagnostics = {
  financialConnectionsAccountId: string;
  stripeMode: "test" | "live";
  /** `transacted_at` filter sent to Stripe FC list (UTC midnight interpretation of date strings). */
  transactedAtFilter: {
    gteIso?: string;
    lteIso?: string;
    gteUnix?: number;
    lteUnix?: number;
  };
  /** Stored lookback on `data_sources` (used when sync does not pass start_date). */
  stripeSyncStartDateStored: string | null;
  /** Every object returned across all paginated `transactions.list` calls. */
  rawTransactionsFromStripe: number;
  /** Stripe `status` histogram (`(missing)` if field absent). */
  statusBreakdown: Record<string, number>;
  /** Rows we keep (`status === "posted"` only — pending/void etc. are dropped). */
  postedIncludedInSync: number;
  /** Upsert calls with no error (includes duplicates ignored by `ignoreDuplicates`). */
  upsertCallsSucceeded: number;
  apiListPages: number;
  /** `limit` passed to each `transactions.list` call (Stripe allows 1–100). */
  transactionsListLimitPerPage: number;
  /** Row count in DB for this data source after sync. */
  transactionCountForDataSource: number;
  /** One entry per API request — proves we paginated until Stripe stopped. */
  paginationPages: Array<{
    page: number;
    rowCount: number;
    /** Stripe says another page exists after this one. */
    has_more: boolean;
    /** Last transaction id on this page (cursor for next request). */
    lastTransactionId?: string;
  }>;
  /** Why the pagination loop ended (not an arbitrary row cap). */
  paginationStoppedBecause: "empty_page" | "stripe_has_more_false";
};

export type SyncResult = {
  success: boolean;
  message?: string;
  error?: string;
  code?: string;
  status?: number;
  /** Present after a successful `stripe` sync. */
  diagnostics?: StripeSyncDiagnostics;
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
      let startDate = (options?.startDate !== undefined ? options.startDate : row.stripe_sync_start_date) as string | null;
      const endDate = options?.endDate ?? null;
      // Don't filter by a start date in the future (would return zero transactions).
      if (startDate && new Date(startDate) > new Date()) {
        startDate = null;
      }

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

      // Ensure we're subscribed to transaction data, then ensure a refresh has completed before listing.
      // Per Stripe docs: "After you initiate a transaction refresh, you must wait for it to complete, then retrieve the resulting transactions."
      let account: { transaction_refresh?: { status?: string; id?: string } | null } | null = null;
      try {
        await fc.accounts.subscribe(fcAccountId, { features: ["transactions"] });
      } catch {
        try {
          await fc.accounts.refresh(fcAccountId, { features: ["transactions"] });
        } catch {
          // Continue; we may already have data from a previous refresh.
        }
      }

      const refreshTimeoutMs = 120_000;
      const pollIntervalMs = 5_000;
      const deadline = Date.now() + refreshTimeoutMs;
      let refreshedOnce = false;
      let failedRetries = 0;
      const maxFailedRetries = 1;
      const failMessage = "Your bank didn’t provide transaction data. Try again in a few minutes, or reconnect the account (Repair connection on the account card).";

      while (Date.now() < deadline) {
        account = await fc.accounts.retrieve(fcAccountId);
        const tr = account?.transaction_refresh;
        const status = tr?.status ?? null;
        if (status === "succeeded") break;
        if (status === "pending") {
          await new Promise((r) => setTimeout(r, pollIntervalMs));
          continue;
        }
        if (status === "failed") {
          if (failedRetries < maxFailedRetries) {
            failedRetries += 1;
            try {
              await fc.accounts.refresh(fcAccountId, { features: ["transactions"] });
            } catch {
              // Continue to poll; refresh may have been accepted.
            }
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          await (supabase as any)
            .from("data_sources")
            .update({
              last_failed_sync_at: new Date().toISOString(),
              last_error_summary: failMessage,
            })
            .eq("id", dataSourceId)
            .eq("user_id", userId);
          return {
            success: false,
            error: failMessage,
            status: 502,
          };
        }
        // status is null or unknown: no refresh has completed yet. Trigger one if we haven't.
        if (!refreshedOnce) {
          refreshedOnce = true;
          try {
            await fc.accounts.refresh(fcAccountId, { features: ["transactions"] });
          } catch {
            // Ignore; we'll poll and may see pending/succeeded from the earlier subscribe.
          }
        }
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }

      if (account?.transaction_refresh?.status !== "succeeded") {
        const lastStatus = account?.transaction_refresh?.status ?? "null";
        console.warn("[sync-runner] Transaction refresh did not complete in time", { dataSourceId, lastStatus });
        await (supabase as any)
          .from("data_sources")
          .update({
            last_failed_sync_at: new Date().toISOString(),
            last_error_summary: "Transaction refresh did not complete in time. Try again in a few minutes.",
          })
          .eq("id", dataSourceId)
          .eq("user_id", userId);
        return {
          success: false,
          error: "Transaction refresh did not complete in time. Try again in a few minutes.",
          status: 504,
        };
      }

      const refreshId = account?.transaction_refresh?.id;
      console.warn("[sync-runner] Transaction refresh succeeded", { dataSourceId, mode, refreshId: refreshId ?? undefined });

      const allTx: Array<{ id: string; amount: number; description?: string; transacted_at: number; status?: string }> = [];
      let startingAfter: string | undefined;
      let rawTransactionsFromStripe = 0;
      let apiListPages = 0;
      const paginationPages: StripeSyncDiagnostics["paginationPages"] = [];
      let paginationStoppedBecause: StripeSyncDiagnostics["paginationStoppedBecause"] = "stripe_has_more_false";
      const statusBreakdown: Record<string, number> = {};
      const transactedAt: Record<string, number> = {};
      if (startDate) transactedAt.gte = Math.floor(new Date(startDate).getTime() / 1000);
      if (endDate) transactedAt.lte = Math.floor(new Date(endDate).getTime() / 1000);
      const transactedAtFilter = {
        gteIso: startDate ?? undefined,
        lteIso: endDate ?? undefined,
        gteUnix: transactedAt.gte,
        lteUnix: transactedAt.lte,
      };

      // Paginate with Stripe's cursor: repeat while `has_more` is true, advancing `starting_after`.
      for (;;) {
        apiListPages += 1;
        const listParams: Record<string, unknown> = {
          account: fcAccountId,
          limit: STRIPE_FC_TRANSACTIONS_PAGE_LIMIT,
        };
        if (Object.keys(transactedAt).length > 0) listParams.transacted_at = transactedAt;
        if (startingAfter) listParams.starting_after = startingAfter;

        let list: { data?: unknown[]; has_more?: boolean; hasMore?: boolean } | null = null;
        try {
          list = await (stripe as any).financialConnections.transactions.list(listParams);
        } catch (listErr) {
          const listMessage = listErr instanceof Error ? listErr.message : String(listErr);
          await (supabase as any)
            .from("data_sources")
            .update({
              last_failed_sync_at: new Date().toISOString(),
              last_error_summary: listMessage.slice(0, 500),
            })
            .eq("id", dataSourceId)
            .eq("user_id", userId);
          console.warn("[sync-runner] List transactions failed", { dataSourceId, listMessage });
          return { success: false, error: listMessage, status: 502 };
        }

        const data = (list?.data ?? []) as Array<{ id: string; amount: number; description?: string; transacted_at: number; status?: string }>;
        rawTransactionsFromStripe += data.length;
        for (const tx of data) {
          const key = tx?.status == null || tx.status === "" ? "(missing)" : String(tx.status);
          statusBreakdown[key] = (statusBreakdown[key] ?? 0) + 1;
        }
        // Stripe Node may expose snake_case or camelCase on list responses.
        const stripeReportsMorePages =
          list?.has_more === true || list?.hasMore === true;

        paginationPages.push({
          page: apiListPages,
          rowCount: data.length,
          has_more: stripeReportsMorePages,
          lastTransactionId: data.length > 0 ? data[data.length - 1]!.id : undefined,
        });

        if (allTx.length === 0) {
          console.warn("[sync-runner] First list response", {
            dataSourceId,
            count: data.length,
            has_more: list?.has_more,
            hasMore: list?.hasMore,
            transacted_at: listParams.transacted_at,
          });
        }
        // Only include posted (completed) transactions; skip pending and void.
        const posted = data.filter((tx) => tx?.status === "posted");
        allTx.push(...posted);

        if (data.length === 0) {
          paginationStoppedBecause = "empty_page";
          break;
        }
        if (!stripeReportsMorePages) {
          paginationStoppedBecause = "stripe_has_more_false";
          break;
        }
        startingAfter = data[data.length - 1]!.id;
      }

      let inserted = 0;
      let firstInsertError: string | null = null;
      for (const tx of allTx) {
        const date = new Date((tx.transacted_at ?? 0) * 1000);
        const dateStr = date.toISOString().slice(0, 10);
        const year = date.getFullYear();
        // Stripe FC returns positive amounts for credits (money in) and negative for debits (money out); keep that sign.
        const amount = Number(((tx.amount ?? 0) / 100).toFixed(2));
        const vendor = ((tx.description ?? "Unknown") as string).slice(0, 255);
        const vendorNormalized = vendor.trim() ? normalizeVendor(vendor) : null;
        const { error: insErr } = await (supabase as any)
          .from("transactions")
          .upsert(
            {
              user_id: userId,
              date: dateStr,
              vendor,
              vendor_normalized: vendorNormalized,
              description: tx.description ?? null,
              amount,
              status: "pending",
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
        if (insErr && !firstInsertError) {
          firstInsertError = insErr.message ?? String(insErr);
          console.warn("[sync-runner] First insert error", { dataSourceId, error: firstInsertError, txId: tx.id });
        }
        if (!insErr) inserted++;
      }

      const { count } = await (supabase as any)
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("data_source_id", dataSourceId);
      const transactionCount = count ?? 0;

      const hadListedButNoInsert = allTx.length > 0 && inserted === 0 && firstInsertError;
      await (supabase as any)
        .from("data_sources")
        .update({
          last_failed_sync_at: hadListedButNoInsert ? new Date().toISOString() : null,
          last_error_summary: hadListedButNoInsert && firstInsertError ? `Transactions could not be saved: ${firstInsertError.slice(0, 400)}` : null,
          last_successful_sync_at: new Date().toISOString(),
          transaction_count: transactionCount,
        })
        .eq("id", dataSourceId)
        .eq("user_id", userId);

      const diagnostics: StripeSyncDiagnostics = {
        financialConnectionsAccountId: fcAccountId,
        stripeMode: mode,
        transactedAtFilter,
        stripeSyncStartDateStored: (row.stripe_sync_start_date as string | null) ?? null,
        rawTransactionsFromStripe,
        statusBreakdown,
        postedIncludedInSync: allTx.length,
        upsertCallsSucceeded: inserted,
        apiListPages,
        transactionsListLimitPerPage: STRIPE_FC_TRANSACTIONS_PAGE_LIMIT,
        transactionCountForDataSource: transactionCount,
        paginationPages,
        paginationStoppedBecause,
      };
      console.warn("[sync-runner] Sync completed", {
        dataSourceId,
        ...diagnostics,
        firstInsertError: firstInsertError ?? undefined,
      });
      return {
        success: true,
        message: `Sync completed. ${inserted} new transactions.`,
        diagnostics,
      };
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
