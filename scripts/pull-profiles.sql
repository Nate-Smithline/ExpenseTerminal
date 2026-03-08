-- Pull all profile details from public.profiles.
-- Run in Supabase Dashboard → SQL Editor (runs with sufficient privileges to read all rows),
-- or via: psql $DATABASE_URL -f scripts/pull-profiles.sql

SELECT
  id,
  email,
  display_name,
  first_name,
  last_name,
  name_prefix,
  avatar_url,
  phone,
  email_opt_in,
  notification_email_updates,
  notification_group,
  onboarding_progress,
  terms_accepted_at,
  created_at,
  updated_at
FROM public.profiles
ORDER BY created_at DESC;
