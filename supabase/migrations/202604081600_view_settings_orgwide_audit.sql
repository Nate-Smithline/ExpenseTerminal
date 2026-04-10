-- Make table view settings explicitly org-wide (not user-owned).
-- Keep audit fields for attribution instead of ownership semantics.

-- Saved Pages: one settings row per page_id (org-wide)
ALTER TABLE public.page_activity_view_settings
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.page_activity_view_settings
  ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill audit fields from legacy user_id.
UPDATE public.page_activity_view_settings
SET
  created_by = COALESCE(created_by, user_id),
  last_edited_by = COALESCE(last_edited_by, user_id)
WHERE created_by IS NULL OR last_edited_by IS NULL;

-- user_id was historically required but is not used for ownership (PK is page_id).
-- Keep the column for backward compatibility but make it nullable.
ALTER TABLE public.page_activity_view_settings
  ALTER COLUMN user_id DROP NOT NULL;

-- All Activity: one settings row per org_id (org-wide)
ALTER TABLE public.activity_view_settings
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.activity_view_settings
  ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.activity_view_settings
SET
  created_by = COALESCE(created_by, user_id),
  last_edited_by = COALESCE(last_edited_by, user_id)
WHERE created_by IS NULL OR last_edited_by IS NULL;

-- user_id is no longer a key for org-wide settings; keep but make nullable.
ALTER TABLE public.activity_view_settings
  ALTER COLUMN user_id DROP NOT NULL;

