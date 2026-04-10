-- Plaid account id (maps each data_sources row to a Plaid account for balances)
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS plaid_account_id TEXT;

-- Cached balance snapshot from Plaid (accountsBalanceGet), updated on sync / link
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS plaid_balance_current NUMERIC(18, 2);
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS plaid_balance_available NUMERIC(18, 2);
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS plaid_balance_limit NUMERIC(18, 2);
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS plaid_balance_iso_currency_code TEXT DEFAULT 'USD';
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS plaid_balance_as_of TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_data_sources_plaid_item_account
  ON data_sources (plaid_item_id, plaid_account_id)
  WHERE plaid_item_id IS NOT NULL;
