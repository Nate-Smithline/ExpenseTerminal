-- Delete transactions for nathansmith500@gmail.com
-- Run in Supabase SQL Editor (Dashboard → SQL Editor) with a role that can read
-- auth.users and delete from public.transactions (service role or postgres).
--
-- Note: transactions are keyed by user_id, not workspace_id. Workspaces are not
-- yet linked to auth users in this schema; data_sources.workspace_id is usually NULL.
-- This script deletes all transactions owned by the user, including orphaned rows
-- (data_source_id IS NULL) left over from older account deletes.

-- ── 1. Preview (run first) ──────────────────────────────────────────────────

SELECT u.id AS user_id, u.email
FROM auth.users u
WHERE u.email = 'nathansmith500@gmail.com';

SELECT
  COUNT(*) AS total_transactions,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE data_source_id IS NULL) AS orphaned_unlinked,
  COUNT(*) FILTER (WHERE data_source_id IS NOT NULL) AS linked_to_account
FROM public.transactions
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'nathansmith500@gmail.com');

SELECT ds.id, ds.name, ds.workspace_id, COUNT(t.id) AS transaction_count
FROM public.data_sources ds
LEFT JOIN public.transactions t ON t.data_source_id = ds.id
WHERE ds.user_id = (SELECT id FROM auth.users WHERE email = 'nathansmith500@gmail.com')
GROUP BY ds.id, ds.name, ds.workspace_id
ORDER BY ds.name;

-- ── 2. Delete (uncomment after reviewing counts above) ──────────────────────

-- BEGIN;

-- DELETE FROM public.transactions
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'nathansmith500@gmail.com');

-- COMMIT;
