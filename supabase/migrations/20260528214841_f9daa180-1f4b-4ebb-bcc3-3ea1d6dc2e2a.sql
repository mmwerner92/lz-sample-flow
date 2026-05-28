-- 1. Read-only role for Microsoft Fabric
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fabric_reader') THEN
    CREATE ROLE fabric_reader LOGIN PASSWORD 'TenTwelve1012!';
  ELSE
    ALTER ROLE fabric_reader WITH LOGIN PASSWORD 'TenTwelve1012!';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO fabric_reader;

GRANT SELECT ON
  public.samples,
  public.sample_readings,
  public.sample_points,
  public.methods,
  public.method_fields,
  public.profiles
TO fabric_reader;

-- Future tables created in public will not auto-grant; re-run a GRANT if you add tables you want Fabric to read.

-- 2. updated_at triggers
DROP TRIGGER IF EXISTS samples_set_updated_at ON public.samples;
CREATE TRIGGER samples_set_updated_at
BEFORE UPDATE ON public.samples
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS sample_readings_set_updated_at ON public.sample_readings;
CREATE TRIGGER sample_readings_set_updated_at
BEFORE UPDATE ON public.sample_readings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
