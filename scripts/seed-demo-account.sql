-- =============================================================================
-- DEMO SEED — demo@demo.com
-- Persona: Marcus Webb, NYC banking professional ($140k salary),
--          Webb Strategy Consulting LLC (~$50k/yr consulting),
--          tithes to church, one intermingled ledger.
--
-- USAGE: Run in Supabase SQL Editor AFTER creating auth user demo@demo.com.
-- SAFE TO RE-RUN: conflicts are handled with ON CONFLICT DO NOTHING/UPDATE.
-- =============================================================================

DO $$
DECLARE
  v_uid UUID;
  v_wsid UUID;   -- workspace_id for this demo user

  -- workspace introspection
  col     RECORD;
  n_cols  INT;
  cols    TEXT[] := ARRAY[]::TEXT[];
  vals    TEXT[] := ARRAY[]::TEXT[];
  missing TEXT[] := ARRAY[]::TEXT[];

  -- data sources
  ds_chk UUID := gen_random_uuid();
  ds_sav UUID := gen_random_uuid();
  ds_cc  UUID := gen_random_uuid();

  -- budget months (2026)
  bm_jan UUID := gen_random_uuid();
  bm_feb UUID := gen_random_uuid();
  bm_mar UUID := gen_random_uuid();
  bm_apr UUID := gen_random_uuid();
  bm_may UUID := gen_random_uuid();

  -- ── May 2026 groups ──
  g5_inc UUID := gen_random_uuid();
  g5_hse UUID := gen_random_uuid();
  g5_giv UUID := gen_random_uuid();
  g5_biz UUID := gen_random_uuid();
  g5_fod UUID := gen_random_uuid();
  g5_trn UUID := gen_random_uuid();
  g5_per UUID := gen_random_uuid();

  -- ── May 2026 lines ──
  l5_sal  UUID := gen_random_uuid();
  l5_con  UUID := gen_random_uuid();
  l5_rnt  UUID := gen_random_uuid();
  l5_ced  UUID := gen_random_uuid();
  l5_net1 UUID := gen_random_uuid();
  l5_tth  UUID := gen_random_uuid();
  l5_cht  UUID := gen_random_uuid();
  l5_swz  UUID := gen_random_uuid();
  l5_lnk  UUID := gen_random_uuid();
  l5_sft  UUID := gen_random_uuid();
  l5_cml  UUID := gen_random_uuid();
  l5_trv  UUID := gen_random_uuid();
  l5_sup  UUID := gen_random_uuid();
  l5_groc UUID := gen_random_uuid();
  l5_din  UUID := gen_random_uuid();
  l5_met  UUID := gen_random_uuid();
  l5_ub   UUID := gen_random_uuid();
  l5_gym  UUID := gen_random_uuid();
  l5_str  UUID := gen_random_uuid();
  l5_amz  UUID := gen_random_uuid();
  l5_phn  UUID := gen_random_uuid();

  -- ── Apr 2026 groups ──
  g4_inc UUID := gen_random_uuid();
  g4_hse UUID := gen_random_uuid();
  g4_giv UUID := gen_random_uuid();
  g4_biz UUID := gen_random_uuid();
  g4_fod UUID := gen_random_uuid();
  g4_trn UUID := gen_random_uuid();
  g4_per UUID := gen_random_uuid();

  -- ── Apr 2026 lines ──
  l4_sal  UUID := gen_random_uuid();
  l4_con  UUID := gen_random_uuid();
  l4_rnt  UUID := gen_random_uuid();
  l4_ced  UUID := gen_random_uuid();
  l4_net1 UUID := gen_random_uuid();
  l4_tth  UUID := gen_random_uuid();
  l4_cht  UUID := gen_random_uuid();
  l4_swz  UUID := gen_random_uuid();
  l4_lnk  UUID := gen_random_uuid();
  l4_sft  UUID := gen_random_uuid();
  l4_cml  UUID := gen_random_uuid();
  l4_groc UUID := gen_random_uuid();
  l4_din  UUID := gen_random_uuid();
  l4_met  UUID := gen_random_uuid();
  l4_ub   UUID := gen_random_uuid();
  l4_gym  UUID := gen_random_uuid();
  l4_str  UUID := gen_random_uuid();
  l4_amz  UUID := gen_random_uuid();

  -- ── Mar 2026 groups ──
  g3_inc UUID := gen_random_uuid();
  g3_hse UUID := gen_random_uuid();
  g3_giv UUID := gen_random_uuid();
  g3_biz UUID := gen_random_uuid();
  g3_fod UUID := gen_random_uuid();
  g3_trn UUID := gen_random_uuid();
  g3_per UUID := gen_random_uuid();

  -- ── Mar 2026 lines ──
  l3_sal  UUID := gen_random_uuid();
  l3_con  UUID := gen_random_uuid();
  l3_rnt  UUID := gen_random_uuid();
  l3_ced  UUID := gen_random_uuid();
  l3_net1 UUID := gen_random_uuid();
  l3_tth  UUID := gen_random_uuid();
  l3_cht  UUID := gen_random_uuid();
  l3_swz  UUID := gen_random_uuid();
  l3_lnk  UUID := gen_random_uuid();
  l3_cml  UUID := gen_random_uuid();
  l3_groc UUID := gen_random_uuid();
  l3_din  UUID := gen_random_uuid();
  l3_met  UUID := gen_random_uuid();
  l3_gym  UUID := gen_random_uuid();

BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'demo@demo.com';
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'User demo@demo.com not found. Create via Supabase Auth → Add User first.';
  END IF;
  RAISE NOTICE 'Seeding demo data for %', v_uid;

  -- ── Idempotency: clear previously-seeded child rows ──────────────────────────
  -- Re-running regenerates UUIDs for budget months/groups/lines and these tables
  -- have no natural unique key, so without this the script either duplicates rows
  -- or fails the budget_groups FK (new month UUID not present because the old
  -- month row was kept by ON CONFLICT DO NOTHING). Reference data that IS keyed
  -- (profile, settings, subscription, data_sources, workspace) is preserved and
  -- updated in place below; only the regenerated records are cleared here.
  -- budget_months delete cascades to budget_groups, budget_lines and
  -- budget_line_transactions; deleting transactions also cascades to the join.
  DELETE FROM public.budget_months      WHERE user_id = v_uid;
  DELETE FROM public.transactions       WHERE user_id = v_uid;
  DELETE FROM public.net_worth_snapshots WHERE user_id = v_uid;
  DELETE FROM public.deductions         WHERE user_id = v_uid;
  DELETE FROM public.review_items       WHERE user_id = v_uid;
  DELETE FROM public.auto_sort_rules    WHERE user_id = v_uid;

  -- ── Profile ────────────────────────────────────────────────────────────────
  UPDATE public.profiles SET
    display_name        = 'Marcus Webb',
    first_name          = 'Marcus',
    last_name           = 'Webb',
    email_opt_in        = true,
    terms_accepted_at   = NOW() - INTERVAL '120 days',
    onboarding_progress = '{"completed":true,"steps":{"accounts":true,"transactions":true,"budget":true,"tax":true,"profile":true}}'::jsonb,
    updated_at          = NOW()
  WHERE id = v_uid;

  -- ── Org settings ───────────────────────────────────────────────────────────
  INSERT INTO public.org_settings (user_id, business_name, ein, business_address_line1, business_city, business_state, business_zip, filing_type)
  VALUES (v_uid, 'Webb Strategy Consulting LLC', '82-3987654', '245 Park Avenue Suite 1800', 'New York', 'NY', '10167', 'Schedule C')
  ON CONFLICT (user_id) DO UPDATE SET
    business_name = EXCLUDED.business_name, ein = EXCLUDED.ein,
    business_address_line1 = EXCLUDED.business_address_line1,
    business_city = EXCLUDED.business_city, business_state = EXCLUDED.business_state,
    business_zip = EXCLUDED.business_zip, filing_type = EXCLUDED.filing_type;

  -- ── Tax year settings ──────────────────────────────────────────────────────
  INSERT INTO public.tax_year_settings (user_id, tax_year, tax_rate)
  VALUES (v_uid, 2025, 0.32), (v_uid, 2026, 0.32)
  ON CONFLICT (user_id, tax_year) DO UPDATE SET tax_rate = EXCLUDED.tax_rate;

  -- ── Notification prefs ─────────────────────────────────────────────────────
  INSERT INTO public.notification_preferences (user_id, type, value)
  VALUES (v_uid, 'count_based', '10')
  ON CONFLICT (user_id) DO NOTHING;

  -- ── Subscription (active Plus) ─────────────────────────────────────────────
  INSERT INTO public.subscriptions (user_id, plan, status, current_period_end, cancel_at_period_end)
  VALUES (v_uid, 'plus', 'active', NOW() + INTERVAL '25 days', false)
  ON CONFLICT (user_id) DO UPDATE SET plan = 'plus', status = 'active', current_period_end = NOW() + INTERVAL '25 days';

  -- ── Data sources ───────────────────────────────────────────────────────────
  -- account_type must match the values the app groups on: 'checking', 'savings',
  -- 'credit' (NOT 'credit_card'). `balance` drives the dollar value shown on the
  -- Accounts page; credit cards are stored as a negative (liability) balance.
  -- Resolve-or-insert by name so existing accounts (and their workspace link) are
  -- preserved on re-run instead of being duplicated.
  SELECT id INTO ds_chk FROM public.data_sources WHERE user_id = v_uid AND name = 'Chase Total Checking' LIMIT 1;
  IF ds_chk IS NULL THEN
    ds_chk := gen_random_uuid();
    INSERT INTO public.data_sources (id, user_id, name, account_type, institution, source_type, last_upload_at, transaction_count, balance, balance_updated_at)
    VALUES (ds_chk, v_uid, 'Chase Total Checking', 'checking', 'JPMorgan Chase', 'manual', NOW() - INTERVAL '1 day', 214, 21500.00, NOW());
  ELSE
    UPDATE public.data_sources SET account_type = 'checking', balance = 21500.00, balance_updated_at = NOW(), transaction_count = 214 WHERE id = ds_chk;
  END IF;

  SELECT id INTO ds_sav FROM public.data_sources WHERE user_id = v_uid AND name = 'Chase Savings' LIMIT 1;
  IF ds_sav IS NULL THEN
    ds_sav := gen_random_uuid();
    INSERT INTO public.data_sources (id, user_id, name, account_type, institution, source_type, last_upload_at, transaction_count, balance, balance_updated_at)
    VALUES (ds_sav, v_uid, 'Chase Savings', 'savings', 'JPMorgan Chase', 'manual', NOW() - INTERVAL '1 day', 18, 48100.00, NOW());
  ELSE
    UPDATE public.data_sources SET account_type = 'savings', balance = 48100.00, balance_updated_at = NOW(), transaction_count = 18 WHERE id = ds_sav;
  END IF;

  SELECT id INTO ds_cc FROM public.data_sources WHERE user_id = v_uid AND name = 'Chase Sapphire Reserve' LIMIT 1;
  IF ds_cc IS NULL THEN
    ds_cc := gen_random_uuid();
    INSERT INTO public.data_sources (id, user_id, name, account_type, institution, source_type, last_upload_at, transaction_count, balance, balance_updated_at)
    VALUES (ds_cc, v_uid, 'Chase Sapphire Reserve', 'credit', 'JPMorgan Chase', 'manual', NOW() - INTERVAL '1 day', 388, -3120.00, NOW());
  ELSE
    UPDATE public.data_sources SET account_type = 'credit', balance = -3120.00, balance_updated_at = NOW(), transaction_count = 388 WHERE id = ds_cc;
  END IF;

  -- ── Workspace (required by deductions.workspace_id NOT NULL) ───────────────
  -- Reuse an existing workspace linked to this user's data sources, or create one.
  SELECT workspace_id INTO v_wsid
  FROM public.data_sources
  WHERE user_id = v_uid AND workspace_id IS NOT NULL
  LIMIT 1;

  IF v_wsid IS NULL THEN
    -- Check whether the workspaces table exists at all
    SELECT count(*) INTO n_cols
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workspaces';

    IF n_cols > 0 THEN
      v_wsid := gen_random_uuid();
      cols := ARRAY[]::TEXT[]; vals := ARRAY[]::TEXT[]; missing := ARRAY[]::TEXT[];

      FOR col IN
        SELECT column_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'workspaces'
        ORDER BY ordinal_position
      LOOP
        IF col.column_name = 'id' THEN
          cols := array_append(cols, 'id');
          vals := array_append(vals, quote_literal(v_wsid) || '::uuid');
        ELSIF col.column_name IN ('name','title','display_name','business_name','label') THEN
          cols := array_append(cols, col.column_name);
          vals := array_append(vals, quote_literal('Webb Strategy Consulting LLC'));
        ELSIF col.column_name = 'slug' THEN
          cols := array_append(cols, col.column_name);
          vals := array_append(vals, quote_literal('demo-webb-strategy'));
        ELSIF col.column_name IN ('owner_id','user_id','created_by','owner','profile_id','account_id') THEN
          cols := array_append(cols, col.column_name);
          vals := array_append(vals, quote_literal(v_uid) || '::uuid');
        ELSIF col.column_name IN ('created_at','updated_at','inserted_at') THEN
          cols := array_append(cols, col.column_name);
          vals := array_append(vals, 'now()');
        ELSIF col.is_nullable = 'NO' AND col.column_default IS NULL THEN
          missing := array_append(missing, col.column_name);
        END IF;
      END LOOP;

      IF array_length(missing, 1) IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot auto-create workspace: required column(s) [%] unknown. Add them to the seed script.', array_to_string(missing, ', ');
      END IF;

      EXECUTE format('INSERT INTO public.workspaces (%s) VALUES (%s)',
        array_to_string(cols, ', '), array_to_string(vals, ', '));
      RAISE NOTICE 'Created workspace % for demo user', v_wsid;

      UPDATE public.data_sources SET workspace_id = v_wsid WHERE user_id = v_uid;
    ELSE
      -- No workspaces table — leave v_wsid NULL and skip deductions
      RAISE NOTICE 'public.workspaces not found; deductions will be skipped';
    END IF;
  ELSE
    RAISE NOTICE 'Reusing existing workspace % for demo user', v_wsid;
  END IF;

  -- ── Auto-sort rules ────────────────────────────────────────────────────────
  INSERT INTO public.auto_sort_rules (user_id, vendor_pattern, quick_label, business_purpose, category, marker, business_pct, name, enabled, conditions, action)
  VALUES
    (v_uid,'brooklyn tabernacle','Church Tithe',NULL,'Charitable Contributions','Personal',NULL,'Brooklyn Tabernacle',true,'{"vendor_contains":"brooklyn tabernacle"}'::jsonb,'{"marker":"Personal","quick_label":"Church Tithe"}'::jsonb),
    (v_uid,'equinox','Gym Membership',NULL,'Personal','Personal',NULL,'Equinox',true,'{"vendor_contains":"equinox"}'::jsonb,'{"marker":"Personal","quick_label":"Gym Membership"}'::jsonb),
    (v_uid,'zoom','Video Conferencing','Client calls & meetings','Software','Business',100,'Zoom Pro',true,'{"vendor_contains":"zoom"}'::jsonb,'{"marker":"Business","quick_label":"Video Conferencing"}'::jsonb),
    (v_uid,'linkedin','Professional Network','Business development','Advertising','Business',100,'LinkedIn Premium',true,'{"vendor_contains":"linkedin"}'::jsonb,'{"marker":"Business","quick_label":"Professional Network"}'::jsonb),
    (v_uid,'notion','Project Management','Client project mgmt','Software','Business',100,'Notion',true,'{"vendor_contains":"notion"}'::jsonb,'{"marker":"Business","quick_label":"Project Management"}'::jsonb),
    (v_uid,'netflix','Streaming',NULL,'Entertainment','Personal',NULL,'Netflix',true,'{"vendor_contains":"netflix"}'::jsonb,'{"marker":"Personal","quick_label":"Streaming"}'::jsonb),
    (v_uid,'spotify','Music Streaming',NULL,'Entertainment','Personal',NULL,'Spotify',true,'{"vendor_contains":"spotify"}'::jsonb,'{"marker":"Personal","quick_label":"Music Streaming"}'::jsonb),
    (v_uid,'mta nyc transit','MetroCard',NULL,'Transportation','Personal',NULL,'MTA Transit',true,'{"vendor_contains":"mta"}'::jsonb,'{"marker":"Personal","quick_label":"MetroCard"}'::jsonb),
    (v_uid,'google workspace','Google Workspace','Email & cloud storage','Software','Business',100,'Google Workspace',true,'{"vendor_contains":"google workspace"}'::jsonb,'{"marker":"Business","quick_label":"Google Workspace"}'::jsonb),
    (v_uid,'con edison','Utilities',NULL,'Utilities','Personal',NULL,'ConEd',true,'{"vendor_contains":"con edison"}'::jsonb,'{"marker":"Personal","quick_label":"Utilities"}'::jsonb)
  ON CONFLICT DO NOTHING;

  -- ── Triage progress ────────────────────────────────────────────────────────
  INSERT INTO public.triage_progress (user_id, total_sorted, rules_created, lifetime_deductions, lifetime_tax_saved, current_streak, longest_streak, last_triage_date, badges)
  VALUES (v_uid, 312, 10, 18640.00, 5964.80, 9, 22, CURRENT_DATE - 1,
    '[{"id":"first_sort","label":"First Sort","earned_at":"2025-02-01"},{"id":"rule_master","label":"Rule Master","earned_at":"2025-04-15"},{"id":"streak_7","label":"7-Day Streak","earned_at":"2025-05-12"},{"id":"streak_14","label":"14-Day Streak","earned_at":"2025-05-26"},{"id":"deduction_1k","label":"$1K Deductions","earned_at":"2025-03-20"},{"id":"deduction_5k","label":"$5K Deductions","earned_at":"2025-07-08"},{"id":"deduction_10k","label":"$10K Deductions","earned_at":"2026-01-14"},{"id":"tax_hero","label":"Tax Hero","earned_at":"2026-02-28"}]'::jsonb)
  ON CONFLICT (user_id) DO UPDATE SET
    total_sorted = EXCLUDED.total_sorted, rules_created = EXCLUDED.rules_created,
    lifetime_deductions = EXCLUDED.lifetime_deductions, lifetime_tax_saved = EXCLUDED.lifetime_tax_saved,
    current_streak = EXCLUDED.current_streak, longest_streak = EXCLUDED.longest_streak,
    last_triage_date = EXCLUDED.last_triage_date, badges = EXCLUDED.badges;

  -- ════════════════════════════════════════════════════════════════════
  -- TRANSACTIONS — 2025 (full year)
  -- ════════════════════════════════════════════════════════════════════
  INSERT INTO public.transactions (user_id,date,vendor,description,amount,category,schedule_c_line,status,marker,business_pct,transaction_type,tax_year,source,data_source_id,deduction_percent,is_meal,is_travel) VALUES

  -- January 2025
  (v_uid,'2025-01-03','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-01-17','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-01-01','456 Atlantic Ave LLC','Rent January',2850.00,'Rent',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-01-06','Brooklyn Tabernacle','Monthly tithe',1500.00,'Charitable Contributions',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-01-10','Con Edison','Electric bill',112.40,'Utilities',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-01-11','Equinox','Gym membership',220.00,'Personal',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-01-13','Whole Foods Market','Groceries',143.28,'Groceries',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-01-15','Zoom Communications','Zoom Pro',15.99,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-01-15','LinkedIn Premium','Subscription',39.99,'Advertising','Advertising','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-01-16','Notion','Workspace',16.00,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-01-18','MTA NYC Transit','MetroCard',127.00,'Transportation',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-01-20','Seamless','Lunch delivery',34.20,'Meals',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-01-21','Netflix','Streaming',22.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-01-22','Spotify','Music',9.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-01-24','Google Workspace','Business email',12.00,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-01-26','Whole Foods Market','Groceries',89.55,'Groceries',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-01-28','Uber','Ride to client',22.40,'Transportation','Travel','completed','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-01-29','World Vision','Donation',200.00,'Charitable Contributions',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),

  -- February 2025
  (v_uid,'2025-02-01','Webb Strategy Consulting LLC','Consulting invoice Q4 final',10000.00,NULL,NULL,'completed','Business',100,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-02-03','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-02-14','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-02-01','456 Atlantic Ave LLC','Rent February',2850.00,'Rent',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-02-05','Brooklyn Tabernacle','Monthly tithe',1500.00,'Charitable Contributions',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-02-08','Con Edison','Electric bill',98.60,'Utilities',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-02-10','Equinox','Gym membership',220.00,'Personal',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-02-12','Boqueria NYC','Client dinner - new prospect',187.40,'Meals','Meals (50%)','completed','Business',100,'expense',2025,'csv_upload',ds_cc,50,true,false),
  (v_uid,'2025-02-13','Whole Foods Market','Groceries',162.45,'Groceries',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-02-15','Zoom Communications','Zoom Pro',15.99,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-02-15','LinkedIn Premium','Subscription',39.99,'Advertising','Advertising','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-02-18','MTA NYC Transit','MetroCard',127.00,'Transportation',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-02-20','Amazon','Home office supplies',78.34,'Supplies','Supplies','completed','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-02-22','Netflix','Streaming',22.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-02-25','Delta Airlines','Flight to Chicago - client',312.00,'Travel','Travel','completed','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,true),
  (v_uid,'2025-02-26','Marriott Hotels','Chicago hotel 2 nights',274.00,'Travel','Travel','completed','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,true),

  -- March 2025
  (v_uid,'2025-03-03','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-03-17','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-03-01','456 Atlantic Ave LLC','Rent March',2850.00,'Rent',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-03-05','Brooklyn Tabernacle','Monthly tithe',1500.00,'Charitable Contributions',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-03-09','Con Edison','Electric bill',88.20,'Utilities',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-03-11','Equinox','Gym membership',220.00,'Personal',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-03-13','Whole Foods Market','Groceries',138.90,'Groceries',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-03-15','Zoom Communications','Zoom Pro',15.99,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-03-15','LinkedIn Premium','Subscription',39.99,'Advertising','Advertising','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-03-16','Notion','Workspace',16.00,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-03-18','MTA NYC Transit','MetroCard',127.00,'Transportation',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-03-19','Per Se NYC','Client dinner - engagement kick-off',342.50,'Meals','Meals (50%)','completed','Business',100,'expense',2025,'csv_upload',ds_cc,50,true,false),
  (v_uid,'2025-03-22','Netflix','Streaming',22.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-03-24','Google Workspace','Business email',12.00,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-03-26','Uber','Rides (personal + client)',38.60,'Transportation','Travel','completed','Partial',60,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-03-28','Amazon','Household items',65.22,'Personal',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),

  -- April 2025
  (v_uid,'2025-04-03','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-04-17','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-04-01','456 Atlantic Ave LLC','Rent April',2850.00,'Rent',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-04-06','Brooklyn Tabernacle','Monthly tithe',1500.00,'Charitable Contributions',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-04-08','Con Edison','Electric bill',91.80,'Utilities',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-04-10','Equinox','Gym membership',220.00,'Personal',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-04-12','Whole Foods Market','Groceries',155.70,'Groceries',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-04-14','Zoom Communications','Zoom Pro',15.99,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-04-15','LinkedIn Premium','Subscription',39.99,'Advertising','Advertising','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-04-17','MTA NYC Transit','MetroCard',127.00,'Transportation',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-04-20','Staples','Office supplies',87.44,'Supplies','Supplies','completed','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-04-22','Netflix','Streaming',22.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-04-24','Seamless','Lunch delivery',42.80,'Meals',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-04-26','CVS Pharmacy','Personal care',38.20,'Personal',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-04-28','Verizon Wireless','Phone bill',95.00,'Utilities','Utilities','completed','Partial',40,'expense',2025,'csv_upload',ds_cc,100,false,false),

  -- May 2025
  (v_uid,'2025-05-05','Webb Strategy Consulting LLC','Consulting invoice Q1',14000.00,NULL,NULL,'completed','Business',100,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-05-02','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-05-16','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-05-01','456 Atlantic Ave LLC','Rent May',2850.00,'Rent',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-05-04','Brooklyn Tabernacle','Tithe + consulting tithe',2900.00,'Charitable Contributions',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-05-07','Con Edison','Electric bill',105.20,'Utilities',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-05-09','Equinox','Gym membership',220.00,'Personal',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-05-11','Whole Foods Market','Groceries',178.35,'Groceries',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-05-13','Whole Foods Market','Groceries',92.14,'Groceries',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-05-14','Zoom Communications','Zoom Pro',15.99,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-05-15','LinkedIn Premium','Subscription',39.99,'Advertising','Advertising','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-05-17','MTA NYC Transit','MetroCard',127.00,'Transportation',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-05-19','Lilia Restaurant','Client dinner - pipeline',228.60,'Meals','Meals (50%)','completed','Business',100,'expense',2025,'csv_upload',ds_cc,50,true,false),
  (v_uid,'2025-05-21','United Airlines','Flight to DC - client summit',398.00,'Travel','Travel','completed','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,true),
  (v_uid,'2025-05-22','Hilton Hotels','DC hotel 3 nights',387.00,'Travel','Travel','completed','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,true),
  (v_uid,'2025-05-24','Netflix','Streaming',22.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-05-28','Amazon','Standing desk accessories',124.99,'Supplies','Supplies','completed','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),

  -- June 2025
  (v_uid,'2025-06-02','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-06-16','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-06-01','456 Atlantic Ave LLC','Rent June',2850.00,'Rent',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-06-04','Brooklyn Tabernacle','Monthly tithe',1500.00,'Charitable Contributions',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-06-06','Con Edison','Electric bill',132.80,'Utilities',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-06-08','Equinox','Gym membership',220.00,'Personal',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-06-10','Whole Foods Market','Groceries',145.60,'Groceries',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-06-13','Zoom Communications','Zoom Pro',15.99,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-06-14','LinkedIn Premium','Subscription',39.99,'Advertising','Advertising','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-06-15','MTA NYC Transit','MetroCard',127.00,'Transportation',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-06-17','Notion','Workspace',16.00,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-06-20','Netflix','Streaming',22.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-06-22','Seamless','Lunch delivery',29.45,'Meals',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-06-25','Target','Household items',62.34,'Personal',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-06-27','Uber','Weekend rides',45.80,'Transportation',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-06-29','Samaritan''s Purse','Charitable donation',300.00,'Charitable Contributions',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),

  -- July 2025
  (v_uid,'2025-07-03','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-07-17','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-07-01','456 Atlantic Ave LLC','Rent July',2850.00,'Rent',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-07-06','Brooklyn Tabernacle','Monthly tithe',1500.00,'Charitable Contributions',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-07-08','Con Edison','Electric - AC season',172.40,'Utilities',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-07-10','Equinox','Gym membership',220.00,'Personal',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-07-12','Whole Foods Market','Groceries',162.40,'Groceries',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-07-14','Zoom Communications','Zoom Pro',15.99,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-07-15','LinkedIn Premium','Subscription',39.99,'Advertising','Advertising','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-07-17','MTA NYC Transit','MetroCard',127.00,'Transportation',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-07-19','Delta Airlines','Flight to Boston - conference',245.00,'Travel','Travel','completed','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,true),
  (v_uid,'2025-07-19','Courtyard Marriott','Boston hotel 2 nights',298.00,'Travel','Travel','completed','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,true),
  (v_uid,'2025-07-21','Netflix','Streaming',22.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-07-24','Amazon','Personal electronics',189.99,'Personal',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-07-26','Corner Social NYC','Team lunch with subcontractor',145.80,'Meals','Meals (50%)','completed','Business',100,'expense',2025,'csv_upload',ds_cc,50,true,false),

  -- August 2025
  (v_uid,'2025-08-07','Webb Strategy Consulting LLC','Consulting invoice Q2',13000.00,NULL,NULL,'completed','Business',100,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-08-04','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-08-18','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-08-01','456 Atlantic Ave LLC','Rent August',2850.00,'Rent',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-08-04','Brooklyn Tabernacle','Tithe + consulting tithe',2800.00,'Charitable Contributions',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-08-07','Con Edison','Electric - AC peak',192.60,'Utilities',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-08-09','Equinox','Gym membership',220.00,'Personal',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-08-12','Whole Foods Market','Groceries',148.20,'Groceries',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-08-14','Zoom Communications','Zoom Pro',15.99,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-08-15','LinkedIn Premium','Subscription',39.99,'Advertising','Advertising','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-08-16','MTA NYC Transit','MetroCard',127.00,'Transportation',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-08-18','Notion','Workspace',16.00,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-08-20','Netflix','Streaming',22.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-08-21','Udemy','Business strategy course',84.99,'Education','Other expenses','completed','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-08-24','Whole Foods Market','Groceries',111.44,'Groceries',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-08-27','Uber','Client meeting rides',56.40,'Transportation','Travel','completed','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),

  -- September 2025
  (v_uid,'2025-09-03','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-09-17','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-09-01','456 Atlantic Ave LLC','Rent September',2850.00,'Rent',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-09-04','Brooklyn Tabernacle','Monthly tithe',1500.00,'Charitable Contributions',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-09-08','Con Edison','Electric bill',148.50,'Utilities',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-09-10','Equinox','Gym membership',220.00,'Personal',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-09-12','Whole Foods Market','Groceries',136.80,'Groceries',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-09-14','Zoom Communications','Zoom Pro',15.99,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-09-15','LinkedIn Premium','Subscription',39.99,'Advertising','Advertising','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-09-16','MTA NYC Transit','MetroCard',127.00,'Transportation',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-09-18','Google Workspace','Business email',12.00,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-09-20','Ai Fiori NYC','Client dinner - new engagement',412.30,'Meals','Meals (50%)','completed','Business',100,'expense',2025,'csv_upload',ds_cc,50,true,false),
  (v_uid,'2025-09-22','Netflix','Streaming',22.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-09-25','Amazon','Business books',47.96,'Supplies','Supplies','completed','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-09-28','Duane Reade','Personal care',28.44,'Personal',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),

  -- October 2025
  (v_uid,'2025-10-03','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-10-17','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-10-01','456 Atlantic Ave LLC','Rent October',2850.00,'Rent',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-10-05','Brooklyn Tabernacle','Monthly tithe',1500.00,'Charitable Contributions',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-10-07','Con Edison','Electric bill',95.40,'Utilities',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-10-09','Equinox','Gym membership',220.00,'Personal',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-10-12','Whole Foods Market','Groceries',167.30,'Groceries',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-10-14','Zoom Communications','Zoom Pro',15.99,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-10-15','LinkedIn Premium','Subscription',39.99,'Advertising','Advertising','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-10-17','MTA NYC Transit','MetroCard',127.00,'Transportation',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-10-20','Notion','Workspace',16.00,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-10-22','Netflix','Streaming',22.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-10-24','Seamless','Lunch delivery',38.60,'Meals',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-10-26','Apple Store','Accessories',89.99,'Personal',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-10-28','United Airlines','Flight to Miami - client event',428.00,'Travel','Travel','completed','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,true),
  (v_uid,'2025-10-28','Marriott Hotels','Miami hotel 3 nights',522.00,'Travel','Travel','completed','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,true),

  -- November 2025
  (v_uid,'2025-11-06','Webb Strategy Consulting LLC','Consulting invoice Q3',13000.00,NULL,NULL,'completed','Business',100,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-11-03','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-11-17','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-11-01','456 Atlantic Ave LLC','Rent November',2850.00,'Rent',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-11-04','Brooklyn Tabernacle','Tithe + consulting tithe',2800.00,'Charitable Contributions',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-11-07','Con Edison','Electric bill',104.20,'Utilities',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-11-09','Equinox','Gym membership',220.00,'Personal',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-11-11','Whole Foods Market','Groceries',158.90,'Groceries',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-11-13','Zoom Communications','Zoom Pro',15.99,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-11-14','LinkedIn Premium','Subscription',39.99,'Advertising','Advertising','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-11-16','MTA NYC Transit','MetroCard',127.00,'Transportation',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-11-22','Amazon','Thanksgiving shopping',112.56,'Personal',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-11-23','Netflix','Streaming',22.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-11-26','Rubirosa NYC','Thanksgiving dinner',248.50,'Meals',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-11-28','World Vision','Holiday giving',300.00,'Charitable Contributions',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-11-29','Google Workspace','Business email',12.00,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),

  -- December 2025
  (v_uid,'2025-12-03','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-12-17','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-12-01','456 Atlantic Ave LLC','Rent December',2850.00,'Rent',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-12-05','Brooklyn Tabernacle','Christmas year-end gift',3000.00,'Charitable Contributions',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2025-12-07','Con Edison','Electric - heat',125.60,'Utilities',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-12-09','Equinox','Gym membership',220.00,'Personal',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-12-11','Whole Foods Market','Groceries',175.20,'Groceries',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-12-14','Zoom Communications','Zoom Pro',15.99,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-12-15','LinkedIn Premium','Subscription',39.99,'Advertising','Advertising','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-12-16','MTA NYC Transit','MetroCard',127.00,'Transportation',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-12-18','Notion','Workspace',16.00,'Software','Office expense','auto_sorted','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-12-19','The Modern NYC','Year-end client dinner',680.50,'Meals','Meals (50%)','completed','Business',100,'expense',2025,'csv_upload',ds_cc,50,true,false),
  (v_uid,'2025-12-20','Amazon','Christmas gifts',342.80,'Personal',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-12-22','Netflix','Streaming',22.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-12-24','Target','Holiday gifts',188.40,'Personal',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-12-26','GoDaddy','Domain & hosting annual',134.88,'Software','Office expense','completed','Business',100,'expense',2025,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2025-12-28','Samaritan''s Purse','Year-end donation',500.00,'Charitable Contributions',NULL,'completed','Personal',NULL,'expense',2025,'csv_upload',ds_chk,100,false,false);

  -- ════════════════════════════════════════════════════════════════════
  -- TRANSACTIONS — January 2026
  -- ════════════════════════════════════════════════════════════════════
  INSERT INTO public.transactions (user_id,date,vendor,description,amount,category,schedule_c_line,status,marker,business_pct,transaction_type,tax_year,source,data_source_id,deduction_percent,is_meal,is_travel) VALUES
  (v_uid,'2026-01-06','Webb Strategy Consulting LLC','Consulting invoice Q4 2025',10000.00,NULL,NULL,'completed','Business',100,'income',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-01-03','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-01-17','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-01-01','456 Atlantic Ave LLC','Rent January',2850.00,'Rent',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-01-05','Brooklyn Tabernacle','Tithe + consulting tithe',2500.00,'Charitable Contributions',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-01-07','Con Edison','Electric - heat',142.80,'Utilities',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-01-09','Equinox','Gym membership',220.00,'Personal',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-01-11','Whole Foods Market','Groceries',152.40,'Groceries',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-01-13','Zoom Communications','Zoom Pro',15.99,'Software','Office expense','auto_sorted','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-01-13','LinkedIn Premium','Subscription',39.99,'Advertising','Advertising','auto_sorted','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-01-14','Notion','Workspace',16.00,'Software','Office expense','auto_sorted','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-01-16','MTA NYC Transit','MetroCard',132.00,'Transportation',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-01-18','Netflix','Streaming',22.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-01-19','Spotify','Music',9.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-01-20','Google Workspace','Business email',12.00,'Software','Office expense','auto_sorted','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-01-22','Whole Foods Market','Groceries',98.75,'Groceries',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-01-24','Uber','Client meeting + weekend',42.60,'Transportation','Travel','completed','Partial',60,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-01-26','Seamless','Lunch delivery',31.80,'Meals',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-01-28','Amazon','Home office gear',114.99,'Supplies','Supplies','completed','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-01-30','Verizon Wireless','Phone bill',95.00,'Utilities','Utilities','completed','Partial',40,'expense',2026,'csv_upload',ds_cc,100,false,false);

  -- ════════════════════════════════════════════════════════════════════
  -- TRANSACTIONS — February 2026
  -- ════════════════════════════════════════════════════════════════════
  INSERT INTO public.transactions (user_id,date,vendor,description,amount,category,schedule_c_line,status,marker,business_pct,transaction_type,tax_year,source,data_source_id,deduction_percent,is_meal,is_travel) VALUES
  (v_uid,'2026-02-03','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-02-14','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-02-01','456 Atlantic Ave LLC','Rent February',2850.00,'Rent',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-02-04','Brooklyn Tabernacle','Monthly tithe',1500.00,'Charitable Contributions',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-02-06','Con Edison','Electric bill',118.60,'Utilities',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-02-08','Equinox','Gym membership',220.00,'Personal',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-02-10','Whole Foods Market','Groceries',168.20,'Groceries',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-02-13','Zoom Communications','Zoom Pro',15.99,'Software','Office expense','auto_sorted','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-02-13','LinkedIn Premium','Subscription',39.99,'Advertising','Advertising','auto_sorted','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-02-14','Notion','Workspace',16.00,'Software','Office expense','auto_sorted','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-02-16','MTA NYC Transit','MetroCard',132.00,'Transportation',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-02-17','Carbone NYC','Client dinner - Valentine week',524.00,'Meals','Meals (50%)','completed','Business',100,'expense',2026,'csv_upload',ds_cc,50,true,false),
  (v_uid,'2026-02-19','Netflix','Streaming',22.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-02-21','Delta Airlines','Flight to LA - client strategy',498.00,'Travel','Travel','completed','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,true),
  (v_uid,'2026-02-21','The Westin','LA hotel 3 nights',642.00,'Travel','Travel','completed','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,true),
  (v_uid,'2026-02-24','Whole Foods Market','Groceries',132.45,'Groceries',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-02-26','Uber','Rides',38.20,'Transportation',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-02-27','World Vision','Monthly donation',200.00,'Charitable Contributions',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-02-28','Amazon','Household',67.44,'Personal',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false);

  -- ════════════════════════════════════════════════════════════════════
  -- TRANSACTIONS — March 2026 (budget assigned below)
  -- ════════════════════════════════════════════════════════════════════
  INSERT INTO public.transactions (user_id,date,vendor,description,amount,category,schedule_c_line,status,marker,business_pct,transaction_type,tax_year,source,data_source_id,deduction_percent,is_meal,is_travel) VALUES
  (v_uid,'2026-03-03','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-03-17','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-03-10','Webb Strategy Consulting LLC','Consulting invoice Q4 retainer',12500.00,NULL,NULL,'completed','Business',100,'income',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-03-01','456 Atlantic Ave LLC','Rent March',2850.00,'Rent',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-03-05','Brooklyn Tabernacle','Tithe + consulting tithe',2750.00,'Charitable Contributions',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-03-07','Con Edison','Electric bill',108.20,'Utilities',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-03-09','Equinox','Gym membership',220.00,'Personal',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-03-11','Whole Foods Market','Groceries',161.30,'Groceries',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-03-14','Zoom Communications','Zoom Pro',15.99,'Software','Office expense','auto_sorted','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-03-14','LinkedIn Premium','Subscription',39.99,'Advertising','Advertising','auto_sorted','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-03-16','MTA NYC Transit','MetroCard',132.00,'Transportation',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-03-18','Llama Inn NYC','Client lunch - new prospect',148.60,'Meals','Meals (50%)','completed','Business',100,'expense',2026,'csv_upload',ds_cc,50,true,false),
  (v_uid,'2026-03-19','Netflix','Streaming',22.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-03-21','Whole Foods Market','Groceries',122.80,'Groceries',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-03-22','Uber','Rides this week',34.40,'Transportation','Travel','completed','Partial',60,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-03-24','Seamless','Lunch delivery',28.90,'Meals',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-03-25','World Vision','Monthly donation',200.00,'Charitable Contributions',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-03-27','Amazon','Personal care + household',78.44,'Personal',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-03-29','Spotify','Music',9.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false);

  -- ════════════════════════════════════════════════════════════════════
  -- TRANSACTIONS — April 2026 (budget assigned below)
  -- ════════════════════════════════════════════════════════════════════
  INSERT INTO public.transactions (user_id,date,vendor,description,amount,category,schedule_c_line,status,marker,business_pct,transaction_type,tax_year,source,data_source_id,deduction_percent,is_meal,is_travel) VALUES
  (v_uid,'2026-04-03','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-04-17','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-04-01','456 Atlantic Ave LLC','Rent April',2850.00,'Rent',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-04-05','Brooklyn Tabernacle','Monthly tithe',1500.00,'Charitable Contributions',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-04-07','Con Edison','Electric bill',96.40,'Utilities',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-04-09','Equinox','Gym membership',220.00,'Personal',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-04-11','Whole Foods Market','Groceries',158.90,'Groceries',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-04-13','Zoom Communications','Zoom Pro',15.99,'Software','Office expense','auto_sorted','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-04-13','LinkedIn Premium','Subscription',39.99,'Advertising','Advertising','auto_sorted','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-04-14','Notion','Workspace',16.00,'Software','Office expense','auto_sorted','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-04-15','Google Workspace','Business email',12.00,'Software','Office expense','auto_sorted','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-04-15','MTA NYC Transit','MetroCard',132.00,'Transportation',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-04-16','Don Angie NYC','Client dinner - Q2 close',389.20,'Meals','Meals (50%)','completed','Business',100,'expense',2026,'csv_upload',ds_cc,50,true,false),
  (v_uid,'2026-04-17','Netflix','Streaming',22.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-04-19','Spotify','Music',9.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-04-20','Whole Foods Market','Groceries',144.20,'Groceries',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-04-21','Uber','Rides',45.20,'Transportation',NULL,'completed','Partial',50,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-04-22','Delta Airlines','Flight to Philadelphia - client',218.00,'Travel','Travel','completed','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,true),
  (v_uid,'2026-04-22','Kimpton Hotel','Philly hotel 1 night',224.00,'Travel','Travel','completed','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,true),
  (v_uid,'2026-04-24','Seamless','Lunch delivery',36.40,'Meals',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-04-25','World Vision','Monthly donation',200.00,'Charitable Contributions',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-04-27','Amazon','Personal items',88.34,'Personal',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-04-28','CVS Pharmacy','Personal care',32.60,'Personal',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-04-29','Verizon Wireless','Phone bill',95.00,'Utilities','Utilities','completed','Partial',40,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-04-30','Samaritan''s Purse','April donation',150.00,'Charitable Contributions',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_chk,100,false,false);

  -- ════════════════════════════════════════════════════════════════════
  -- TRANSACTIONS — May 2026 (current month, mix of completed + pending)
  -- ════════════════════════════════════════════════════════════════════
  INSERT INTO public.transactions (user_id,date,vendor,description,amount,category,schedule_c_line,status,marker,business_pct,transaction_type,tax_year,source,data_source_id,deduction_percent,is_meal,is_travel) VALUES
  (v_uid,'2026-05-02','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-05-16','JPMorgan Chase Payroll','Bi-weekly salary',3612.50,NULL,NULL,'completed','Personal',NULL,'income',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-05-08','Webb Strategy Consulting LLC','Consulting invoice Q1 2026',12500.00,NULL,NULL,'completed','Business',100,'income',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-05-01','456 Atlantic Ave LLC','Rent May',2850.00,'Rent',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-05-04','Brooklyn Tabernacle','Tithe + consulting tithe',2750.00,'Charitable Contributions',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-05-06','Con Edison','Electric bill',104.80,'Utilities',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-05-07','Xfinity','Internet',79.99,'Utilities',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-05-08','Equinox','Gym membership',220.00,'Personal',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-05-09','Whole Foods Market','Groceries',172.45,'Groceries',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-05-12','Zoom Communications','Zoom Pro',15.99,'Software','Office expense','auto_sorted','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-05-12','LinkedIn Premium','Subscription',39.99,'Advertising','Advertising','auto_sorted','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-05-13','Notion','Workspace',16.00,'Software','Office expense','auto_sorted','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-05-13','Google Workspace','Business email',12.00,'Software','Office expense','auto_sorted','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-05-14','MTA NYC Transit','MetroCard',132.00,'Transportation',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-05-15','Frenchette NYC','Client lunch - Q2 expansion',312.40,'Meals','Meals (50%)','completed','Business',100,'expense',2026,'csv_upload',ds_cc,50,true,false),
  (v_uid,'2026-05-17','Netflix','Streaming',22.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-05-17','Spotify','Music',9.99,'Entertainment',NULL,'auto_sorted','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-05-18','Whole Foods Market','Groceries',138.60,'Groceries',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-05-19','Uber','Airport ride to client',42.80,'Transportation','Travel','completed','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-05-20','Delta Airlines','Flight to Boston - fintech conf',382.00,'Travel','Travel','completed','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,true),
  (v_uid,'2026-05-20','Westin Copley','Boston hotel 2 nights',448.00,'Travel','Travel','completed','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,true),
  (v_uid,'2026-05-22','Amazon','Office supplies',62.49,'Supplies','Supplies','completed','Business',100,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-05-23','Seamless','Lunch delivery',33.80,'Meals',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-05-25','World Vision','Monthly donation',200.00,'Charitable Contributions',NULL,'completed','Personal',NULL,'expense',2026,'csv_upload',ds_chk,100,false,false),
  (v_uid,'2026-05-26','Verizon Wireless','Phone bill',95.00,'Utilities','Utilities','pending',NULL,NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-05-27','Amazon','Personal purchase',94.22,'Personal',NULL,'pending',NULL,NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-05-28','Uber','Rides',38.60,'Transportation',NULL,'pending',NULL,NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-05-29','DoorDash','Dinner delivery',48.20,'Meals',NULL,'pending',NULL,NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-05-30','CVS Pharmacy','Personal care',41.15,'Personal',NULL,'pending',NULL,NULL,'expense',2026,'csv_upload',ds_cc,100,false,false),
  (v_uid,'2026-05-30','Barber Shop NYC','Haircut & grooming',75.00,'Personal',NULL,'pending',NULL,NULL,'expense',2026,'csv_upload',ds_cc,100,false,false);

  -- ════════════════════════════════════════════════════════════════════
  -- BUDGET STRUCTURE — Months 2026
  -- ════════════════════════════════════════════════════════════════════
  INSERT INTO public.budget_months (id, user_id, month_key) VALUES
    (bm_jan, v_uid, '2026-01'),
    (bm_feb, v_uid, '2026-02'),
    (bm_mar, v_uid, '2026-03'),
    (bm_apr, v_uid, '2026-04'),
    (bm_may, v_uid, '2026-05')
  ON CONFLICT (user_id, month_key) DO NOTHING;

  -- ── March 2026 groups ──
  INSERT INTO public.budget_groups (id, user_id, budget_month_id, name, position) VALUES
    (g3_inc, v_uid, bm_mar, 'Income',          0),
    (g3_hse, v_uid, bm_mar, 'Housing',          1),
    (g3_giv, v_uid, bm_mar, 'Giving',           2),
    (g3_biz, v_uid, bm_mar, 'Business',         3),
    (g3_fod, v_uid, bm_mar, 'Food & Dining',    4),
    (g3_trn, v_uid, bm_mar, 'Transportation',   5),
    (g3_per, v_uid, bm_mar, 'Personal',         6)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.budget_lines (id, user_id, budget_group_id, name, allocated, position) VALUES
    (l3_sal,  v_uid, g3_inc, 'Salary',              7225.00, 0),
    (l3_con,  v_uid, g3_inc, 'Consulting',          12500.00, 1),
    (l3_rnt,  v_uid, g3_hse, 'Rent',                 2850.00, 0),
    (l3_ced,  v_uid, g3_hse, 'ConEd',                 150.00, 1),
    (l3_net1, v_uid, g3_hse, 'Internet',               80.00, 2),
    (l3_tth,  v_uid, g3_giv, 'Church Tithe',          2750.00, 0),
    (l3_cht,  v_uid, g3_giv, 'Charitable Giving',      200.00, 1),
    (l3_swz,  v_uid, g3_biz, 'Software & Tools',       100.00, 0),
    (l3_lnk,  v_uid, g3_biz, 'LinkedIn',                39.99, 1),
    (l3_cml,  v_uid, g3_biz, 'Client Meals',            300.00, 2),
    (l3_groc, v_uid, g3_fod, 'Groceries',               500.00, 0),
    (l3_din,  v_uid, g3_fod, 'Dining & Delivery',       200.00, 1),
    (l3_met,  v_uid, g3_trn, 'MetroCard',               132.00, 0),
    (l3_gym,  v_uid, g3_per, 'Equinox',                 220.00, 0)
  ON CONFLICT DO NOTHING;

  -- ── April 2026 groups ──
  INSERT INTO public.budget_groups (id, user_id, budget_month_id, name, position) VALUES
    (g4_inc, v_uid, bm_apr, 'Income',          0),
    (g4_hse, v_uid, bm_apr, 'Housing',          1),
    (g4_giv, v_uid, bm_apr, 'Giving',           2),
    (g4_biz, v_uid, bm_apr, 'Business',         3),
    (g4_fod, v_uid, bm_apr, 'Food & Dining',    4),
    (g4_trn, v_uid, bm_apr, 'Transportation',   5),
    (g4_per, v_uid, bm_apr, 'Personal',         6)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.budget_lines (id, user_id, budget_group_id, name, allocated, position) VALUES
    (l4_sal,  v_uid, g4_inc, 'Salary',              7225.00, 0),
    (l4_con,  v_uid, g4_inc, 'Consulting',               0.00, 1),
    (l4_rnt,  v_uid, g4_hse, 'Rent',                 2850.00, 0),
    (l4_ced,  v_uid, g4_hse, 'ConEd',                 150.00, 1),
    (l4_net1, v_uid, g4_hse, 'Internet',               80.00, 2),
    (l4_tth,  v_uid, g4_giv, 'Church Tithe',          1500.00, 0),
    (l4_cht,  v_uid, g4_giv, 'Charitable Giving',      350.00, 1),
    (l4_swz,  v_uid, g4_biz, 'Software & Tools',       100.00, 0),
    (l4_lnk,  v_uid, g4_biz, 'LinkedIn',                39.99, 1),
    (l4_sft,  v_uid, g4_biz, 'Client Meals',            400.00, 2),
    (l4_cml,  v_uid, g4_biz, 'Travel',                  500.00, 3),
    (l4_groc, v_uid, g4_fod, 'Groceries',               500.00, 0),
    (l4_din,  v_uid, g4_fod, 'Dining & Delivery',       200.00, 1),
    (l4_met,  v_uid, g4_trn, 'MetroCard',               132.00, 0),
    (l4_ub,   v_uid, g4_trn, 'Uber / Lyft',             100.00, 1),
    (l4_gym,  v_uid, g4_per, 'Equinox',                 220.00, 0),
    (l4_str,  v_uid, g4_per, 'Streaming',                35.00, 1),
    (l4_amz,  v_uid, g4_per, 'Amazon / Shopping',       150.00, 2)
  ON CONFLICT DO NOTHING;

  -- ── May 2026 groups ──
  INSERT INTO public.budget_groups (id, user_id, budget_month_id, name, position) VALUES
    (g5_inc, v_uid, bm_may, 'Income',          0),
    (g5_hse, v_uid, bm_may, 'Housing',          1),
    (g5_giv, v_uid, bm_may, 'Giving',           2),
    (g5_biz, v_uid, bm_may, 'Business',         3),
    (g5_fod, v_uid, bm_may, 'Food & Dining',    4),
    (g5_trn, v_uid, bm_may, 'Transportation',   5),
    (g5_per, v_uid, bm_may, 'Personal',         6)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.budget_lines (id, user_id, budget_group_id, name, allocated, position) VALUES
    (l5_sal,  v_uid, g5_inc, 'Salary',              7225.00, 0),
    (l5_con,  v_uid, g5_inc, 'Consulting',          12500.00, 1),
    (l5_rnt,  v_uid, g5_hse, 'Rent',                 2850.00, 0),
    (l5_ced,  v_uid, g5_hse, 'ConEd',                 150.00, 1),
    (l5_net1, v_uid, g5_hse, 'Internet',               80.00, 2),
    (l5_tth,  v_uid, g5_giv, 'Church Tithe',          2750.00, 0),
    (l5_cht,  v_uid, g5_giv, 'Charitable Giving',      200.00, 1),
    (l5_swz,  v_uid, g5_biz, 'Zoom',                   15.99, 0),
    (l5_lnk,  v_uid, g5_biz, 'LinkedIn',               39.99, 1),
    (l5_sft,  v_uid, g5_biz, 'Other Software',         28.00, 2),
    (l5_cml,  v_uid, g5_biz, 'Client Meals',           400.00, 3),
    (l5_trv,  v_uid, g5_biz, 'Travel',                 900.00, 4),
    (l5_sup,  v_uid, g5_biz, 'Supplies',               100.00, 5),
    (l5_groc, v_uid, g5_fod, 'Groceries',              550.00, 0),
    (l5_din,  v_uid, g5_fod, 'Dining & Delivery',      250.00, 1),
    (l5_met,  v_uid, g5_trn, 'MetroCard',              132.00, 0),
    (l5_ub,   v_uid, g5_trn, 'Uber / Lyft',            100.00, 1),
    (l5_gym,  v_uid, g5_per, 'Equinox',                220.00, 0),
    (l5_str,  v_uid, g5_per, 'Streaming',               35.00, 1),
    (l5_amz,  v_uid, g5_per, 'Amazon / Shopping',      200.00, 2),
    (l5_phn,  v_uid, g5_per, 'Phone',                   95.00, 3)
  ON CONFLICT DO NOTHING;

  -- ── Budget line → transaction assignments ─────────────────────────
  -- March 2026
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l3_sal, id FROM public.transactions WHERE user_id=v_uid AND vendor='JPMorgan Chase Payroll' AND date IN ('2026-03-03','2026-03-17') ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l3_con, id FROM public.transactions WHERE user_id=v_uid AND vendor='Webb Strategy Consulting LLC' AND date='2026-03-10' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l3_rnt, id FROM public.transactions WHERE user_id=v_uid AND vendor='456 Atlantic Ave LLC' AND date='2026-03-01' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l3_ced, id FROM public.transactions WHERE user_id=v_uid AND vendor='Con Edison' AND date='2026-03-07' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l3_tth, id FROM public.transactions WHERE user_id=v_uid AND vendor='Brooklyn Tabernacle' AND date='2026-03-05' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l3_cht, id FROM public.transactions WHERE user_id=v_uid AND vendor='World Vision' AND date='2026-03-25' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l3_swz, id FROM public.transactions WHERE user_id=v_uid AND vendor='Zoom Communications' AND date='2026-03-14' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l3_lnk, id FROM public.transactions WHERE user_id=v_uid AND vendor='LinkedIn Premium' AND date='2026-03-14' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l3_cml, id FROM public.transactions WHERE user_id=v_uid AND vendor='Llama Inn NYC' AND date='2026-03-18' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l3_groc, id FROM public.transactions WHERE user_id=v_uid AND vendor='Whole Foods Market' AND date IN ('2026-03-11','2026-03-21') ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l3_din, id FROM public.transactions WHERE user_id=v_uid AND vendor='Seamless' AND date='2026-03-24' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l3_met, id FROM public.transactions WHERE user_id=v_uid AND vendor='MTA NYC Transit' AND date='2026-03-16' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l3_gym, id FROM public.transactions WHERE user_id=v_uid AND vendor='Equinox' AND date='2026-03-09' ON CONFLICT DO NOTHING;

  -- April 2026
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l4_sal, id FROM public.transactions WHERE user_id=v_uid AND vendor='JPMorgan Chase Payroll' AND date IN ('2026-04-03','2026-04-17') ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l4_rnt, id FROM public.transactions WHERE user_id=v_uid AND vendor='456 Atlantic Ave LLC' AND date='2026-04-01' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l4_ced, id FROM public.transactions WHERE user_id=v_uid AND vendor='Con Edison' AND date='2026-04-07' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l4_tth, id FROM public.transactions WHERE user_id=v_uid AND vendor='Brooklyn Tabernacle' AND date='2026-04-05' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l4_cht, id FROM public.transactions WHERE user_id=v_uid AND vendor IN ('World Vision','Samaritan''s Purse') AND date IN ('2026-04-25','2026-04-30') ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l4_swz, id FROM public.transactions WHERE user_id=v_uid AND vendor IN ('Zoom Communications','Notion','Google Workspace') AND date IN ('2026-04-13','2026-04-14','2026-04-15') ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l4_lnk, id FROM public.transactions WHERE user_id=v_uid AND vendor='LinkedIn Premium' AND date='2026-04-13' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l4_sft, id FROM public.transactions WHERE user_id=v_uid AND vendor='Don Angie NYC' AND date='2026-04-16' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l4_cml, id FROM public.transactions WHERE user_id=v_uid AND vendor IN ('Delta Airlines','Kimpton Hotel') AND date='2026-04-22' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l4_groc, id FROM public.transactions WHERE user_id=v_uid AND vendor='Whole Foods Market' AND date IN ('2026-04-11','2026-04-20') ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l4_din, id FROM public.transactions WHERE user_id=v_uid AND vendor='Seamless' AND date='2026-04-24' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l4_met, id FROM public.transactions WHERE user_id=v_uid AND vendor='MTA NYC Transit' AND date='2026-04-15' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l4_ub, id FROM public.transactions WHERE user_id=v_uid AND vendor='Uber' AND date='2026-04-21' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l4_gym, id FROM public.transactions WHERE user_id=v_uid AND vendor='Equinox' AND date='2026-04-09' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l4_str, id FROM public.transactions WHERE user_id=v_uid AND vendor IN ('Netflix','Spotify') AND date IN ('2026-04-17','2026-04-19') ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l4_amz, id FROM public.transactions WHERE user_id=v_uid AND vendor='Amazon' AND date='2026-04-27' ON CONFLICT DO NOTHING;

  -- May 2026
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l5_sal, id FROM public.transactions WHERE user_id=v_uid AND vendor='JPMorgan Chase Payroll' AND date IN ('2026-05-02','2026-05-16') ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l5_con, id FROM public.transactions WHERE user_id=v_uid AND vendor='Webb Strategy Consulting LLC' AND date='2026-05-08' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l5_rnt, id FROM public.transactions WHERE user_id=v_uid AND vendor='456 Atlantic Ave LLC' AND date='2026-05-01' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l5_ced, id FROM public.transactions WHERE user_id=v_uid AND vendor='Con Edison' AND date='2026-05-06' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l5_net1, id FROM public.transactions WHERE user_id=v_uid AND vendor='Xfinity' AND date='2026-05-07' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l5_tth, id FROM public.transactions WHERE user_id=v_uid AND vendor='Brooklyn Tabernacle' AND date='2026-05-04' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l5_cht, id FROM public.transactions WHERE user_id=v_uid AND vendor='World Vision' AND date='2026-05-25' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l5_swz, id FROM public.transactions WHERE user_id=v_uid AND vendor='Zoom Communications' AND date='2026-05-12' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l5_lnk, id FROM public.transactions WHERE user_id=v_uid AND vendor='LinkedIn Premium' AND date='2026-05-12' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l5_sft, id FROM public.transactions WHERE user_id=v_uid AND vendor IN ('Notion','Google Workspace') AND date='2026-05-13' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l5_cml, id FROM public.transactions WHERE user_id=v_uid AND vendor='Frenchette NYC' AND date='2026-05-15' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l5_trv, id FROM public.transactions WHERE user_id=v_uid AND vendor IN ('Delta Airlines','Westin Copley','Uber') AND date IN ('2026-05-19','2026-05-20') ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l5_sup, id FROM public.transactions WHERE user_id=v_uid AND vendor='Amazon' AND date='2026-05-22' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l5_groc, id FROM public.transactions WHERE user_id=v_uid AND vendor='Whole Foods Market' AND date IN ('2026-05-09','2026-05-18') ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l5_din, id FROM public.transactions WHERE user_id=v_uid AND vendor='Seamless' AND date='2026-05-23' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l5_met, id FROM public.transactions WHERE user_id=v_uid AND vendor='MTA NYC Transit' AND date='2026-05-14' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l5_gym, id FROM public.transactions WHERE user_id=v_uid AND vendor='Equinox' AND date='2026-05-08' ON CONFLICT DO NOTHING;
  INSERT INTO public.budget_line_transactions (user_id, budget_line_id, transaction_id)
  SELECT v_uid, l5_str, id FROM public.transactions WHERE user_id=v_uid AND vendor IN ('Netflix','Spotify') AND date='2026-05-17' ON CONFLICT DO NOTHING;

  -- ════════════════════════════════════════════════════════════════════
  -- NET WORTH SNAPSHOTS (Cash Flow page — monthly end-of-month balances)
  -- ════════════════════════════════════════════════════════════════════
  INSERT INTO public.net_worth_snapshots (user_id, data_source_id, captured_on, balance_cents) VALUES
  -- Chase Checking
  (v_uid, ds_chk, '2025-01-31',  820000),
  (v_uid, ds_chk, '2025-02-28',  940000),
  (v_uid, ds_chk, '2025-03-31', 1010000),
  (v_uid, ds_chk, '2025-04-30', 1080000),
  (v_uid, ds_chk, '2025-05-31', 1420000),
  (v_uid, ds_chk, '2025-06-30', 1380000),
  (v_uid, ds_chk, '2025-07-31', 1290000),
  (v_uid, ds_chk, '2025-08-31', 1590000),
  (v_uid, ds_chk, '2025-09-30', 1520000),
  (v_uid, ds_chk, '2025-10-31', 1440000),
  (v_uid, ds_chk, '2025-11-30', 1680000),
  (v_uid, ds_chk, '2025-12-31', 1530000),
  (v_uid, ds_chk, '2026-01-31', 1820000),
  (v_uid, ds_chk, '2026-02-28', 1690000),
  (v_uid, ds_chk, '2026-03-31', 1980000),
  (v_uid, ds_chk, '2026-04-30', 1840000),
  (v_uid, ds_chk, '2026-05-31', 2150000),
  -- Chase Savings
  (v_uid, ds_sav, '2025-01-31',  2200000),
  (v_uid, ds_sav, '2025-02-28',  2350000),
  (v_uid, ds_sav, '2025-03-31',  2480000),
  (v_uid, ds_sav, '2025-04-30',  2600000),
  (v_uid, ds_sav, '2025-05-31',  2880000),
  (v_uid, ds_sav, '2025-06-30',  3020000),
  (v_uid, ds_sav, '2025-07-31',  3150000),
  (v_uid, ds_sav, '2025-08-31',  3380000),
  (v_uid, ds_sav, '2025-09-30',  3500000),
  (v_uid, ds_sav, '2025-10-31',  3620000),
  (v_uid, ds_sav, '2025-11-30',  3780000),
  (v_uid, ds_sav, '2025-12-31',  3890000),
  (v_uid, ds_sav, '2026-01-31',  4080000),
  (v_uid, ds_sav, '2026-02-28',  4220000),
  (v_uid, ds_sav, '2026-03-31',  4450000),
  (v_uid, ds_sav, '2026-04-30',  4620000),
  (v_uid, ds_sav, '2026-05-31',  4810000),
  -- Sapphire Reserve (credit card liability — negative)
  (v_uid, ds_cc, '2025-01-31',  -310000),
  (v_uid, ds_cc, '2025-02-28',  -280000),
  (v_uid, ds_cc, '2025-03-31',  -320000),
  (v_uid, ds_cc, '2025-04-30',  -295000),
  (v_uid, ds_cc, '2025-05-31',  -410000),
  (v_uid, ds_cc, '2025-06-30',  -275000),
  (v_uid, ds_cc, '2025-07-31',  -388000),
  (v_uid, ds_cc, '2025-08-31',  -302000),
  (v_uid, ds_cc, '2025-09-30',  -356000),
  (v_uid, ds_cc, '2025-10-31',  -492000),
  (v_uid, ds_cc, '2025-11-30',  -318000),
  (v_uid, ds_cc, '2025-12-31',  -425000),
  (v_uid, ds_cc, '2026-01-31',  -295000),
  (v_uid, ds_cc, '2026-02-28',  -468000),
  (v_uid, ds_cc, '2026-03-31',  -310000),
  (v_uid, ds_cc, '2026-04-30',  -388000),
  (v_uid, ds_cc, '2026-05-31',  -312000)
  ON CONFLICT (user_id, data_source_id, captured_on) DO NOTHING;

  -- ════════════════════════════════════════════════════════════════════
  -- DEDUCTIONS SUMMARY (Tax page)
  -- ════════════════════════════════════════════════════════════════════
  IF v_wsid IS NOT NULL THEN
    INSERT INTO public.deductions (user_id, workspace_id, type, tax_year, amount, tax_savings, metadata) VALUES
    (v_uid, v_wsid, 'Software & Subscriptions', 2025, 1143.48, 365.91, '{"description":"Zoom x12, LinkedIn x12, Notion x12, Google Workspace x12, GoDaddy"}'::jsonb),
    (v_uid, v_wsid, 'Business Travel',          2025, 3536.00, 1131.52,'{"description":"Flights and hotels: Chicago, DC, Boston, Miami","trips":5}'::jsonb),
    (v_uid, v_wsid, 'Meals (50%)',              2025,  998.55,  319.54,'{"description":"Client dinners and team lunches at 50% deduction","meals":6}'::jsonb),
    (v_uid, v_wsid, 'Office Supplies',          2025,  558.60,  178.75,'{"description":"Amazon, Staples, Udemy course, misc office items"}'::jsonb),
    (v_uid, v_wsid, 'Professional Services',    2025,  479.88,  153.56,'{"description":"LinkedIn Premium 12 months"}'::jsonb),
    (v_uid, v_wsid, 'Software & Subscriptions', 2026,  465.90,  149.09,'{"description":"Zoom, LinkedIn, Notion, Google Workspace Jan-May 2026"}'::jsonb),
    (v_uid, v_wsid, 'Business Travel',          2026, 2412.00,  771.84,'{"description":"LA, Philadelphia, Boston trips"}'::jsonb),
    (v_uid, v_wsid, 'Meals (50%)',              2026,  687.05,  219.86,'{"description":"Carbone, Frenchette, Don Angie client dinners at 50%"}'::jsonb),
    (v_uid, v_wsid, 'Office Supplies',          2026,  177.48,   56.79,'{"description":"Amazon office supplies Jan-May 2026"}'::jsonb)
    ON CONFLICT DO NOTHING;
  ELSE
    RAISE NOTICE 'Skipped deductions insert (no workspace found)';
  END IF;

  -- ════════════════════════════════════════════════════════════════════
  -- REVIEW ITEMS (Smart Inbox)
  -- ════════════════════════════════════════════════════════════════════
  INSERT INTO public.review_items (user_id, kind, title, body, urgency, payload, done, dismissed) VALUES
  (v_uid, 'rule_suggestion', 'Create a rule for Whole Foods Market',
   'You have 28 Whole Foods Market transactions all marked Personal. A rule would auto-sort these going forward.',
   2, '{"vendor_normalized":"whole foods market","suggested_marker":"Personal","suggested_label":"Groceries","match_count":28}'::jsonb, false, false),

  (v_uid, 'unusual_tx', 'Large charge at The Modern NYC — $680.50',
   'This December dinner is significantly higher than your typical client meal. Confirm it''s correctly categorized as a Business expense.',
   3, '{"transaction_id":null,"vendor":"The Modern NYC","amount":680.50,"date":"2025-12-19"}'::jsonb, false, false),

  (v_uid, 'tax_nudge', 'Q2 estimated tax payment due June 15',
   'Based on your 2026 income and 32% rate, your estimated Q2 payment is ~$8,450. Set aside funds now.',
   3, '{"tax_year":2026,"quarter":"Q2","due_date":"2026-06-15","estimated_amount":8450}'::jsonb, false, false),

  (v_uid, 'rule_suggestion', 'Split Uber rides: business vs personal',
   'You''ve marked 4 Uber charges as Partial (60% business). A rule can apply this split automatically.',
   1, '{"vendor_normalized":"uber","suggested_marker":"Partial","suggested_business_pct":60,"match_count":4}'::jsonb, false, false),

  (v_uid, 'untagged', '6 transactions from late May need review',
   'Verizon, Amazon, Uber, DoorDash, CVS, and a barber charge are still pending triage for May 2026.',
   2, '{"pending_count":6,"month":"2026-05"}'::jsonb, false, false),

  (v_uid, 'tax_nudge', 'Charitable giving on track for $20K+ this year',
   'You''ve given $5,450 to church and charities in 2026 so far. Total 2025 giving was $25,300. Keep tracking for Schedule A.',
   1, '{"ytd_giving_2026":5450,"total_giving_2025":25300}'::jsonb, false, false),

  (v_uid, 'rule_suggestion', 'MTA NYC Transit → always Personal',
   'You have 17 MetroCard purchases all tagged Personal. One click creates a permanent rule.',
   1, '{"vendor_normalized":"mta nyc transit","suggested_marker":"Personal","suggested_label":"MetroCard","match_count":17}'::jsonb, false, false)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Demo seed complete for demo@demo.com (%)', v_uid;
END $$;
