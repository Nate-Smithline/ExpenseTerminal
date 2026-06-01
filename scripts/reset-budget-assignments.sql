-- Reset all budget line assignments for a given user.
-- Run in Supabase Dashboard → SQL Editor, or via:
--   psql $DATABASE_URL -f scripts/reset-budget-assignments.sql
--
-- What this does:
--   1. Finds the user by email.
--   2. Removes all rows from budget_line_transactions (unassigns every transaction).
--   3. Resets the marker + business_pct on those transactions back to NULL
--      so tax / budget pages start fresh.
--
-- Scope: change EMAIL below to target a specific account.
--        Change MONTH_KEY to limit to one month (e.g. '2026-05'), or remove
--        the month filter to reset all months at once.

DO $$
DECLARE
  v_user_id   UUID;
  v_email     TEXT := 'nathansmith500@gmail.com';
  v_month_key TEXT := NULL;  -- set to 'YYYY-MM' to limit to one month, or leave NULL for all months
  v_count     INT;
BEGIN

  -- 1. Resolve user
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE email = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found with email: %', v_email;
  END IF;

  RAISE NOTICE 'Resetting budget assignments for user % (%)', v_email, v_user_id;

  -- 2. Collect the transaction IDs that are about to be unlinked so we can
  --    reset their markers afterwards.
  CREATE TEMP TABLE _unlinked_txns ON COMMIT DROP AS
  SELECT blt.transaction_id
  FROM public.budget_line_transactions blt
  WHERE blt.user_id = v_user_id
    AND (
      v_month_key IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.transactions t
        WHERE t.id = blt.transaction_id
          AND to_char(t.date, 'YYYY-MM') = v_month_key
      )
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '  Found % assignment(s) to remove', v_count;

  -- 3. Delete the assignments
  DELETE FROM public.budget_line_transactions blt
  WHERE blt.user_id = v_user_id
    AND blt.transaction_id IN (SELECT transaction_id FROM _unlinked_txns);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '  Deleted % budget_line_transactions row(s)', v_count;

  -- 4. Reset marker + business_pct on those transactions
  UPDATE public.transactions
  SET
    marker        = NULL,
    business_pct  = NULL,
    updated_at    = now()
  WHERE user_id = v_user_id
    AND id IN (SELECT transaction_id FROM _unlinked_txns);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '  Reset marker/business_pct on % transaction(s)', v_count;

  RAISE NOTICE 'Done. Reload the budget page to see the updated state.';
END $$;
