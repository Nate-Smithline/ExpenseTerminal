-- =============================================================================
-- Phase 1: Zero-click analysis, smart rules, quarterly reminders, monthly summary
-- =============================================================================

-- ── Quarterly reminders tracking ──────────────────────────────────────────────
-- One row per user per quarterly reminder period (e.g. "2026-Q1-14d").
-- Prevents duplicate sends when the cron runs daily.

CREATE TABLE IF NOT EXISTS public.quarterly_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  period TEXT NOT NULL,   -- e.g. "2026-Q1-14d" or "2026-Q1-3d"
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period)
);

ALTER TABLE public.quarterly_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quarterly reminders"
  ON public.quarterly_reminders FOR SELECT
  USING (auth.uid() = user_id);

-- Service role inserts; no user-facing write policy needed.

CREATE INDEX IF NOT EXISTS idx_quarterly_reminders_user
  ON public.quarterly_reminders(user_id, period);

-- ── Monthly summary tracking ───────────────────────────────────────────────────
-- One row per user per monthly period (e.g. "2026-04").
-- Prevents duplicate sends if the cron retries on the 1st of the month.

CREATE TABLE IF NOT EXISTS public.monthly_summaries_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  period TEXT NOT NULL,   -- e.g. "2026-04" (YYYY-MM)
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period)
);

ALTER TABLE public.monthly_summaries_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own monthly summaries"
  ON public.monthly_summaries_sent FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_monthly_summaries_sent_user
  ON public.monthly_summaries_sent(user_id, period);

-- ── Plaid category on transactions ────────────────────────────────────────────
-- Stores Plaid's personal_finance_category.primary so MCC-based rules can match it.
-- Populated by the sync-runner on new Plaid transactions.

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS plaid_category TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_plaid_category
  ON public.transactions(plaid_category)
  WHERE plaid_category IS NOT NULL;
