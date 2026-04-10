-- Optional ending balance for manual (non-Plaid) accounts, editable in UI
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS manual_balance NUMERIC(18, 2);
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS manual_balance_iso_currency_code TEXT DEFAULT 'USD';
