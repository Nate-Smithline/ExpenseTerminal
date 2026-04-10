-- Queue rows when a workspace member (invited member) is added; app cron sends Resend to all org owners.

CREATE TABLE IF NOT EXISTS public.org_member_join_notify_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  member_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_member_join_notify_queue_org_member UNIQUE (org_id, member_user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_member_join_notify_queue_created
  ON public.org_member_join_notify_queue (created_at);

ALTER TABLE public.org_member_join_notify_queue ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.queue_org_member_join_owner_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM 'member' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.org_member_join_notify_queue (org_id, member_user_id)
  VALUES (NEW.org_id, NEW.user_id)
  ON CONFLICT (org_id, member_user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_org_member_join_notify ON public.org_memberships;
CREATE TRIGGER trg_queue_org_member_join_notify
  AFTER INSERT ON public.org_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_org_member_join_owner_notify();
