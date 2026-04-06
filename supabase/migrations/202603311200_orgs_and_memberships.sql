-- Introduce multi-org model: orgs, org_memberships, profiles.active_org_id.
-- Backfills a default org per existing user.

-- 1. Orgs table
CREATE TABLE IF NOT EXISTS public.orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My Organization',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;

-- 2. Org memberships table
CREATE TABLE IF NOT EXISTS public.org_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON public.org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON public.org_memberships(org_id);

ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;

-- 3. Add active_org_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_org_id UUID REFERENCES public.orgs(id);

-- 4. RLS policies

CREATE POLICY "Users can view orgs they belong to"
  ON public.orgs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can update orgs they own"
  ON public.orgs FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = id AND m.user_id = auth.uid() AND m.role = 'owner'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = id AND m.user_id = auth.uid() AND m.role = 'owner'
  ));

CREATE POLICY "Users can view own memberships"
  ON public.org_memberships FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Org owners can manage memberships"
  ON public.org_memberships FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = org_memberships.org_id AND m.user_id = auth.uid() AND m.role = 'owner'
  ));

-- 5. Backfill: create a default org per existing user
DO $$
DECLARE
  r RECORD;
  new_org_id UUID;
BEGIN
  FOR r IN
    SELECT p.id, COALESCE(p.display_name, p.email, 'My Organization') AS org_name
    FROM public.profiles p
    WHERE p.active_org_id IS NULL
  LOOP
    INSERT INTO public.orgs (name)
    VALUES (r.org_name || '''s Organization')
    RETURNING id INTO new_org_id;

    INSERT INTO public.org_memberships (org_id, user_id, role)
    VALUES (new_org_id, r.id, 'owner');

    UPDATE public.profiles SET active_org_id = new_org_id WHERE id = r.id;
  END LOOP;
END$$;

-- 6. Update handle_new_user to create a default org + membership for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, email_opt_in, terms_accepted_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    COALESCE((NEW.raw_user_meta_data->>'email_opt_in')::boolean, false),
    CASE WHEN NEW.raw_user_meta_data->>'terms_accepted_at' IS NOT NULL
         THEN (NEW.raw_user_meta_data->>'terms_accepted_at')::timestamptz
         ELSE NULL END
  );

  INSERT INTO public.orgs (name) VALUES ('My Organization')
  RETURNING id INTO new_org_id;

  INSERT INTO public.org_memberships (org_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  UPDATE public.profiles SET active_org_id = new_org_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$;
