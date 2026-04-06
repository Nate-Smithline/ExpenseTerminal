-- Public read-only link: opaque token on pages (used by /p/[token] via service-role API only).

ALTER TABLE public.pages ADD COLUMN IF NOT EXISTS publish_token text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pages_publish_token_unique
  ON public.pages (publish_token)
  WHERE publish_token IS NOT NULL;

COMMENT ON COLUMN public.pages.publish_token IS 'Opaque secret for published read-only view; NULL when unpublished.';

ALTER TABLE public.pages ADD COLUMN IF NOT EXISTS publish_snapshot_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pages.publish_snapshot_user_id IS 'Whose transaction rows the published link shows (set when publishing).';
