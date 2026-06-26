ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS expected_income NUMERIC,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS filing_status TEXT,
  ADD COLUMN IF NOT EXISTS triage_reminder_frequency TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS industry_custom TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

