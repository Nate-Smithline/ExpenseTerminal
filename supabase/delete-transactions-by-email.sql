-- Delete all transactions for the account with email matt.smith24@outlook.com
-- Run in Supabase SQL Editor (Dashboard → SQL Editor). Use a role that can read auth.users
-- and delete from public.transactions (e.g. service role or postgres).

DELETE FROM public.transactions
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'matt.smith24@outlook.com');
