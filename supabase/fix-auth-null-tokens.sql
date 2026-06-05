-- Fix: "Database error querying schema" on login.
--
-- Cause: rows were inserted directly into auth.users (e.g. by an early version
-- of create-demo-user.sql) with NULL token columns. Supabase Auth (GoTrue)
-- scans these columns into non-nullable Go strings, so a NULL value makes the
-- login query fail with "converting NULL to string is unsupported", surfaced
-- to the client as "Database error querying schema".
--
-- This script rewrites any NULL token values to '' (empty string), which is
-- what GoTrue expects. Safe to run multiple times; only touches NULL rows.
--
-- Run in the Supabase SQL Editor (Dashboard -> SQL Editor) with a privileged
-- role (postgres / service role).

UPDATE auth.users
SET
  confirmation_token         = COALESCE(confirmation_token, ''),
  recovery_token             = COALESCE(recovery_token, ''),
  email_change               = COALESCE(email_change, ''),
  email_change_token_new     = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change               = COALESCE(phone_change, ''),
  phone_change_token         = COALESCE(phone_change_token, ''),
  reauthentication_token     = COALESCE(reauthentication_token, '')
WHERE
  confirmation_token IS NULL
  OR recovery_token IS NULL
  OR email_change IS NULL
  OR email_change_token_new IS NULL
  OR email_change_token_current IS NULL
  OR phone_change IS NULL
  OR phone_change_token IS NULL
  OR reauthentication_token IS NULL;
