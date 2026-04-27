-- Columns referenced by app/api/transactions GET explicit select list.
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS deduction_likelihood TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS enrichment_status TEXT NOT NULL DEFAULT 'pending';
