ALTER TABLE public.method_fields
  ADD COLUMN IF NOT EXISTS is_calculated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS formula text;