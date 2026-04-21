
-- Roles enum + table for admin gating
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Admins can view roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Funnel audits
CREATE TABLE public.funnel_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  url_submitted TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  overall_score INT,
  audit_json JSONB,
  mockup_html TEXT,
  brand_colors JSONB,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  call_status TEXT NOT NULL DEFAULT 'pending'
);

ALTER TABLE public.funnel_audits ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a new audit (anonymous lead capture)
CREATE POLICY "Anyone can create audits"
ON public.funnel_audits FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Anyone can update their own audit by id (to add lead info). The id acts as a capability token.
CREATE POLICY "Anyone can update audits by id"
ON public.funnel_audits FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Only admins can list all audits
CREATE POLICY "Admins can view all audits"
ON public.funnel_audits FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update call status etc
CREATE POLICY "Admins can update audits"
ON public.funnel_audits FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_funnel_audits_created_at ON public.funnel_audits(created_at DESC);
