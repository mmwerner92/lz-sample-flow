CREATE TABLE public.saved_analytics_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_analytics_views TO authenticated;
GRANT ALL ON public.saved_analytics_views TO service_role;

ALTER TABLE public.saved_analytics_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own analytics views"
ON public.saved_analytics_views FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "users insert own analytics views"
ON public.saved_analytics_views FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own analytics views"
ON public.saved_analytics_views FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "users delete own analytics views"
ON public.saved_analytics_views FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER saved_analytics_views_set_updated_at
BEFORE UPDATE ON public.saved_analytics_views
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();