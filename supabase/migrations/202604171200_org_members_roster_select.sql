-- Invited (non-owner) members could only SELECT their own org_memberships row, so
-- Preferences and /api/orgs/members returned just the current user. Pending invites
-- were also limited indirectly. Allow any member to read the full roster for orgs
-- they belong to by matching org_id to orgs the viewer is in (subquery only sees
-- the viewer's own membership rows).

DROP POLICY IF EXISTS "Org members can view org roster" ON public.org_memberships;
CREATE POLICY "Org members can view org roster"
  ON public.org_memberships FOR SELECT
  USING (
    org_id IN (
      SELECT m.org_id FROM public.org_memberships m
      WHERE m.user_id = auth.uid()
    )
  );
