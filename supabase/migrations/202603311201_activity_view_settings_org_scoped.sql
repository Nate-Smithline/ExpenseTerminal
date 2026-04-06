-- Migrate activity_view_settings from per-user to per-org and add column_widths.

-- 1. Add new columns
ALTER TABLE public.activity_view_settings
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.orgs(id) ON DELETE CASCADE;

ALTER TABLE public.activity_view_settings
  ADD COLUMN IF NOT EXISTS column_widths JSONB DEFAULT '{}';

-- 2. Backfill org_id from user's active org
UPDATE public.activity_view_settings avs
SET org_id = p.active_org_id
FROM public.profiles p
WHERE avs.user_id = p.id AND avs.org_id IS NULL;

-- 3. Replace unique constraint: user_id -> org_id
ALTER TABLE public.activity_view_settings
  DROP CONSTRAINT IF EXISTS activity_view_settings_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_view_settings_org
  ON public.activity_view_settings(org_id) WHERE org_id IS NOT NULL;

DROP INDEX IF EXISTS idx_activity_view_settings_user;

-- 4. Replace RLS policies with org-membership-based policies
DROP POLICY IF EXISTS "Users can view own activity view settings" ON public.activity_view_settings;
DROP POLICY IF EXISTS "Users can insert own activity view settings" ON public.activity_view_settings;
DROP POLICY IF EXISTS "Users can update own activity view settings" ON public.activity_view_settings;

CREATE POLICY "Org members can view activity view settings"
  ON public.activity_view_settings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = activity_view_settings.org_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Org members can insert activity view settings"
  ON public.activity_view_settings FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = activity_view_settings.org_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Org members can update activity view settings"
  ON public.activity_view_settings FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = activity_view_settings.org_id AND m.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = activity_view_settings.org_id AND m.user_id = auth.uid()
  ));

-- 5. Enable Realtime for cross-device sync
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_view_settings;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END$$;
