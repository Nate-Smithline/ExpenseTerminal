-- =============================================================================
-- Give every account belonging to demo@demo.com a realistic balance.
--
-- Balances are derived from the user's actual recorded income so they stay in
-- proportion to the account's financial profile:
--   • Checking    →  ~1.5 months of income  (working cash buffer)
--   • Savings     →  ~6 months of income     (emergency fund + savings)
--   • Credit card →  small negative balance  (current revolving statement)
--   • Other       →  ~1 month of income
--
-- If there are multiple accounts of the same type, the allocation is split
-- evenly between them. Safe to re-run; it only updates balances.
--
-- Run in the Supabase SQL Editor (Dashboard -> SQL Editor) with a privileged
-- role (postgres / service role).
-- =============================================================================

DO $$
DECLARE
  v_email        TEXT := 'demo@demo.com';
  v_uid          UUID;
  v_annual_inc   NUMERIC;   -- best full-year income figure for this user
  v_monthly_inc  NUMERIC;
  acct           RECORD;
  v_type         TEXT;
  v_count        INT;
  v_balance      NUMERIC;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = v_email;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'User % not found.', v_email;
  END IF;

  -- Use the most recent calendar year that has income, falling back to all-time.
  SELECT COALESCE(
           (SELECT SUM(amount)
              FROM public.transactions
             WHERE user_id = v_uid
               AND transaction_type = 'income'
               AND date >= date_trunc('year', (SELECT MAX(date) FROM public.transactions WHERE user_id = v_uid AND transaction_type = 'income'))
                         - INTERVAL '1 year'
               AND date <  date_trunc('year', (SELECT MAX(date) FROM public.transactions WHERE user_id = v_uid AND transaction_type = 'income'))),
           (SELECT SUM(amount) FROM public.transactions WHERE user_id = v_uid AND transaction_type = 'income'),
           120000
         )
    INTO v_annual_inc;

  -- Guard against a tiny/empty history producing silly balances.
  IF v_annual_inc IS NULL OR v_annual_inc < 60000 THEN
    v_annual_inc := 120000;
  END IF;

  v_monthly_inc := v_annual_inc / 12.0;
  RAISE NOTICE 'Annual income basis for %: % (monthly %)', v_email, round(v_annual_inc, 2), round(v_monthly_inc, 2);

  FOR acct IN
    SELECT account_type
    FROM public.data_sources
    WHERE user_id = v_uid
    GROUP BY account_type
  LOOP
    v_type  := COALESCE(acct.account_type, 'other');
    SELECT COUNT(*) INTO v_count
      FROM public.data_sources
     WHERE user_id = v_uid AND COALESCE(account_type, 'other') = v_type;

    IF v_type IN ('credit', 'credit_card', 'loan', 'liability') THEN
      v_balance := -(v_monthly_inc * 0.35);          -- ~1/3 month revolving
    ELSIF v_type = 'savings' THEN
      v_balance :=  v_monthly_inc * 6.0;             -- ~6 months saved
    ELSIF v_type = 'checking' THEN
      v_balance :=  v_monthly_inc * 1.5;             -- ~1.5 months buffer
    ELSE
      v_balance :=  v_monthly_inc * 1.0;             -- ~1 month
    END IF;

    -- Split the allocation evenly across same-type accounts, round to cents.
    v_balance := round(v_balance / GREATEST(v_count, 1), 2);

    UPDATE public.data_sources
       SET balance = v_balance,
           balance_updated_at = NOW()
     WHERE user_id = v_uid
       AND COALESCE(account_type, 'other') = v_type;

    RAISE NOTICE '  % account(s) of type % -> each %', v_count, v_type, v_balance;
  END LOOP;

  RAISE NOTICE 'Updated account balances for %', v_email;
END $$;

-- Show the result.
SELECT d.name, d.account_type, d.balance, d.balance_updated_at
FROM public.data_sources d
JOIN auth.users u ON u.id = d.user_id
WHERE u.email = 'demo@demo.com'
ORDER BY d.account_type, d.name;
