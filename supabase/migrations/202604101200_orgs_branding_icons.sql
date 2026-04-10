-- Workspace display: emoji and/or image URL for sidebar / org settings (Notion-style).
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS icon_emoji TEXT;
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS icon_image_url TEXT;

COMMENT ON COLUMN public.orgs.icon_emoji IS 'Optional single emoji shown as org avatar when set.';
COMMENT ON COLUMN public.orgs.icon_image_url IS 'Optional image URL for org avatar; emoji takes precedence if both set.';
