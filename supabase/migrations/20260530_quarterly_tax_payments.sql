-- Track quarterly estimated tax payments (mark paid) per tax year

CREATE TABLE IF NOT EXISTS public.quarterly_tax_payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tax_year     INT NOT NULL,
  quarter      SMALLINT NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  amount_paid  DECIMAL(12, 2),
  paid_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tax_year, quarter)
);

ALTER TABLE public.quarterly_tax_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own quarterly_tax_payments"
  ON public.quarterly_tax_payments
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_quarterly_tax_payments_user_year
  ON public.quarterly_tax_payments(user_id, tax_year);
