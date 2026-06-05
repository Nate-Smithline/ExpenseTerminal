-- Create a workspace for demo@demo.com and link the user's data sources to it.
--
-- Run in the Supabase SQL Editor (Dashboard -> SQL Editor) with a privileged
-- role (postgres / service role), AFTER the demo@demo.com auth user exists.
--
-- WHY THIS IS DYNAMIC:
-- The public.workspaces table is not defined in this repo's SQL (it only lives
-- in the live database) and is not linked to auth.users by any column the app
-- knows about. Rather than hard-code an INSERT and risk hitting an unknown
-- NOT NULL column, this script inspects the table's real columns at runtime,
-- fills in the ones it recognizes, and raises a clear error listing any
-- required column it cannot populate automatically.

DO $$
DECLARE
  v_uid    UUID;
  v_wsid   UUID;
  v_email  TEXT := 'demo@demo.com';
  v_name   TEXT := 'Webb Strategy Consulting LLC';  -- matches the demo persona
  col      RECORD;
  n_cols   INT;
  cols     TEXT[] := '{}';
  vals     TEXT[] := '{}';
  missing  TEXT[] := '{}';
BEGIN
  -- 1. Locate the demo user.
  SELECT id INTO v_uid FROM auth.users WHERE email = v_email;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'User % not found. Create the auth user first (see create-demo-user.sql).', v_email;
  END IF;

  -- 2. Make sure the workspaces table actually exists.
  SELECT count(*) INTO n_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'workspaces';
  IF n_cols = 0 THEN
    RAISE EXCEPTION 'public.workspaces table not found in this database.';
  END IF;

  -- 3. Reuse a workspace already linked to this user's data sources, if any.
  SELECT workspace_id INTO v_wsid
  FROM public.data_sources
  WHERE user_id = v_uid AND workspace_id IS NOT NULL
  LIMIT 1;

  IF v_wsid IS NULL THEN
    v_wsid := gen_random_uuid();

    -- Build an INSERT from the columns that actually exist on the table.
    FOR col IN
      SELECT column_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'workspaces'
      ORDER BY ordinal_position
    LOOP
      IF col.column_name = 'id' THEN
        cols := cols || 'id';
        vals := vals || (quote_literal(v_wsid) || '::uuid');
      ELSIF col.column_name IN ('name', 'title', 'display_name', 'business_name', 'label') THEN
        cols := cols || col.column_name;
        vals := vals || quote_literal(v_name);
      ELSIF col.column_name = 'slug' THEN
        cols := cols || col.column_name;
        vals := vals || quote_literal('demo-webb-strategy-consulting');
      ELSIF col.column_name IN ('owner_id', 'user_id', 'created_by', 'owner', 'profile_id', 'account_id') THEN
        cols := cols || col.column_name;
        vals := vals || (quote_literal(v_uid) || '::uuid');
      ELSIF col.column_name IN ('created_at', 'updated_at', 'inserted_at') THEN
        cols := cols || col.column_name;
        vals := vals || 'now()';
      ELSIF col.is_nullable = 'NO' AND col.column_default IS NULL THEN
        -- A required column with no default that we don't know how to fill.
        missing := missing || col.column_name;
      END IF;
      -- Nullable columns / columns with defaults are intentionally skipped.
    END LOOP;

    IF array_length(missing, 1) IS NOT NULL THEN
      RAISE EXCEPTION
        'Cannot auto-create workspace: public.workspaces has required column(s) [%] with no default. Edit this script to provide values for them.',
        array_to_string(missing, ', ');
    END IF;

    EXECUTE format(
      'INSERT INTO public.workspaces (%s) VALUES (%s)',
      array_to_string(cols, ', '),
      array_to_string(vals, ', ')
    );
    RAISE NOTICE 'Created workspace % (%) for %', v_name, v_wsid, v_email;
  ELSE
    RAISE NOTICE 'Reusing existing workspace % already linked to %', v_wsid, v_email;
  END IF;

  -- 4. Link this user's data sources to the workspace.
  UPDATE public.data_sources
  SET workspace_id = v_wsid
  WHERE user_id = v_uid AND workspace_id IS DISTINCT FROM v_wsid;

  RAISE NOTICE 'Linked data_sources for % to workspace %', v_email, v_wsid;
END $$;
