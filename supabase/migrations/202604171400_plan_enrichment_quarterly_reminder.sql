-- Plan: transaction enrichment columns + quarterly tax reminder tracking on profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_quarterly_tax_reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.last_quarterly_tax_reminder_sent_at IS
  'Set when quarterly estimated tax reminder email was sent (America/New_York send days: Mar 1, May 1, Aug 1, Dec 1).';

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS plaid_raw_json JSONB;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS display_name TEXT;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS rename_confidence DOUBLE PRECISION;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS rename_source TEXT;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS deduction_suggestions JSONB;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS deduction_likelihood TEXT;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS routed_to_inbox BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS inbox_resolved_at TIMESTAMPTZ;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS enrichment_status TEXT NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_transactions_enrichment_pending
  ON public.transactions (user_id, enrichment_status)
  WHERE enrichment_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_transactions_display_name_search
  ON public.transactions (user_id)
  WHERE display_name IS NOT NULL;
