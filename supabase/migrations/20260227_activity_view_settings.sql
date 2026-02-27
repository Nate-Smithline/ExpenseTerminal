-- Activity view settings: persisted filters, sort, and visible columns per user.

CREATE TABLE IF NOT EXISTS public.activity_view_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  sort_column TEXT DEFAULT 'date',
  sort_asc BOOLEAN DEFAULT false,
  visible_columns JSONB,
  filters JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_view_settings_user
  ON public.activity_view_settings(user_id);

ALTER TABLE public.activity_view_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity view settings"
  ON public.activity_view_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity view settings"
  ON public.activity_view_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activity view settings"
  ON public.activity_view_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
