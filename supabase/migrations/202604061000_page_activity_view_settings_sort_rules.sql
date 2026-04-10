-- Add Notion-style multi-column sort rules to per-page activity view settings.
-- Safe to run even if the table is absent in this schema snapshot.

ALTER TABLE IF EXISTS public.page_activity_view_settings
  ADD COLUMN IF NOT EXISTS sort_rules JSONB;

