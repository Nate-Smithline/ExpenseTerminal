-- Fix: infinite recursion detected in policy for relation "page_members"
-- The old policy referenced page_members inside its own USING clause.
-- Replace with: allow reading a row if you are that row's user (your invite),
-- or org-wide page, or you are the page creator.

DROP POLICY IF EXISTS "page_members_select" ON public.page_members;

CREATE POLICY "page_members_select"
  ON public.page_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_members.page_id
        AND p.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.org_id = p.org_id AND m.user_id = auth.uid()
        )
        AND (
          p.visibility = 'org'
          OR p.created_by = auth.uid()
          OR page_members.user_id = auth.uid()
        )
    )
  );
