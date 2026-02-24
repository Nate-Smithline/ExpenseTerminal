-- Fix tax_year on existing transactions so it matches the calendar year
-- derived from the transaction date.
--
-- Safety notes:
-- - Only touches rows where status is not 'pending' (i.e. already sorted / reviewed).
-- - Only updates when tax_year actually disagrees with the year from date.
-- - Run this in a transaction if your tooling supports it.

-- 1) Preview what would change (per user + year)
SELECT
  user_id,
  tax_year                           AS current_tax_year,
  EXTRACT(YEAR FROM date::date)      AS derived_year,
  COUNT(*)                           AS row_count
FROM public.transactions
WHERE status IN ('completed','personal','auto_sorted')
  AND date IS NOT NULL
  AND tax_year IS DISTINCT FROM EXTRACT(YEAR FROM date::date)
GROUP BY user_id, tax_year, EXTRACT(YEAR FROM date::date)
ORDER BY user_id, current_tax_year, derived_year;

-- 2) Apply the fix
UPDATE public.transactions
SET tax_year = EXTRACT(YEAR FROM date::date)
WHERE status IN ('completed','personal','auto_sorted')
  AND date IS NOT NULL
  AND tax_year IS DISTINCT FROM EXTRACT(YEAR FROM date::date);

