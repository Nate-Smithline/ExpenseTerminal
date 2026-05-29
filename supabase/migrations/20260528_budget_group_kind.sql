-- Add budget group kind (income vs expense)
-- Existing groups default to 'expense' until explicitly set.

ALTER TABLE public.budget_groups
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'expense';

ALTER TABLE public.budget_groups
  DROP CONSTRAINT IF EXISTS budget_groups_kind_check;

ALTER TABLE public.budget_groups
  ADD CONSTRAINT budget_groups_kind_check
  CHECK (kind IN ('income', 'expense'));

CREATE INDEX IF NOT EXISTS idx_budget_groups_month_kind
  ON public.budget_groups(budget_month_id, kind);

