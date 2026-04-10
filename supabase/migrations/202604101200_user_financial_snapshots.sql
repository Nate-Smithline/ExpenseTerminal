-- Daily rollup of balances for net worth history (MTD/YTD deltas on dashboard).
CREATE TABLE IF NOT EXISTS public.user_financial_snapshots (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  net_worth NUMERIC(18, 2) NOT NULL,
  total_assets NUMERIC(18, 2) NOT NULL,
  total_liabilities NUMERIC(18, 2) NOT NULL,
  accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_user_financial_snapshots_user_date_desc
  ON public.user_financial_snapshots (user_id, snapshot_date DESC);

ALTER TABLE public.user_financial_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own financial snapshots"
  ON public.user_financial_snapshots FOR SELECT
  USING (auth.uid() = user_id);

-- Writes are intended for service role (cron) only; no INSERT/UPDATE policies for authenticated users.
