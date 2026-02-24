-- Fix avatar upload RLS: relax INSERT policy so uploads succeed.
-- Run this in Supabase Dashboard → SQL Editor if you get
-- "new row violates row-level security policy" when uploading an avatar.

DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;

CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');
