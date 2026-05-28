
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles read all authed" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Sample points
CREATE TABLE public.sample_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sample_points TO authenticated;
GRANT ALL ON public.sample_points TO service_role;
ALTER TABLE public.sample_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sp all authed" ON public.sample_points FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Methods
CREATE TABLE public.methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.methods TO authenticated;
GRANT ALL ON public.methods TO service_role;
ALTER TABLE public.methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "methods all authed" ON public.methods FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Method fields
CREATE TABLE public.method_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method_id UUID NOT NULL REFERENCES public.methods(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  unit TEXT,
  min_val NUMERIC,
  max_val NUMERIC,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.method_fields(method_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.method_fields TO authenticated;
GRANT ALL ON public.method_fields TO service_role;
ALTER TABLE public.method_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mf all authed" ON public.method_fields FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Samples
CREATE TABLE public.samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_point_id UUID NOT NULL REFERENCES public.sample_points(id) ON DELETE RESTRICT,
  sample_number TEXT NOT NULL,
  analyst_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sampled_at TIMESTAMPTZ,
  color TEXT,
  oil_visibility TEXT,
  particulates TEXT,
  date_analyzed DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sample_point_id, sample_number)
);
CREATE TRIGGER samples_updated_at BEFORE UPDATE ON public.samples
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.samples TO authenticated;
GRANT ALL ON public.samples TO service_role;
ALTER TABLE public.samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "samples all authed" ON public.samples FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Sample method readings: value for a method field on a sample
CREATE TABLE public.sample_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id UUID NOT NULL REFERENCES public.samples(id) ON DELETE CASCADE,
  method_field_id UUID NOT NULL REFERENCES public.method_fields(id) ON DELETE CASCADE,
  value NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sample_id, method_field_id)
);
CREATE INDEX ON public.sample_readings(sample_id);
CREATE TRIGGER sr_updated_at BEFORE UPDATE ON public.sample_readings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sample_readings TO authenticated;
GRANT ALL ON public.sample_readings TO service_role;
ALTER TABLE public.sample_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sr all authed" ON public.sample_readings FOR ALL TO authenticated USING (true) WITH CHECK (true);
