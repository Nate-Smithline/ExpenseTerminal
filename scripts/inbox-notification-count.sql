-- Inbox notification count (matches app: pending + inbox-eligible).
-- Run after delete-transactions-2026.sql or anytime to see current inbox size.
-- Uses same filters as Inbox:
--   status = 'pending' AND (
--     (transaction_type = 'expense' AND ai_confidence IS NOT NULL)
--     OR transaction_type = 'income'
--   ).

-- Total inbox count across all users
SELECT COUNT(*) AS inbox_notifications_total
FROM public.transactions
WHERE status = 'pending'
  AND (
    (transaction_type = 'expense' AND ai_confidence IS NOT NULL)
    OR transaction_type = 'income'
  );

-- Per user and tax year (for debugging or per-user notifications)
SELECT
  user_id,
  tax_year,
  COUNT(*) AS inbox_count
FROM public.transactions
WHERE status = 'pending'
  AND (
    (transaction_type = 'expense' AND ai_confidence IS NOT NULL)
    OR transaction_type = 'income'
  )
GROUP BY user_id, tax_year
ORDER BY user_id, tax_year;
