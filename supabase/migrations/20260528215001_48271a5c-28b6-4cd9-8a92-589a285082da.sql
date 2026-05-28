CREATE INDEX IF NOT EXISTS samples_updated_at_idx ON public.samples (updated_at);
CREATE INDEX IF NOT EXISTS sample_readings_updated_at_idx ON public.sample_readings (updated_at);
