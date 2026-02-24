-- Create the avatars storage bucket and allow authenticated users to upload/delete.
-- If INSERT into storage.buckets fails (e.g. hosted Supabase), create the bucket in
-- Dashboard: Storage → New bucket → name "avatars", Public ON, then run the policies below.
--
-- IMPORTANT: For profile images to load in the browser, the bucket must be PUBLIC.
-- In Dashboard: Storage → avatars → Configuration → set "Public bucket" to ON.

-- Create avatars bucket (public so profile images load without signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to avatars bucket.
-- Path is avatars/<user_id>.<ext>; we only check bucket so RLS accepts the insert.
CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

-- Allow public read (bucket is public; this policy may be required depending on setup)
CREATE POLICY "Public read for avatars"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Allow authenticated users to delete their own avatar (object name is avatars/<user_id>.<ext>)
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name LIKE ('avatars/' || auth.uid()::text || '.%')
  );

-- Allow authenticated users to update (upsert) their own avatar
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name LIKE ('avatars/' || auth.uid()::text || '.%')
  );
