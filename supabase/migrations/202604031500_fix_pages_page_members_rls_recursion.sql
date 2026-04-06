-- Fix infinite recursion between pages and page_members RLS:
-- pages_select referenced page_members; page_members_select referenced pages.
-- Use SECURITY DEFINER helpers so membership checks do not re-enter RLS.

CREATE OR REPLACE FUNCTION public.page_is_accessible_by_user(p_page_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pages p
    WHERE p.id = p_page_id
      AND p.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.org_memberships m
        WHERE m.org_id = p.org_id AND m.user_id = p_user_id
      )
      AND (
        p.visibility = 'org'
        OR p.created_by = p_user_id
        OR EXISTS (
          SELECT 1 FROM public.page_members pm
          WHERE pm.page_id = p.id AND pm.user_id = p_user_id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.page_member_manage_allowed(p_page_id uuid, p_actor uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pages p
    JOIN public.org_memberships m ON m.org_id = p.org_id AND m.user_id = p_actor
    WHERE p.id = p_page_id AND p.deleted_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.page_is_accessible_by_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.page_is_accessible_by_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.page_is_accessible_by_user(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.page_member_manage_allowed(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.page_member_manage_allowed(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.page_member_manage_allowed(uuid, uuid) TO service_role;

DROP POLICY IF EXISTS "pages_select" ON public.pages;
CREATE POLICY "pages_select"
  ON public.pages FOR SELECT
  USING (public.page_is_accessible_by_user(id, auth.uid()));

DROP POLICY IF EXISTS "page_members_select" ON public.page_members;
DROP POLICY IF EXISTS "page_members_insert" ON public.page_members;
DROP POLICY IF EXISTS "page_members_delete" ON public.page_members;

CREATE POLICY "page_members_select"
  ON public.page_members FOR SELECT
  USING (public.page_is_accessible_by_user(page_members.page_id, auth.uid()));

CREATE POLICY "page_members_insert"
  ON public.page_members FOR INSERT
  WITH CHECK (public.page_member_manage_allowed(page_members.page_id, auth.uid()));

CREATE POLICY "page_members_delete"
  ON public.page_members FOR DELETE
  USING (public.page_member_manage_allowed(page_members.page_id, auth.uid()));

DROP POLICY IF EXISTS "page_favorites_insert" ON public.page_favorites;
CREATE POLICY "page_favorites_insert"
  ON public.page_favorites FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.page_is_accessible_by_user(page_favorites.page_id, auth.uid())
  );
