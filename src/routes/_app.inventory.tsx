import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inventory")({
  head: () => ({ meta: [{ title: "Inventory — LJ LIMS" }] }),
  component: Inventory,
});

type InventoryItem = {
  id: string;
  item_name: string;
  description: string | null;
  vendor: string | null;
  kit_number: string | null;
  item_number: string | null;
  designation: string | null;
  routine: boolean;
  lab_location: string | null;
  warehouse_location: string | null;
  lab_stock: number;
  warehouse_stock: number;
  in_use: number;
  in_use_level: number | null;
  median: number | null;
  min_val: number | null;
  max_val: number | null;
  lot_number: string | null;
  expiry: string | null;
  items_per_pk: number | null;
  cost_per_item: number | null;
  item_reorder_quantity: number | null;
  quantity_last_ordered: number | null;
  date_of_last_order: string | null;
  days_per_reorder: number | null;
  item_discontinued: boolean;
  updated_at: string;
};

const emptyItem: Omit<InventoryItem, "id" | "updated_at"> = {
  item_name: "",
  description: "",
  vendor: "",
  kit_number: "",
  item_number: "",
  designation: "",
  routine: false,
  lab_location: "",
  warehouse_location: "",
  lab_stock: 0,
  warehouse_stock: 0,
  in_use: 0,
  in_use_level: null,
  median: null,
  min_val: null,
  max_val: null,
  lot_number: "",
  expiry: null,
  items_per_pk: null,
  cost_per_item: null,
  item_reorder_quantity: null,
  quantity_last_ordered: null,
  date_of_last_order: null,
  days_per_reorder: null,
  item_discontinued: false,
};

function totalStock(i: Pick<InventoryItem, "lab_stock" | "warehouse_stock" | "in_use">) {
  return Number(i.lab_stock || 0) + Number(i.warehouse_stock || 0) + Number(i.in_use || 0);
}
function needsReorder(i: InventoryItem) {
  if (i.item_discontinued) return false;
  if (i.min_val == null) return false;
  return totalStock(i) <= Number(i.min_val);
}
function totalValue(i: InventoryItem) {
  if (i.cost_per_item == null) return null;
  return totalStock(i) * Number(i.cost_per_item);
}
function fmtDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString();
}
function fmtMoney(v: number | null) {
  if (v == null) return "—";
  return `$${v.toFixed(2)}`;
}
function fmtNum(v: number | null | undefined) {
  if (v == null || v === undefined) return "—";
  return String(v);
}

function Inventory() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [open, setOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory_items"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inventory_items")
        .select("*")
        .order("item_name");
      if (error) throw error;
      return data as InventoryItem[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      [i.item_name, i.description, i.vendor, i.kit_number, i.item_number, i.designation, i.lot_number]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    );
  }, [items, search]);

  function openNew() {
    setEditing({ ...(emptyItem as any), id: "", updated_at: "" });
    setOpen(true);
  }
  function openEdit(item: InventoryItem) {
    setEditing({ ...item });
    setOpen(true);
  }

  async function saveItem() {
    if (!editing) return;
    if (!editing.item_name.trim()) {
      toast.error("Item name is required");
      return;
    }
    const { id, updated_at, ...payload } = editing;
    // Clean empty strings to null for nullable text fields
    const cleaned: any = { ...payload };
    for (const k of Object.keys(cleaned)) {
      if (cleaned[k] === "") cleaned[k] = null;
    }
    if (id) {
      const { error } = await (supabase as any).from("inventory_items").update(cleaned).eq("id", id);
      if (error) { toast.error(error.message); return; }
      toast.success("Item updated");
    } else {
      const { error } = await (supabase as any).from("inventory_items").insert(cleaned);
      if (error) { toast.error(error.message); return; }
      toast.success("Item created");
    }
    setOpen(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["inventory_items"] });
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this inventory item?")) return;
    const { error } = await (supabase as any).from("inventory_items").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Item deleted");
    qc.invalidateQueries({ queryKey: ["inventory_items"] });
  }

  const reorderCount = items.filter(needsReorder).length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory Management</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} items · {reorderCount} need reorder
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items, vendor, lot…"
              className="pl-8 w-72"
            />
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New item</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[calc(100vh-220px)]">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0 z-10">
                <tr className="text-left">
                  {[
                    "Reorder", "Total Stock", "Reorder Qty", "Qty Last Ord.", "Last Order",
                    "Lab", "Wh", "In-Use", "Updated",
                    "Item", "Description", "Vendor", "Kit #", "Item #", "Designation", "Routine",
                    "Lab Loc.", "Wh Loc.", "In-Use Lvl", "Median", "Min", "Max",
                    "Lot #", "Expiry", "Items/Pk", "Cost", "Total Value", "Days/Reorder", "Disc.?", "",
                  ].map((h) => (
                    <th key={h} className="px-2 py-2 whitespace-nowrap font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={30} className="text-center py-12 text-muted-foreground">Loading…</td></tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={30} className="text-center py-12 text-muted-foreground">No items.</td></tr>
                )}
                {filtered.map((i) => {
                  const ts = totalStock(i);
                  const tv = totalValue(i);
                  const reorder = needsReorder(i);
                  return (
                    <tr key={i.id} className="border-t hover:bg-muted/30">
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {reorder
                          ? <Badge variant="destructive">Reorder</Badge>
                          : <span className="text-muted-foreground">OK</span>}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap font-medium">{ts}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{fmtNum(i.item_reorder_quantity)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{fmtNum(i.quantity_last_ordered)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{fmtDate(i.date_of_last_order)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{i.lab_stock}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{i.warehouse_stock}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{i.in_use}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{fmtDate(i.updated_at)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap font-medium">{i.item_name}</td>
                      <td className="px-2 py-1.5 max-w-[240px] truncate" title={i.description ?? ""}>{i.description ?? "—"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{i.vendor ?? "—"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{i.kit_number ?? "—"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{i.item_number ?? "—"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{i.designation ?? "—"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{i.routine ? "Yes" : "No"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{i.lab_location ?? "—"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{i.warehouse_location ?? "—"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{fmtNum(i.in_use_level)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{fmtNum(i.median)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{fmtNum(i.min_val)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{fmtNum(i.max_val)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{i.lot_number ?? "—"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{fmtDate(i.expiry)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{fmtNum(i.items_per_pk)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{fmtMoney(i.cost_per_item)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{fmtMoney(tv)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{fmtNum(i.days_per_reorder)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{i.item_discontinued ? "Yes" : "No"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(i)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteItem(i.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit inventory item" : "New inventory item"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <ItemForm
              value={editing}
              onChange={(patch) => setEditing({ ...editing, ...patch })}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={saveItem}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ItemForm({
  value,
  onChange,
}: {
  value: InventoryItem;
  onChange: (patch: Partial<InventoryItem>) => void;
}) {
  const ts = totalStock(value);
  const tv = totalValue(value);
  const reorder = needsReorder(value);

  const text = (label: string, key: keyof InventoryItem) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        value={(value[key] as any) ?? ""}
        onChange={(e) => onChange({ [key]: e.target.value } as any)}
      />
    </div>
  );
  const num = (label: string, key: keyof InventoryItem) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        inputMode="decimal"
        value={(value[key] as any) ?? ""}
        onChange={(e) => onChange({ [key]: e.target.value === "" ? null : Number(e.target.value) } as any)}
      />
    </div>
  );
  const date = (label: string, key: keyof InventoryItem) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="date"
        value={(value[key] as any) ?? ""}
        onChange={(e) => onChange({ [key]: e.target.value || null } as any)}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {text("Item name *", "item_name")}
        {text("Vendor", "vendor")}
        {text("Designation", "designation")}
        <div className="sm:col-span-2 md:col-span-3">{text("Description", "description")}</div>
        {text("Kit number", "kit_number")}
        {text("Item number", "item_number")}
        {text("Lot #", "lot_number")}
        {text("Lab location", "lab_location")}
        {text("Warehouse location", "warehouse_location")}
        <div className="flex items-end gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={value.routine}
              onCheckedChange={(c) => onChange({ routine: !!c })}
            />
            Routine
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={value.item_discontinued}
              onCheckedChange={(c) => onChange({ item_discontinued: !!c })}
            />
            Discontinued
          </label>
        </div>
      </section>

      <section>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Stock</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {num("Lab stock", "lab_stock")}
          {num("Warehouse stock", "warehouse_stock")}
          {num("In-use", "in_use")}
          <div className="space-y-1">
            <Label className="text-xs">Total stock</Label>
            <Input value={ts} disabled className="font-mono" />
          </div>
          {num("In-use level", "in_use_level")}
          {num("Median", "median")}
          {num("Min", "min_val")}
          {num("Max", "max_val")}
        </div>
        {reorder && (
          <div className="mt-2"><Badge variant="destructive">Reorder needed</Badge></div>
        )}
      </section>

      <section>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Reorder & cost</div>
        <div className="grid grid-cols-4 gap-3">
          {num("Item reorder qty", "item_reorder_quantity")}
          {num("Qty last ordered", "quantity_last_ordered")}
          {date("Date of last order", "date_of_last_order")}
          {num("Days per reorder", "days_per_reorder")}
          {num("Items / pack", "items_per_pk")}
          {num("Cost per item", "cost_per_item")}
          <div className="space-y-1">
            <Label className="text-xs">Total value (actual)</Label>
            <Input value={tv == null ? "" : fmtMoney(tv)} disabled className="font-mono" />
          </div>
          {date("Expiry", "expiry")}
        </div>
      </section>
    </div>
  );
}
