-- Add explicit rollup semantics for Assets/Liabilities on dashboards.
-- These fields are user-overridable so totals remain trustworthy.

ALTER TABLE data_sources
  ADD COLUMN IF NOT EXISTS balance_class TEXT;

ALTER TABLE data_sources
  ADD COLUMN IF NOT EXISTS include_in_net_worth BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE data_sources
  ADD COLUMN IF NOT EXISTS balance_value_preference TEXT;

-- Optional: keep values constrained to known enums.
ALTER TABLE data_sources
  DROP CONSTRAINT IF EXISTS data_sources_balance_class_check;
ALTER TABLE data_sources
  ADD CONSTRAINT data_sources_balance_class_check
  CHECK (balance_class IN ('asset', 'liability'));

ALTER TABLE data_sources
  DROP CONSTRAINT IF EXISTS data_sources_balance_value_preference_check;
ALTER TABLE data_sources
  ADD CONSTRAINT data_sources_balance_value_preference_check
  CHECK (balance_value_preference IN ('current', 'available', 'manual'));

-- Backfill defaults for existing rows.
UPDATE data_sources
SET balance_class = CASE
  WHEN account_type = 'credit' THEN 'liability'
  ELSE 'asset'
END
WHERE balance_class IS NULL;

UPDATE data_sources
SET balance_value_preference = CASE
  WHEN source_type = 'manual' THEN 'manual'
  WHEN account_type = 'credit' THEN 'current'
  ELSE 'current'
END
WHERE balance_value_preference IS NULL;

CREATE INDEX IF NOT EXISTS idx_data_sources_user_balance_rollup
  ON data_sources (user_id, include_in_net_worth, balance_class);

