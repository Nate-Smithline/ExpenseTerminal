-- Create a demo user: demo@demo.com / Password123!
-- (Same password as the account nathansmith500@gmail.com.)
--
-- Login/signup is handled by Supabase Auth, so the credential lives in
-- auth.users.encrypted_password (bcrypt). Run this in the Supabase SQL Editor
-- (Dashboard -> SQL Editor) with a privileged role (postgres / service role).
--
-- The on_auth_user_created trigger will automatically create the matching
-- public.profiles row. Email is marked confirmed so the user can sign in
-- immediately without going through email verification.

DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
BEGIN
  -- Don't create a duplicate if it already exists.
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'demo@demo.com') THEN
    RAISE NOTICE 'User demo@demo.com already exists; skipping.';
    RETURN;
  END IF;

  -- NOTE: the token columns below MUST be '' (empty string), not NULL.
  -- Supabase Auth (GoTrue) scans them into non-nullable Go strings; a NULL
  -- value makes login fail with "Database error querying schema".
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new,
    email_change_token_current,
    phone_change,
    phone_change_token,
    reauthentication_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    'demo@demo.com',
    crypt('Password123!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"first_name":"Demo","last_name":"User"}'::jsonb,
    NOW(),
    NOW(),
    '', '', '', '', '', '', '', ''
  );

  -- Identity row required for email/password sign-in.
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    'demo@demo.com',
    jsonb_build_object('sub', new_user_id::text, 'email', 'demo@demo.com', 'email_verified', true),
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  RAISE NOTICE 'Created user demo@demo.com (%).', new_user_id;
END $$;
