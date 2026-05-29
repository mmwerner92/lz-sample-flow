import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_app/usage")({
  head: () => ({ meta: [{ title: "Inventory Usage — LJ LIMS" }] }),
  component: UsagePage,
});

type Row = {
  id: string;
  used_at: string;
  quantity: number;
  used_by: string | null;
  sample: { sample_number: string; sample_point_id: string } | null;
  method: { name: string } | null;
  inventory_item: { item_name: string } | null;
  user: { full_name: string | null; email: string | null } | null;
};

function UsagePage() {
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["sample_inventory_usage"],
    queryFn: async () => {
      const sb = supabase as any;
      const { data, error } = await sb
        .from("sample_inventory_usage")
        .select("*")
        .order("used_at", { ascending: false });
      if (error) throw error;
      const usage = data as any[];

      const sampleIds = [...new Set(usage.map((r) => r.sample_id).filter(Boolean))];
      const methodIds = [...new Set(usage.map((r) => r.method_id).filter(Boolean))];
      const itemIds = [...new Set(usage.map((r) => r.inventory_item_id).filter(Boolean))];
      const userIds = [...new Set(usage.map((r) => r.used_by).filter(Boolean))];

      const [samples, methods, items, profiles] = await Promise.all([
        sampleIds.length
          ? sb.from("samples").select("id, sample_number, sample_point_id").in("id", sampleIds)
          : Promise.resolve({ data: [] }),
        methodIds.length
          ? sb.from("methods").select("id, name").in("id", methodIds)
          : Promise.resolve({ data: [] }),
        itemIds.length
          ? sb.from("inventory_items").select("id, item_name").in("id", itemIds)
          : Promise.resolve({ data: [] }),
        userIds.length
          ? sb.from("profiles").select("id, full_name, email").in("id", userIds)
          : Promise.resolve({ data: [] }),
      ]);
      const sMap = new Map((samples.data ?? []).map((x: any) => [x.id, x]));
      const mMap = new Map((methods.data ?? []).map((x: any) => [x.id, x]));
      const iMap = new Map((items.data ?? []).map((x: any) => [x.id, x]));
      const uMap = new Map((profiles.data ?? []).map((x: any) => [x.id, x]));

      return usage.map((r) => ({
        id: r.id,
        used_at: r.used_at,
        quantity: r.quantity,
        used_by: r.used_by,
        sample: sMap.get(r.sample_id) ?? null,
        method: mMap.get(r.method_id) ?? null,
        inventory_item: iMap.get(r.inventory_item_id) ?? null,
        user: uMap.get(r.used_by) ?? null,
      })) as Row[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.sample?.sample_number, r.method?.name, r.inventory_item?.item_name, r.user?.full_name, r.user?.email]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    );
  }, [rows, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory Usage</h1>
          <p className="text-sm text-muted-foreground">{rows.length} usage events logged</p>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sample, method, item…"
            className="pl-8 w-72"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[calc(100vh-200px)]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  {["When", "Sample", "Method", "Inventory item", "Quantity", "By"].map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold text-xs uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No usage recorded yet.</td></tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{new Date(r.used_at).toLocaleString()}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium">{r.sample?.sample_number ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.method?.name ?? "—"}</td>
                    <td className="px-3 py-2">{r.inventory_item?.item_name ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono">{r.quantity}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{r.user?.full_name ?? r.user?.email ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
