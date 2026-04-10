-- Brand color per account (matches /brand palette keys); editable, always set (not nullable).
ALTER TABLE public.data_sources
  ADD COLUMN IF NOT EXISTS brand_color_id TEXT NOT NULL DEFAULT 'blue';

ALTER TABLE public.data_sources DROP CONSTRAINT IF EXISTS data_sources_brand_color_id_check;
ALTER TABLE public.data_sources ADD CONSTRAINT data_sources_brand_color_id_check CHECK (
  brand_color_id IN (
    'black', 'white', 'blue', 'purple', 'pink', 'red', 'orange', 'yellow', 'green', 'grey'
  )
);

-- Transaction property type: account (system-backed via transactions.data_source_id).
ALTER TABLE public.transaction_property_definitions
  DROP CONSTRAINT IF EXISTS transaction_property_definitions_type_check;

ALTER TABLE public.transaction_property_definitions
  ADD CONSTRAINT transaction_property_definitions_type_check CHECK (type IN (
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
    'last_edited_time',
    'account'
  ));
