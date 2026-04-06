-- Break infinite recursion between pages ↔ page_members RLS once and for all.
--
-- Root cause: pages_select checked page_members; page_members_select checked pages.
-- SECURITY DEFINER + SET row_security = off did not prevent re-entry on Supabase.
--
-- Fix: denormalize org_id onto page_members so its policies ONLY reference
-- org_memberships (never pages). The cycle pages→page_members→pages is gone.
--
--   pages_select  → org_memberships ✓  +  page_members → org_memberships ✓  (done)
--   page_members_* → org_memberships ✓  (never touches pages)

-- ---------------------------------------------------------------
-- 1) Add org_id to page_members and backfill
-- ---------------------------------------------------------------
ALTER TABLE public.page_members ADD COLUMN IF NOT EXISTS org_id uuid;

UPDATE public.page_members pm
SET org_id = p.org_id
FROM public.pages p
WHERE pm.page_id = p.id AND pm.org_id IS NULL;

ALTER TABLE public.page_members ALTER COLUMN org_id SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.page_members
    ADD CONSTRAINT page_members_org_id_fk
    FOREIGN KEY (org_id) REFERENCES public.orgs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_page_members_org ON public.page_members(org_id);

-- ---------------------------------------------------------------
-- 2) BEFORE INSERT trigger: auto-set org_id from the parent page
--    Runs as superuser (SECURITY DEFINER) so the pages read
--    bypasses RLS. Fires before constraint / policy checks.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.page_members_set_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT p.org_id INTO NEW.org_id
  FROM public.pages p WHERE p.id = NEW.page_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS page_members_set_org_id_trg ON public.page_members;
CREATE TRIGGER page_members_set_org_id_trg
  BEFORE INSERT ON public.page_members
  FOR EACH ROW
  EXECUTE FUNCTION public.page_members_set_org_id();

-- ---------------------------------------------------------------
-- 3) Drop old helper functions (no longer needed)
-- ---------------------------------------------------------------
DROP FUNCTION IF EXISTS public.page_is_accessible_by_user(uuid, uuid);
DROP FUNCTION IF EXISTS public.page_member_manage_allowed(uuid, uuid);

-- ---------------------------------------------------------------
-- 4) pages policies — may reference page_members (safe: page_members
--    policies never look back at pages)
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "pages_select" ON public.pages;
DROP POLICY IF EXISTS "pages_insert" ON public.pages;
DROP POLICY IF EXISTS "pages_update" ON public.pages;
DROP POLICY IF EXISTS "pages_delete" ON public.pages;

CREATE POLICY "pages_select" ON public.pages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = pages.org_id AND m.user_id = auth.uid()
  )
  AND (
    visibility = 'org'
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.page_members pm
      WHERE pm.page_id = pages.id AND pm.user_id = auth.uid()
    )
  )
);

CREATE POLICY "pages_insert" ON public.pages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = pages.org_id AND m.user_id = auth.uid()
  )
  AND created_by = auth.uid()
);

CREATE POLICY "pages_update" ON public.pages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = pages.org_id AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = pages.org_id AND m.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------
-- 5) page_members policies — ONLY reference org_memberships
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "page_members_select" ON public.page_members;
DROP POLICY IF EXISTS "page_members_insert" ON public.page_members;
DROP POLICY IF EXISTS "page_members_delete" ON public.page_members;

CREATE POLICY "page_members_select" ON public.page_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = page_members.org_id AND m.user_id = auth.uid()
  )
);

CREATE POLICY "page_members_insert" ON public.page_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = page_members.org_id AND m.user_id = auth.uid()
  )
);

CREATE POLICY "page_members_delete" ON public.page_members FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = page_members.org_id AND m.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------
-- 6) page_favorites policies (unchanged logic, inlined)
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "page_favorites_select" ON public.page_favorites;
DROP POLICY IF EXISTS "page_favorites_insert" ON public.page_favorites;
DROP POLICY IF EXISTS "page_favorites_delete" ON public.page_favorites;

CREATE POLICY "page_favorites_select" ON public.page_favorites FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "page_favorites_insert" ON public.page_favorites FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.pages p
    JOIN public.org_memberships m ON m.org_id = p.org_id AND m.user_id = auth.uid()
    WHERE p.id = page_favorites.page_id
      AND p.deleted_at IS NULL
      AND (
        p.visibility = 'org'
        OR p.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.page_members pm
          WHERE pm.page_id = p.id AND pm.user_id = auth.uid()
        )
      )
  )
);

CREATE POLICY "page_favorites_delete" ON public.page_favorites FOR DELETE
USING (user_id = auth.uid());
