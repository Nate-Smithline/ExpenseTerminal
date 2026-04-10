-- Resolve auth user by email from server (invite flow when generateLink says "already registered").
CREATE OR REPLACE FUNCTION public.lookup_auth_user_for_invite(check_email text)
RETURNS TABLE (user_id uuid, user_email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT u.id,
         COALESCE(u.email, '')
  FROM auth.users u
  WHERE lower(btrim(u.email)) = lower(btrim(check_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_auth_user_for_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_auth_user_for_invite(text) TO service_role;

-- Pending workspace invites (shown in org preferences until the user joins).
CREATE TABLE IF NOT EXISTS public.org_pending_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_pending_invites_org_email_lower UNIQUE (org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_org_pending_invites_org ON public.org_pending_invites(org_id);

ALTER TABLE public.org_pending_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view pending invites for their workspace" ON public.org_pending_invites;
CREATE POLICY "Org members can view pending invites for their workspace"
  ON public.org_pending_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.org_id = org_pending_invites.org_id
        AND m.user_id = auth.uid()
    )
  );

-- When someone becomes a member, drop matching pending row (by email).
CREATE OR REPLACE FUNCTION public.clear_org_pending_invite_on_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_email text;
BEGIN
  SELECT lower(btrim(p.email)) INTO member_email
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  IF member_email IS NOT NULL AND member_email <> '' THEN
    DELETE FROM public.org_pending_invites pi
    WHERE pi.org_id = NEW.org_id
      AND lower(btrim(pi.email)) = member_email;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_org_pending_on_membership ON public.org_memberships;
CREATE TRIGGER trg_clear_org_pending_on_membership
  AFTER INSERT ON public.org_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_org_pending_invite_on_membership();
