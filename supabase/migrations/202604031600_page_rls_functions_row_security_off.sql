-- RLS still ran inside SECURITY DEFINER helpers (invoker context) → recursion on pages_select.
-- Disable row_security for statements inside these functions only.

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
