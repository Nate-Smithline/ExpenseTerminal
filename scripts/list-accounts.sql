-- Run in Supabase Dashboard → SQL Editor (uses postgres; sees all rows).
-- Omits sensitive columns (e.g. Plaid access token).

SELECT
  ds.id,
  ds.org_id,
  o.name AS org_name,
  ds.user_id,
  p.email AS user_email,
  ds.name AS account_name,
  ds.source_type,
  ds.account_type,
  ds.institution,
  ds.transaction_count,
  ds.connected_at,
  ds.last_successful_sync_at,
  ds.last_failed_sync_at,
  ds.plaid_item_id,
  ds.plaid_account_id,
  ds.stripe_account_id,
  ds.financial_connections_account_id,
  (ds.plaid_access_token IS NOT NULL) AS has_plaid_token,
  ds.created_at
FROM public.data_sources ds
LEFT JOIN public.orgs o ON o.id = ds.org_id
LEFT JOIN public.profiles p ON p.id = ds.user_id
ORDER BY ds.created_at DESC;
