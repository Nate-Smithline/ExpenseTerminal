-- Pages: full width, visibility (org vs restricted), soft delete; page_members; page_favorites; RLS; peer profiles read.

-- 1) pages table (create if missing from repo history)
CREATE TABLE IF NOT EXISTS public.pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  icon_type TEXT NOT NULL DEFAULT 'emoji',
  icon_value TEXT NOT NULL DEFAULT '📄',
  icon_color TEXT NOT NULL DEFAULT 'grey',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pages ADD COLUMN IF NOT EXISTS full_width BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.pages ADD COLUMN IF NOT EXISTS visibility TEXT;
UPDATE public.pages SET visibility = 'org' WHERE visibility IS NULL;
ALTER TABLE public.pages ALTER COLUMN visibility SET DEFAULT 'org';
ALTER TABLE public.pages ALTER COLUMN visibility SET NOT NULL;
ALTER TABLE public.pages DROP CONSTRAINT IF EXISTS pages_visibility_check;
ALTER TABLE public.pages ADD CONSTRAINT pages_visibility_check CHECK (visibility IN ('org', 'restricted'));

ALTER TABLE public.pages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pages_org_id ON public.pages(org_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pages_org_updated ON public.pages(org_id, updated_at DESC) WHERE deleted_at IS NULL;

-- 2) page_members (invites for restricted pages)
CREATE TABLE IF NOT EXISTS public.page_members (
  page_id UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'full_access',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (page_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_page_members_user ON public.page_members(user_id);

ALTER TABLE public.page_members ENABLE ROW LEVEL SECURITY;

-- 3) page_favorites
CREATE TABLE IF NOT EXISTS public.page_favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, page_id)
);

CREATE INDEX IF NOT EXISTS idx_page_favorites_user ON public.page_favorites(user_id);

ALTER TABLE public.page_favorites ENABLE ROW LEVEL SECURITY;

-- RLS-safe helpers: policies must not cross-query pages <-> page_members (infinite recursion).
-- SECURITY DEFINER alone still evaluates RLS as the invoker on some Postgres builds; force off inside the function.
CREATE OR REPLACE FUNCTION public.page_is_accessible_by_user(p_page_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pages p
    WHERE p.id = p_page_id
      AND p.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.org_memberships m
        WHERE m.org_id = p.org_id AND m.user_id = p_user_id
      )
      AND (
        p.visibility = 'org'
        OR p.created_by = p_user_id
        OR EXISTS (
          SELECT 1 FROM public.page_members pm
          WHERE pm.page_id = p.id AND pm.user_id = p_user_id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.page_member_manage_allowed(p_page_id uuid, p_actor uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pages p
    JOIN public.org_memberships m ON m.org_id = p.org_id AND m.user_id = p_actor
    WHERE p.id = p_page_id AND p.deleted_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.page_is_accessible_by_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.page_is_accessible_by_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.page_is_accessible_by_user(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.page_member_manage_allowed(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.page_member_manage_allowed(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.page_member_manage_allowed(uuid, uuid) TO service_role;

-- 4) pages RLS
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pages_select" ON public.pages;
DROP POLICY IF EXISTS "pages_insert" ON public.pages;
DROP POLICY IF EXISTS "pages_update" ON public.pages;
DROP POLICY IF EXISTS "pages_delete" ON public.pages;

CREATE POLICY "pages_select"
  ON public.pages FOR SELECT
  USING (public.page_is_accessible_by_user(id, auth.uid()));

CREATE POLICY "pages_insert"
  ON public.pages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.org_id = pages.org_id AND m.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "pages_update"
  ON public.pages FOR UPDATE
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

-- No hard DELETE policy — use soft delete (UPDATE deleted_at) via pages_update

-- 5) page_members RLS (v1: any org member of the page's org can manage rows)
DROP POLICY IF EXISTS "page_members_select" ON public.page_members;
DROP POLICY IF EXISTS "page_members_insert" ON public.page_members;
DROP POLICY IF EXISTS "page_members_delete" ON public.page_members;

CREATE POLICY "page_members_select"
  ON public.page_members FOR SELECT
  USING (public.page_is_accessible_by_user(page_members.page_id, auth.uid()));

CREATE POLICY "page_members_insert"
  ON public.page_members FOR INSERT
  WITH CHECK (public.page_member_manage_allowed(page_members.page_id, auth.uid()));

CREATE POLICY "page_members_delete"
  ON public.page_members FOR DELETE
  USING (public.page_member_manage_allowed(page_members.page_id, auth.uid()));

-- 6) page_favorites RLS
DROP POLICY IF EXISTS "page_favorites_select" ON public.page_favorites;
DROP POLICY IF EXISTS "page_favorites_insert" ON public.page_favorites;
DROP POLICY IF EXISTS "page_favorites_delete" ON public.page_favorites;

CREATE POLICY "page_favorites_select"
  ON public.page_favorites FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "page_favorites_insert"
  ON public.page_favorites FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.page_is_accessible_by_user(page_favorites.page_id, auth.uid())
  );

CREATE POLICY "page_favorites_delete"
  ON public.page_favorites FOR DELETE
  USING (user_id = auth.uid());

-- 7) Org peers can read basic profile fields for directory / share UI
DROP POLICY IF EXISTS "Org members can view peer profiles" ON public.profiles;
CREATE POLICY "Org members can view peer profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m_self
      JOIN public.org_memberships m_peer ON m_self.org_id = m_peer.org_id
      WHERE m_self.user_id = auth.uid()
        AND m_peer.user_id = profiles.id
    )
  );
