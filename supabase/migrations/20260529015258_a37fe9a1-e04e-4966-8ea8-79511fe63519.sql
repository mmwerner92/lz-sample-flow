-- Add status to samples
ALTER TABLE public.samples ADD COLUMN IF NOT EXISTS status text;

-- Sample schedules
CREATE TABLE IF NOT EXISTS public.sample_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_point_id uuid NOT NULL,
  time_of_day time NOT NULL,
  frequency text NOT NULL,
  status text NOT NULL,
  next_trigger_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sample_schedules TO authenticated;
GRANT ALL ON public.sample_schedules TO service_role;

ALTER TABLE public.sample_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ss all authed" ON public.sample_schedules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER set_updated_at_sample_schedules
  BEFORE UPDATE ON public.sample_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();