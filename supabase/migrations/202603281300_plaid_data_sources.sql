-- Add Plaid columns to data_sources for the Stripe-to-Plaid transaction migration.
-- Existing stripe columns are kept so legacy stripe sources continue to work during transition.

ALTER TABLE data_sources
  ADD COLUMN IF NOT EXISTS plaid_access_token text,
  ADD COLUMN IF NOT EXISTS plaid_item_id text,
  ADD COLUMN IF NOT EXISTS plaid_cursor text,
  ADD COLUMN IF NOT EXISTS plaid_institution_id text;

-- Index for webhook lookups by item_id
CREATE INDEX IF NOT EXISTS idx_data_sources_plaid_item_id
  ON data_sources (plaid_item_id)
  WHERE plaid_item_id IS NOT NULL;
