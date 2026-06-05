-- Fix: plaid_category drifted to text[] in the live database.
--
-- All application code, the TypeScript database types, the rules engine, and
-- every prior migration treat `plaid_category` as a SCALAR text value (the
-- Plaid personal_finance_category.primary, e.g. "income", "food_and_drink").
-- Because the live column became `text[]`, the Plaid sync's scalar insert
-- failed on every row with: malformed array literal: "income"
-- — so no Plaid transactions could be saved.
--
-- This converts the column back to scalar text, collapsing any legacy array
-- values to their primary (first) element, lowercased to match new writes.
-- Idempotent: only runs the conversion when the column is still an array.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transactions'
      AND column_name = 'plaid_category'
      AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE public.transactions
      ALTER COLUMN plaid_category TYPE text
      USING (
        CASE
          WHEN plaid_category IS NULL OR cardinality(plaid_category) = 0 THEN NULL
          ELSE lower(plaid_category[1])
        END
      );
  END IF;
END
$$;

-- ALTER COLUMN ... TYPE drops indexes that depend on the column; recreate it.
CREATE INDEX IF NOT EXISTS idx_transactions_plaid_category
  ON public.transactions(plaid_category)
  WHERE plaid_category IS NOT NULL;
