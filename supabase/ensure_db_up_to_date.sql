-- =============================================================================
-- Ensure database is up to date for Expense Terminal (sync, data sources, transactions)
-- Run this in Supabase SQL Editor or via psql. Safe to run multiple times (idempotent).
--
-- Critical for sync: section 3 adds the UNIQUE constraint on (data_source_id,
-- data_feed_external_id) so Supabase upsert() can resolve conflicts. Without it,
-- sync completes but 0 transactions are inserted.
--
-- If section 5 fails (e.g. "policy already exists"), comment out that block.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. data_sources: missing columns (Stripe / Direct Feed)
-- -----------------------------------------------------------------------------
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS financial_connections_account_id TEXT;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS last_successful_sync_at TIMESTAMPTZ;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS last_failed_sync_at TIMESTAMPTZ;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS last_error_summary TEXT;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS transaction_count INTEGER DEFAULT 0;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS stripe_sync_start_date DATE;

-- Plaid columns (added in Stripe-to-Plaid migration)
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS plaid_access_token TEXT;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS plaid_item_id TEXT;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS plaid_cursor TEXT;
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS plaid_institution_id TEXT;

CREATE INDEX IF NOT EXISTS idx_data_sources_plaid_item_id
  ON public.data_sources(plaid_item_id)
  WHERE plaid_item_id IS NOT NULL;

-- Unique index: one data source per Stripe FC account per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_data_sources_user_fc_account
  ON public.data_sources(user_id, financial_connections_account_id)
  WHERE financial_connections_account_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. transactions: columns required for Direct Feed (Stripe) upsert
-- -----------------------------------------------------------------------------
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS data_source_id UUID REFERENCES public.data_sources(id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS data_feed_external_id TEXT;

-- Index for listing transactions by data source
CREATE INDEX IF NOT EXISTS idx_transactions_data_source ON public.transactions(data_source_id);

-- Partial unique index (for queries); kept for compatibility
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_data_feed_external
  ON public.transactions(data_source_id, data_feed_external_id)
  WHERE data_feed_external_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. transactions: UNIQUE constraint so Supabase upsert onConflict works
--    (Required for sync: ON CONFLICT (data_source_id, data_feed_external_id))
-- -----------------------------------------------------------------------------
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_data_feed_external_key;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_data_feed_external_key
  UNIQUE (data_source_id, data_feed_external_id);

-- -----------------------------------------------------------------------------
-- 4. transactions: other columns/indexes used by app
-- -----------------------------------------------------------------------------
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'expense';
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_transaction_type_check
  CHECK (transaction_type IN ('expense', 'income'));
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS deduction_percent INTEGER DEFAULT 100;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS eligible_for_ai BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_transactions_user_status ON public.transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_tax_year ON public.transactions(tax_year);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_year_status_type
  ON public.transactions(user_id, tax_year, status, transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_ai_eligibility
  ON public.transactions(user_id, source, eligible_for_ai);

-- -----------------------------------------------------------------------------
-- 5. auto_sort_rules: table and columns (for "Apply to all similar")
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auto_sort_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  vendor_pattern TEXT NOT NULL,
  quick_label TEXT NOT NULL,
  business_purpose TEXT,
  category TEXT,
  name TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  action JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.auto_sort_rules ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.auto_sort_rules ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.auto_sort_rules ADD COLUMN IF NOT EXISTS conditions JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.auto_sort_rules ADD COLUMN IF NOT EXISTS action JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_auto_sort_rules_user ON public.auto_sort_rules(user_id);

-- -----------------------------------------------------------------------------
-- 6. RLS (ensure policies exist; skip if you already have them)
-- -----------------------------------------------------------------------------
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own transactions" ON public.transactions;
CREATE POLICY "Users can manage own transactions"
  ON public.transactions FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own data sources" ON public.data_sources;
CREATE POLICY "Users can manage own data sources"
  ON public.data_sources FOR ALL
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 7. Tax Filing: overrides and disclaimer acknowledgments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tax_filing_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tax_year INTEGER NOT NULL,
  form_type TEXT NOT NULL,
  line_key TEXT NOT NULL,
  original_value DECIMAL(12,2),
  override_value DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tax_year, form_type, line_key)
);

ALTER TABLE public.tax_filing_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own tax filing overrides" ON public.tax_filing_overrides;
CREATE POLICY "Users can manage own tax filing overrides"
  ON public.tax_filing_overrides FOR ALL
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_tax_filing_overrides_user_year
  ON public.tax_filing_overrides(user_id, tax_year);

CREATE TABLE IF NOT EXISTS public.disclaimer_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  action_type TEXT NOT NULL,
  tax_year INTEGER NOT NULL,
  acknowledged_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.disclaimer_acknowledgments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own disclaimer acks" ON public.disclaimer_acknowledgments;
CREATE POLICY "Users can manage own disclaimer acks"
  ON public.disclaimer_acknowledgments FOR ALL
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_disclaimer_acks_user
  ON public.disclaimer_acknowledgments(user_id, tax_year);
