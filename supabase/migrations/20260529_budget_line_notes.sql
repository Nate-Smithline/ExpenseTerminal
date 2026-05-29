-- Optional notes on budget lines (shown in line detail sidebar)

ALTER TABLE public.budget_lines
  ADD COLUMN IF NOT EXISTS notes TEXT;
