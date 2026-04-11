-- Fix page_activity_view_settings RLS: policies referenced
-- public.page_is_accessible_by_user() which was dropped in
-- 202604031800_pages_rls_denormalize_org_id.sql.
-- Replace with org_memberships-based checks (same pattern as pages_update).

DROP POLICY IF EXISTS "page_activity_view_settings_select" ON public.page_activity_view_settings;
DROP POLICY IF EXISTS "page_activity_view_settings_insert" ON public.page_activity_view_settings;
DROP POLICY IF EXISTS "page_activity_view_settings_update" ON public.page_activity_view_settings;

-- SELECT: any org member whose org owns the parent page
CREATE POLICY "page_activity_view_settings_select"
  ON public.page_activity_view_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.pages p
      JOIN public.org_memberships m ON m.org_id = p.org_id AND m.user_id = auth.uid()
      WHERE p.id = page_activity_view_settings.page_id
        AND p.deleted_at IS NULL
    )
  );

-- INSERT: any org member (first save on a page that has no settings row yet)
CREATE POLICY "page_activity_view_settings_insert"
  ON public.page_activity_view_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pages p
      JOIN public.org_memberships m ON m.org_id = p.org_id AND m.user_id = auth.uid()
      WHERE p.id = page_activity_view_settings.page_id
        AND p.deleted_at IS NULL
    )
  );

-- UPDATE: any org member
CREATE POLICY "page_activity_view_settings_update"
  ON public.page_activity_view_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.pages p
      JOIN public.org_memberships m ON m.org_id = p.org_id AND m.user_id = auth.uid()
      WHERE p.id = page_activity_view_settings.page_id
        AND p.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.pages p
      JOIN public.org_memberships m ON m.org_id = p.org_id AND m.user_id = auth.uid()
      WHERE p.id = page_activity_view_settings.page_id
        AND p.deleted_at IS NULL
    )
  );
