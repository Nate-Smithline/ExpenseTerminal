-- Ensure stripe_sync_start_date exists for Stripe Financial Connections lookback.
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS stripe_sync_start_date DATE;
