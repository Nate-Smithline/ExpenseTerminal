-- Confirm profiles.email matches a user who is owner of org "Aaron's XT".
-- Change the two string literals below if needed. Run this one statement only.
--
-- Result: one row with is_owner = true means confirmed. No rows = no match.
-- One row with is_owner = false means they are in the org but not owner.

SELECT
  p.id AS user_id,
  p.email,
  o.id AS org_id,
  o.name AS org_name,
  m.role,
  (m.role = 'owner') AS is_owner
FROM public.profiles p
JOIN public.org_memberships m ON m.user_id = p.id
JOIN public.orgs o ON o.id = m.org_id
WHERE p.email ILIKE 'aaroncassar@gmail.com'
  AND o.name = 'Aaron''s XT';

-- If that returns no rows but you know the Supabase Auth email is correct,
-- profile email may be out of date. Run this separately (needs auth read):
--
-- SELECT u.id, u.email, o.name, m.role, (m.role = 'owner') AS is_owner
-- FROM auth.users u
-- JOIN public.org_memberships m ON m.user_id = u.id
-- JOIN public.orgs o ON o.id = m.org_id
-- WHERE u.email ILIKE 'aaroncassar@gmail.com' AND o.name = 'Aaron''s XT';
