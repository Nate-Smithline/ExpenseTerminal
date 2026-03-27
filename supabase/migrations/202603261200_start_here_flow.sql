-- Start here onboarding flow additions
ALTER TABLE public.org_settings
  ADD COLUMN IF NOT EXISTS personal_filing_status TEXT;

ALTER TABLE public.tax_year_settings
  ADD COLUMN IF NOT EXISTS expected_income_range TEXT;
