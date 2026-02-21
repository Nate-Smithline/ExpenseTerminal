-- Remove all transactions with a transaction date in 2026.
-- Run in Supabase SQL Editor or via psql. RLS applies (users only affect own rows).
DELETE FROM public.transactions
WHERE date >= '2026-01-01' AND date < '2027-01-01';
