-- Per-page activity view: sort_rules, filters, visible_columns, column_widths.
-- App: PATCH /api/pages/[id]/activity-view-settings → upsert on page_id.
-- If this table is missing, saved pages will not persist filters / sort / column visibility.

CREATE TABLE IF NOT EXISTS public.page_activity_view_settings (
  page_id UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sort_column TEXT NOT NULL DEFAULT 'date',
  sort_asc BOOLEAN NOT NULL DEFAULT false,
  sort_rules JSONB,
  visible_columns JSONB NOT NULL DEFAULT '["date","vendor","amount","transaction_type","status","category"]'::jsonb,
  column_widths JSONB NOT NULL DEFAULT '{}'::jsonb,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT page_activity_view_settings_pkey PRIMARY KEY (page_id)
);

-- Idempotent column adds (older / partial schemas)
ALTER TABLE public.page_activity_view_settings ADD COLUMN IF NOT EXISTS sort_rules JSONB;
ALTER TABLE public.page_activity_view_settings ADD COLUMN IF NOT EXISTS column_widths JSONB;
ALTER TABLE public.page_activity_view_settings ADD COLUMN IF NOT EXISTS filters JSONB;
ALTER TABLE public.page_activity_view_settings ADD COLUMN IF NOT EXISTS visible_columns JSONB;
ALTER TABLE public.page_activity_view_settings ADD COLUMN IF NOT EXISTS sort_column TEXT;
ALTER TABLE public.page_activity_view_settings ADD COLUMN IF NOT EXISTS sort_asc BOOLEAN;
ALTER TABLE public.page_activity_view_settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.page_activity_view_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE public.page_activity_view_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE public.page_activity_view_settings s
SET user_id = p.created_by
FROM public.pages p
WHERE s.page_id = p.id AND s.user_id IS NULL;

UPDATE public.page_activity_view_settings
SET
  sort_column = COALESCE(sort_column, 'date'),
  sort_asc = COALESCE(sort_asc, false),
  visible_columns = COALESCE(
    visible_columns,
    '["date","vendor","amount","transaction_type","status","category"]'::jsonb
  ),
  column_widths = COALESCE(column_widths, '{}'::jsonb),
  filters = COALESCE(filters, '{}'::jsonb),
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE sort_column IS NULL
   OR sort_asc IS NULL
   OR visible_columns IS NULL
   OR column_widths IS NULL
   OR filters IS NULL
   OR created_at IS NULL
   OR updated_at IS NULL;

ALTER TABLE public.page_activity_view_settings ALTER COLUMN sort_column SET DEFAULT 'date';
ALTER TABLE public.page_activity_view_settings ALTER COLUMN sort_asc SET DEFAULT false;
ALTER TABLE public.page_activity_view_settings ALTER COLUMN visible_columns SET DEFAULT '["date","vendor","amount","transaction_type","status","category"]'::jsonb;
ALTER TABLE public.page_activity_view_settings ALTER COLUMN column_widths SET DEFAULT '{}'::jsonb;
ALTER TABLE public.page_activity_view_settings ALTER COLUMN filters SET DEFAULT '{}'::jsonb;

ALTER TABLE public.page_activity_view_settings ALTER COLUMN sort_column SET NOT NULL;
ALTER TABLE public.page_activity_view_settings ALTER COLUMN sort_asc SET NOT NULL;
ALTER TABLE public.page_activity_view_settings ALTER COLUMN visible_columns SET NOT NULL;
ALTER TABLE public.page_activity_view_settings ALTER COLUMN column_widths SET NOT NULL;
ALTER TABLE public.page_activity_view_settings ALTER COLUMN filters SET NOT NULL;
ALTER TABLE public.page_activity_view_settings ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.page_activity_view_settings ALTER COLUMN updated_at SET NOT NULL;

-- user_id required for app upserts
ALTER TABLE public.page_activity_view_settings ALTER COLUMN user_id SET NOT NULL;

-- If an older manual table had no primary key, PostgREST upsert on page_id needs one
DO $$
DECLARE
  tid oid;
BEGIN
  SELECT c.oid INTO tid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'page_activity_view_settings' AND c.relkind = 'r';

  IF tid IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = tid AND contype = 'p') THEN
    RETURN;
  END IF;

  ALTER TABLE public.page_activity_view_settings ADD CONSTRAINT page_activity_view_settings_pkey PRIMARY KEY (page_id);
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Requires 202604031200_pages_sharing_favorites.sql (page_is_accessible_by_user)
ALTER TABLE public.page_activity_view_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "page_activity_view_settings_select" ON public.page_activity_view_settings;
DROP POLICY IF EXISTS "page_activity_view_settings_insert" ON public.page_activity_view_settings;
DROP POLICY IF EXISTS "page_activity_view_settings_update" ON public.page_activity_view_settings;

CREATE POLICY "page_activity_view_settings_select"
  ON public.page_activity_view_settings FOR SELECT
  USING (public.page_is_accessible_by_user(page_id, auth.uid()));

CREATE POLICY "page_activity_view_settings_insert"
  ON public.page_activity_view_settings FOR INSERT
  WITH CHECK (public.page_is_accessible_by_user(page_id, auth.uid()));

CREATE POLICY "page_activity_view_settings_update"
  ON public.page_activity_view_settings FOR UPDATE
  USING (public.page_is_accessible_by_user(page_id, auth.uid()))
  WITH CHECK (public.page_is_accessible_by_user(page_id, auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_activity_view_settings TO authenticated;
GRANT ALL ON public.page_activity_view_settings TO service_role;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.page_activity_view_settings;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.page_activity_view_settings (
  page_id,
  user_id,
  sort_column,
  sort_asc,
  sort_rules,
  visible_columns,
  column_widths,
  filters,
  created_at,
  updated_at
)
SELECT
  p.id,
  p.created_by,
  'date',
  false,
  '[{"column":"date","asc":false}]'::jsonb,
  '["date","vendor","amount","transaction_type","status","category"]'::jsonb,
  '{}'::jsonb,
  jsonb_build_object(
    'status', NULL,
    'transaction_type', NULL,
    'source', NULL,
    'data_source_id', NULL,
    'search', '',
    'date_from', '2000-01-01',
    'date_to', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
    'column_filters', '[]'::jsonb
  ),
  NOW(),
  NOW()
FROM public.pages p
WHERE p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.page_activity_view_settings s WHERE s.page_id = p.id
  );

-- All Activity: org-level settings (filters, sort, visible columns, widths)
ALTER TABLE public.activity_view_settings
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE;

ALTER TABLE public.activity_view_settings
  ADD COLUMN IF NOT EXISTS column_widths JSONB DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_view_settings_org
  ON public.activity_view_settings(org_id)
  WHERE org_id IS NOT NULL;
