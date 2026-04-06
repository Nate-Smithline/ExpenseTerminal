-- Org-wide transaction property definitions + per-row custom_fields JSONB.
-- System types (created_*, last_edited_*) do not store values in custom_fields.

CREATE TABLE IF NOT EXISTS public.transaction_property_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transaction_property_definitions_type_check CHECK (type IN (
    'multi_select',
    'select',
    'date',
    'short_text',
    'long_text',
    'checkbox',
    'org_user',
    'number',
    'files',
    'phone',
    'email',
    'created_time',
    'created_by',
    'last_edited_date',
    'last_edited_time'
  ))
);

CREATE INDEX IF NOT EXISTS idx_transaction_property_definitions_org
  ON public.transaction_property_definitions(org_id, position);

ALTER TABLE public.transaction_property_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view transaction property definitions"
  ON public.transaction_property_definitions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = transaction_property_definitions.org_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Org members can insert transaction property definitions"
  ON public.transaction_property_definitions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = transaction_property_definitions.org_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Org members can update transaction property definitions"
  ON public.transaction_property_definitions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = transaction_property_definitions.org_id AND m.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = transaction_property_definitions.org_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Org members can delete transaction property definitions"
  ON public.transaction_property_definitions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.org_id = transaction_property_definitions.org_id AND m.user_id = auth.uid()
  ));

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Private bucket for transaction attachments; path = {user_id}/{transaction_id}/{filename}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'transaction-files',
  'transaction-files',
  false,
  52428800,
  NULL
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload transaction files under own prefix" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own transaction files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own transaction files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own transaction files" ON storage.objects;

CREATE POLICY "Users can upload transaction files under own prefix"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'transaction-files'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "Users can read own transaction files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'transaction-files'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "Users can update own transaction files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'transaction-files'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "Users can delete own transaction files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'transaction-files'
    AND split_part(name, '/', 1) = auth.uid()::text
  );
