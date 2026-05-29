-- =============================================================================
-- Plaid account-level columns: pull_transactions, plaid_account_id,
-- plaid_sync_start_date, institution_name, mask, balance, balance_updated_at.
-- Safe to run multiple times (idempotent).
-- =============================================================================

-- pull_transactions — when false, balance syncs but transactions are not imported
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS pull_transactions BOOLEAN NOT NULL DEFAULT TRUE;

-- Per-account Plaid account ID (used to match balance data back to a data source)
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS plaid_account_id TEXT;

-- User-chosen lookback start date for transaction import
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS plaid_sync_start_date DATE;

-- institution_name — mirrors the existing `institution` column for newer code paths
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS institution_name TEXT;

-- mask — last 4 digits of account number
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS mask TEXT;

-- balance — current account balance from Plaid
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS balance DECIMAL(14, 2);

-- balance_updated_at — timestamp of the last balance fetch
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS balance_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_data_sources_plaid_account_id
  ON public.data_sources(plaid_account_id)
  WHERE plaid_account_id IS NOT NULL;
