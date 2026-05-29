CREATE TABLE public.method_inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method_id uuid NOT NULL,
  inventory_item_id uuid NOT NULL,
  quantity_per_sample numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (method_id, inventory_item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.method_inventory_items TO authenticated;
GRANT ALL ON public.method_inventory_items TO service_role;

ALTER TABLE public.method_inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mii all authed" ON public.method_inventory_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.sample_inventory_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id uuid NOT NULL,
  method_id uuid NOT NULL,
  inventory_item_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  used_by uuid,
  used_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sample_id, method_id, inventory_item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sample_inventory_usage TO authenticated;
GRANT ALL ON public.sample_inventory_usage TO service_role;

ALTER TABLE public.sample_inventory_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "siu all authed" ON public.sample_inventory_usage
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX siu_sample_idx ON public.sample_inventory_usage (sample_id);
CREATE INDEX siu_method_idx ON public.sample_inventory_usage (method_id);
CREATE INDEX siu_item_idx ON public.sample_inventory_usage (inventory_item_id);