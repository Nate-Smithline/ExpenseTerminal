-- Remove extra RLS policies on page-related tables that can cause recursion or conflicts.
-- Keeps only the policy names introduced by expense-terminal migrations.
--
-- Usage: Supabase SQL Editor (or psql). Safe to run multiple times.
-- Prerequisite: canonical policies should exist (re-run latest pages migrations if you dropped everything).

DO $$
DECLARE
  r record;
  allowed_pages text[] := ARRAY['pages_select', 'pages_insert', 'pages_update'];
  allowed_members text[] := ARRAY['page_members_select', 'page_members_insert', 'page_members_delete'];
  allowed_favorites text[] := ARRAY['page_favorites_select', 'page_favorites_insert', 'page_favorites_delete'];
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pages'
  LOOP
    IF NOT (r.policyname = ANY (allowed_pages)) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.pages', r.policyname);
      RAISE NOTICE 'Dropped extra policy on public.pages: %', r.policyname;
    END IF;
  END LOOP;

  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'page_members'
  LOOP
    IF NOT (r.policyname = ANY (allowed_members)) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.page_members', r.policyname);
      RAISE NOTICE 'Dropped extra policy on public.page_members: %', r.policyname;
    END IF;
  END LOOP;

  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'page_favorites'
  LOOP
    IF NOT (r.policyname = ANY (allowed_favorites)) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.page_favorites', r.policyname);
      RAISE NOTICE 'Dropped extra policy on public.page_favorites: %', r.policyname;
    END IF;
  END LOOP;
END $$;

-- Optional: list what remains (should match allowlists only)
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public' AND tablename IN ('pages', 'page_members', 'page_favorites')
-- ORDER BY tablename, policyname;
