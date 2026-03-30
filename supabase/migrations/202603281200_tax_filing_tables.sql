-- Tax Filing Center: overrides and disclaimer acknowledgment tracking
-- Safe to run multiple times (idempotent).

CREATE TABLE IF NOT EXISTS public.tax_filing_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tax_year INTEGER NOT NULL,
  form_type TEXT NOT NULL,
  line_key TEXT NOT NULL,
  original_value DECIMAL(12,2),
  override_value DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tax_year, form_type, line_key)
);

ALTER TABLE public.tax_filing_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own tax filing overrides" ON public.tax_filing_overrides;
CREATE POLICY "Users can manage own tax filing overrides"
  ON public.tax_filing_overrides FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tax_filing_overrides_user_year
  ON public.tax_filing_overrides(user_id, tax_year);

CREATE TABLE IF NOT EXISTS public.disclaimer_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  action_type TEXT NOT NULL,
  tax_year INTEGER NOT NULL,
  acknowledged_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.disclaimer_acknowledgments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own disclaimer acks" ON public.disclaimer_acknowledgments;
CREATE POLICY "Users can manage own disclaimer acks"
  ON public.disclaimer_acknowledgments FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_disclaimer_acks_user
  ON public.disclaimer_acknowledgments(user_id, tax_year);
