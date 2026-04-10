#!/usr/bin/env node
/**
 * List all data_sources (accounts) using the Supabase service role.
 *
 * Usage (from repo root, with env loaded):
 *   export $(grep -v '^#' .env.local | xargs) && node scripts/list-accounts.mjs
 *
 * Or Node 20+:
 *   node --env-file=.env.local scripts/list-accounts.mjs
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SECRET_KEY?.trim();

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase
  .from("data_sources")
  .select(
    [
      "id",
      "org_id",
      "user_id",
      "name",
      "source_type",
      "account_type",
      "institution",
      "transaction_count",
      "connected_at",
      "last_successful_sync_at",
      "last_failed_sync_at",
      "plaid_item_id",
      "plaid_account_id",
      "stripe_account_id",
      "financial_connections_account_id",
      "created_at",
    ].join(", ")
  )
  .order("created_at", { ascending: false });

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(JSON.stringify(data ?? [], null, 2));
console.error(`\n(${data?.length ?? 0} row(s))`);
