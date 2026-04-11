-- Widen saved view settings date ranges that were previously defaulted to the
-- current calendar year. This ensures users see all historical transactions by
-- default, not just the current year.

-- Org-level activity view settings
UPDATE public.activity_view_settings
SET filters = jsonb_set(
  jsonb_set(
    filters,
    '{date_from}',
    '"2000-01-01"'::jsonb
  ),
  '{date_to}',
  to_jsonb(to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD'))
)
WHERE filters IS NOT NULL
  AND filters->>'date_from' IS NOT NULL
  AND (filters->>'date_from') ~ '^\d{4}-01-01$'
  AND (filters->>'date_to') ~ '^\d{4}-12-31$'
  AND (filters->>'date_from') = (filters->>'date_to')::text::date::text || '' IS NOT NULL
  AND LEFT(filters->>'date_from', 4) = LEFT(filters->>'date_to', 4);

-- Page-level activity view settings
UPDATE public.page_activity_view_settings
SET filters = jsonb_set(
  jsonb_set(
    filters,
    '{date_from}',
    '"2000-01-01"'::jsonb
  ),
  '{date_to}',
  to_jsonb(to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD'))
)
WHERE filters IS NOT NULL
  AND filters->>'date_from' IS NOT NULL
  AND (filters->>'date_from') ~ '^\d{4}-01-01$'
  AND (filters->>'date_to') ~ '^\d{4}-12-31$'
  AND LEFT(filters->>'date_from', 4) = LEFT(filters->>'date_to', 4);
