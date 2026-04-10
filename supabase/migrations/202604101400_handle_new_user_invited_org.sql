-- New users invited to a workspace carry invited_org_id in user_metadata (set via auth.admin.generateLink).
-- Join that org as a member instead of creating a personal org.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  invite_org_id UUID;
BEGIN
  invite_org_id := NULL;
  IF NEW.raw_user_meta_data IS NOT NULL
     AND (NEW.raw_user_meta_data->>'invited_org_id') IS NOT NULL
     AND btrim(NEW.raw_user_meta_data->>'invited_org_id') <> '' THEN
    BEGIN
      invite_org_id := (NEW.raw_user_meta_data->>'invited_org_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      invite_org_id := NULL;
    END;
  END IF;

  IF invite_org_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.orgs WHERE id = invite_org_id) THEN
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

    INSERT INTO public.org_memberships (org_id, user_id, role)
    VALUES (invite_org_id, NEW.id, 'member');

    UPDATE public.profiles SET active_org_id = invite_org_id WHERE id = NEW.id;

    RETURN NEW;
  END IF;

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
