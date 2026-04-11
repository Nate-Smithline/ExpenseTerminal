-- Grant owner on an org to a user (upsert membership row).
-- Run in Supabase SQL editor as postgres (or another role that bypasses RLS on org_memberships).

INSERT INTO public.org_memberships (org_id, user_id, role)
VALUES (
  'bbc6faa2-6134-4c54-963f-05be0515945c'::uuid,
  'c58066e9-fd45-4f0e-b821-a2ecaf6aac7b'::uuid,
  'owner'
)
ON CONFLICT (org_id, user_id) DO UPDATE
SET role = EXCLUDED.role;

-- Verify
SELECT org_id, user_id, role, created_at
FROM public.org_memberships
WHERE org_id = 'bbc6faa2-6134-4c54-963f-05be0515945c'::uuid
  AND user_id = 'c58066e9-fd45-4f0e-b821-a2ecaf6aac7b'::uuid;
