-- Debug: orgs, memberships, active workspace, and accounts for one login email.
--
-- If a query returns no rows, run the steps in order. Use the user id from the first
-- query that returns a row for the sections below (replace :user_id in comments).

-- =============================================================================
-- STEP 0 — Find the user (use the FIRST query that returns a row)
-- =============================================================================

-- 0a) Same as what works in your editor (explicit schema)
SELECT id AS user_id, email, active_org_id, created_at
FROM public.profiles
WHERE email = 'aaroncassar@gmail.com';

-- 0b) Case-insensitive on profiles.email
SELECT id AS user_id, email, active_org_id, created_at
FROM public.profiles
WHERE email ILIKE 'aaroncassar@gmail.com';

-- 0c) Auth is source of truth for login email; profile row may differ or lag
SELECT
  u.id AS user_id,
  u.email AS auth_email,
  p.email AS profile_email,
  p.active_org_id,
  p.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'aaroncassar@gmail.com';

-- 0d) Fuzzy: see what is actually stored (typo, space, different domain)
SELECT id, email, length(email::text) AS email_len, active_org_id
FROM public.profiles
WHERE email::text ILIKE '%cassar%'
   OR email::text ILIKE '%aaron%';

-- =============================================================================
-- Replace USER_ID_HERE below with the uuid from step 0, then run each block.
-- =============================================================================

-- 1) Profile row for that user id
SELECT id AS user_id, email, active_org_id, created_at
FROM public.profiles
WHERE id = 'USER_ID_HERE'::uuid;

-- 2) Every org this user belongs to
SELECT
  m.org_id,
  o.name AS org_name,
  m.role,
  m.created_at AS membership_created_at
FROM public.org_memberships m
JOIN public.orgs o ON o.id = m.org_id
WHERE m.user_id = 'USER_ID_HERE'::uuid
ORDER BY m.created_at ASC;

-- 3) All members in those orgs
SELECT m.org_id, o.name AS org_name, m.user_id, pr.email AS member_email, m.role
FROM public.org_memberships m
JOIN public.orgs o ON o.id = m.org_id
LEFT JOIN public.profiles pr ON pr.id = m.user_id
WHERE m.org_id IN (
  SELECT org_id FROM public.org_memberships WHERE user_id = 'USER_ID_HERE'::uuid
)
ORDER BY m.org_id, m.role DESC, pr.email;

-- 4) data_sources for this user
SELECT
  ds.id,
  ds.name AS account_name,
  ds.source_type,
  ds.org_id,
  o.name AS account_org_name,
  ds.user_id,
  ds.created_at
FROM public.data_sources ds
LEFT JOIN public.orgs o ON o.id = ds.org_id
WHERE ds.user_id = 'USER_ID_HERE'::uuid
ORDER BY ds.created_at;

-- 5) Active workspace vs accounts
SELECT
  p.id AS user_id,
  p.email,
  p.active_org_id AS active_workspace_org_id,
  ao.name AS active_org_name,
  COUNT(ds.id) FILTER (WHERE ds.org_id = p.active_org_id) AS accounts_in_active_org,
  COUNT(ds.id) AS total_accounts
FROM public.profiles p
LEFT JOIN public.orgs ao ON ao.id = p.active_org_id
LEFT JOIN public.data_sources ds ON ds.user_id = p.id
WHERE p.id = 'USER_ID_HERE'::uuid
GROUP BY p.id, p.email, p.active_org_id, ao.name;
