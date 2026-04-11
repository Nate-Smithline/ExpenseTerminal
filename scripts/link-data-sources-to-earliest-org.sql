-- Link each data_sources row to the owner's *earliest* org (by org_memberships.created_at).
-- data_sources has no email column; the owner is data_sources.user_id → profiles.email is for humans only.
--
-- Preview rows that would change:
/*
SELECT
  ds.id AS data_source_id,
  ds.name AS account_name,
  ds.user_id,
  p.email AS owner_email,
  ds.org_id AS current_org_id,
  m.org_id AS new_org_id,
  o_cur.name AS current_org_name,
  o_new.name AS new_org_name
FROM public.data_sources ds
LEFT JOIN public.profiles p ON p.id = ds.user_id
JOIN LATERAL (
  SELECT om.org_id
  FROM public.org_memberships om
  WHERE om.user_id = ds.user_id
  ORDER BY om.created_at ASC
  LIMIT 1
) m ON true
LEFT JOIN public.orgs o_cur ON o_cur.id = ds.org_id
LEFT JOIN public.orgs o_new ON o_new.id = m.org_id
WHERE ds.org_id IS DISTINCT FROM m.org_id;
*/

-- Apply update (run after reviewing the preview above):
UPDATE public.data_sources ds
SET org_id = m.org_id
FROM (
  SELECT DISTINCT ON (user_id) user_id, org_id
  FROM public.org_memberships
  ORDER BY user_id, created_at ASC
) m
WHERE ds.user_id = m.user_id
  AND ds.org_id IS DISTINCT FROM m.org_id;

-- Owners with data_sources but no org membership (not updated):
-- SELECT ds.id, ds.user_id, p.email, ds.org_id, ds.name
-- FROM public.data_sources ds
-- LEFT JOIN public.profiles p ON p.id = ds.user_id
-- WHERE NOT EXISTS (SELECT 1 FROM public.org_memberships om WHERE om.user_id = ds.user_id);
