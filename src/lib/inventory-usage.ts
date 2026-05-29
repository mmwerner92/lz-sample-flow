import { supabase } from "@/integrations/supabase/client";

// Idempotently log inventory usage for a (sample, method) pair and deduct
// from inventory lab_stock the first time it runs. Safe to call on every save.
export async function applyMethodInventoryUsage(
  sampleId: string,
  methodId: string,
  userId: string | null,
) {
  const sb = supabase as any;

  // If usage already logged for this sample+method, skip (idempotent).
  const { data: existing, error: exErr } = await sb
    .from("sample_inventory_usage")
    .select("id")
    .eq("sample_id", sampleId)
    .eq("method_id", methodId)
    .limit(1);
  if (exErr) throw new Error(exErr.message);
  if (existing && existing.length > 0) return;

  // Fetch method inventory configuration.
  const { data: cfg, error: cfgErr } = await sb
    .from("method_inventory_items")
    .select("inventory_item_id, quantity_per_sample")
    .eq("method_id", methodId);
  if (cfgErr) throw new Error(cfgErr.message);
  if (!cfg || cfg.length === 0) return;

  const usageRows = cfg
    .filter((r: any) => Number(r.quantity_per_sample) > 0)
    .map((r: any) => ({
      sample_id: sampleId,
      method_id: methodId,
      inventory_item_id: r.inventory_item_id,
      quantity: Number(r.quantity_per_sample),
      used_by: userId,
    }));
  if (usageRows.length === 0) return;

  const { error: insErr } = await sb
    .from("sample_inventory_usage")
    .insert(usageRows);
  if (insErr) throw new Error(insErr.message);

  // Decrement lab_stock for each consumed item.
  for (const row of usageRows) {
    const { data: item, error: itErr } = await sb
      .from("inventory_items")
      .select("lab_stock")
      .eq("id", row.inventory_item_id)
      .single();
    if (itErr) continue;
    const newStock = Math.max(0, Number(item.lab_stock || 0) - Number(row.quantity));
    await sb.from("inventory_items").update({ lab_stock: newStock }).eq("id", row.inventory_item_id);
  }
}
