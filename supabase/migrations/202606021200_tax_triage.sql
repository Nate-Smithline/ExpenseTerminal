-- Tax Triage: marker rules on auto_sort_rules + persistent gamification

-- Marker rules (Personal / Business / Partial) for vendor auto-tagging
ALTER TABLE public.auto_sort_rules
  ADD COLUMN IF NOT EXISTS marker TEXT
    CHECK (marker IS NULL OR marker IN ('Personal', 'Business', 'Partial')),
  ADD COLUMN IF NOT EXISTS business_pct SMALLINT
    CHECK (business_pct IS NULL OR (business_pct >= 0 AND business_pct <= 100));

CREATE INDEX IF NOT EXISTS idx_auto_sort_rules_marker
  ON public.auto_sort_rules(user_id)
  WHERE marker IS NOT NULL;

-- Persistent triage gamification (one row per user)
CREATE TABLE IF NOT EXISTS public.triage_progress (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_sorted INTEGER NOT NULL DEFAULT 0,
  rules_created INTEGER NOT NULL DEFAULT 0,
  lifetime_deductions NUMERIC(14, 2) NOT NULL DEFAULT 0,
  lifetime_tax_saved NUMERIC(14, 2) NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_triage_date DATE,
  badges JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.triage_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own triage progress" ON public.triage_progress;
CREATE POLICY "Users can manage own triage progress"
  ON public.triage_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
