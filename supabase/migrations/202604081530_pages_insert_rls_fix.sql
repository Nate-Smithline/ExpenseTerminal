-- Fix: allow authenticated org members to INSERT into public.pages.
-- This addresses "new row violates row-level security policy for table pages"
-- when creating a page via /api/pages.

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

-- Ensure INSERT is allowed for org members creating their own page.
DROP POLICY IF EXISTS "pages_insert" ON public.pages;
CREATE POLICY "pages_insert" ON public.pages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = pages.org_id
      AND m.user_id = auth.uid()
  )
  AND pages.created_by = auth.uid()
);

