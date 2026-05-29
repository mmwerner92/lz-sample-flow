CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  description text,
  vendor text,
  kit_number text,
  item_number text,
  designation text,
  routine boolean NOT NULL DEFAULT false,
  lab_location text,
  warehouse_location text,
  lab_stock numeric NOT NULL DEFAULT 0,
  warehouse_stock numeric NOT NULL DEFAULT 0,
  in_use numeric NOT NULL DEFAULT 0,
  in_use_level numeric,
  median numeric,
  min_val numeric,
  max_val numeric,
  lot_number text,
  expiry date,
  items_per_pk numeric,
  cost_per_item numeric,
  item_reorder_quantity numeric,
  quantity_last_ordered numeric,
  date_of_last_order date,
  days_per_reorder numeric,
  item_discontinued boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv all authed" ON public.inventory_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER inv_set_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();