-- Fix Stripe Direct Feed transaction signs.
-- Problem: early Stripe Financial Connections imports stored amounts with the wrong sign,
-- so credits (money in) looked like negatives and debits (money out) looked like positives.
--
-- This script:
--   1) Flips the sign of all Direct Feed (Stripe) transactions.
--   2) Recomputes transaction_type from the new sign:
--        amount >= 0  → 'income'
--        amount < 0   → 'expense'
--
-- Scope:
--   - Only rows where transactions.source = 'data_feed'
--   - You can optionally add a date filter (for example, only 2026 imports).
--
-- Recommended use:
--   - Run once in the Supabase SQL editor or psql against your database.
--   - Review a few known accounts after running to confirm behavior.

-- BEGIN;

UPDATE public.transactions
SET
  amount = (-1 * amount::numeric),
  transaction_type = CASE
    WHEN (-1 * amount::numeric) >= 0 THEN 'income'
    ELSE 'expense'
  END
WHERE source = 'data_feed';
--  AND date >= '2026-01-01'  -- (optional) restrict to a time window
--  AND data_source_id IN (
--    SELECT id FROM public.data_sources
--    WHERE financial_connections_account_id IS NOT NULL
--  );

-- COMMIT;

