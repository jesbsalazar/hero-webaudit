ALTER TABLE public.funnel_audits
  ADD COLUMN IF NOT EXISTS clickfunnels_funnel_id text,
  ADD COLUMN IF NOT EXISTS clickfunnels_page_url text,
  ADD COLUMN IF NOT EXISTS clickfunnels_replicated_at timestamptz,
  ADD COLUMN IF NOT EXISTS clickfunnels_replicate_error text;