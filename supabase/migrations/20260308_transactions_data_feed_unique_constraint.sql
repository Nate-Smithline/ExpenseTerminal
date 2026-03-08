-- Ensure columns exist (they may already from schema.sql or prior migrations).
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS data_source_id UUID REFERENCES public.data_sources(id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS data_feed_external_id TEXT;

-- Add a non-partial UNIQUE constraint so Supabase upsert's onConflict works.
-- The existing partial unique index (WHERE data_feed_external_id IS NOT NULL) is not
-- matched by ON CONFLICT (data_source_id, data_feed_external_id) in the client.
-- This constraint allows multiple (data_source_id, NULL) for non-feed rows.
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_data_feed_external_key;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_data_feed_external_key
  UNIQUE (data_source_id, data_feed_external_id);
