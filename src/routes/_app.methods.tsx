import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Save, Calculator, Package, ChevronUp, ChevronDown, Pencil, EyeOff } from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/_app/methods")({
  head: () => ({ meta: [{ title: "Methods — LJ LIMS" }] }),
  component: Methods,
});

type Method = { id: string; name: string };
type MethodField = { id: string; method_id: string; description: string; unit: string | null; min_val: number | null; max_val: number | null; position: number; is_calculated: boolean; formula: string | null; pi_point: string | null; hidden: boolean };

function Methods() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newMethodName, setNewMethodName] = useState("");

  const { data: methods = [] } = useQuery({
    queryKey: ["methods"],
    queryFn: async () => {
      const { data, error } = await supabase.from("methods").select("*").order("name");
      if (error) throw error;
      return data as Method[];
    },
  });

  const { data: fields = [], refetch } = useQuery({
    queryKey: ["method_fields", selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const { data, error } = await supabase.from("method_fields").select("*").eq("method_id", selectedId).order("position");
      if (error) throw error;
      return data as MethodField[];
    },
    enabled: !!selectedId,
  });

  const [draftFields, setDraftFields] = useState<MethodField[]>([]);
  const baseFields = fields;
  const workingFields = draftFields.length ? draftFields : baseFields;

  function loadDraft() {
    setDraftFields(baseFields.map((f) => ({ ...f })));
  }

  async function createMethod() {
    if (!newMethodName.trim()) return;
    const { data, error } = await supabase.from("methods").insert({ name: newMethodName.trim() }).select("id").single();
    if (error) { toast.error(error.message); return; }
    setNewMethodName("");
    qc.invalidateQueries({ queryKey: ["methods"] });
    setSelectedId(data.id);
    setDraftFields([]);
  }

  async function deleteMethod() {
    if (!selectedId) return;
    if (!confirm("Delete this method and all its fields?")) return;
    const { error } = await supabase.from("methods").delete().eq("id", selectedId);
    if (error) { toast.error(error.message); return; }
    setSelectedId(null);
    setDraftFields([]);
    qc.invalidateQueries({ queryKey: ["methods"] });
  }

  function addField(calculated = false) {
    if (!selectedId) return;
    const list = draftFields.length ? draftFields : baseFields.map((f) => ({ ...f }));
    setDraftFields([
      ...list,
      { id: `new-${Date.now()}`, method_id: selectedId, description: "", unit: "", min_val: null, max_val: null, position: list.length, is_calculated: calculated, formula: calculated ? "" : null, pi_point: null },
    ]);
  }

  function updateField(id: string, patch: Partial<MethodField>) {
    const list = draftFields.length ? draftFields : baseFields.map((f) => ({ ...f }));
    setDraftFields(list.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function removeField(id: string) {
    const list = draftFields.length ? draftFields : baseFields.map((f) => ({ ...f }));
    setDraftFields(list.filter((f) => f.id !== id));
  }

  function moveField(id: string, dir: -1 | 1) {
    const list = (draftFields.length ? draftFields : baseFields.map((f) => ({ ...f }))).slice();
    const idx = list.findIndex((f) => f.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= list.length) return;
    [list[idx], list[target]] = [list[target], list[idx]];
    setDraftFields(list);
  }


  async function saveFields() {
    if (!selectedId) return;
    const list = draftFields.length ? draftFields : baseFields;
    // Delete removed
    const existingIds = new Set(baseFields.map((f) => f.id));
    const keptIds = new Set(list.filter((f) => !f.id.startsWith("new-")).map((f) => f.id));
    const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
    if (toDelete.length) {
      const { error } = await supabase.from("method_fields").delete().in("id", toDelete);
      if (error) { toast.error(error.message); return; }
    }
    // Upsert
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const payload = {
        method_id: selectedId,
        description: f.description,
        unit: f.unit || null,
        min_val: f.min_val === null || f.min_val === undefined || (f.min_val as any) === "" ? null : Number(f.min_val),
        max_val: f.max_val === null || f.max_val === undefined || (f.max_val as any) === "" ? null : Number(f.max_val),
        position: i,
        is_calculated: f.is_calculated,
        formula: f.is_calculated ? (f.formula ?? "") : null,
        pi_point: f.pi_point && f.pi_point.trim() !== "" ? f.pi_point.trim() : null,
      };
      if (f.id.startsWith("new-")) {
        const { error } = await supabase.from("method_fields").insert(payload);
        if (error) { toast.error(error.message); return; }
      } else {
        const { error } = await supabase.from("method_fields").update(payload).eq("id", f.id);
        if (error) { toast.error(error.message); return; }
      }
    }
    toast.success("Method saved");
    setDraftFields([]);
    refetch();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Method Management</h1>
        <p className="text-sm text-muted-foreground">Define analytical methods and the fields captured per sample.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Methods</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              {methods.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setSelectedId(m.id); setDraftFields([]); }}
                  className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors ${
                    selectedId === m.id ? "bg-secondary text-secondary-foreground font-medium" : "hover:bg-muted"
                  }`}
                >
                  {m.name}
                </button>
              ))}
              {methods.length === 0 && <p className="text-sm text-muted-foreground px-3">No methods yet.</p>}
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <Input placeholder="New method name" value={newMethodName} onChange={(e) => setNewMethodName(e.target.value)} />
              <Button size="icon" onClick={createMethod}><Plus className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedId ? methods.find((m) => m.id === selectedId)?.name : "Select a method"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedId && <p className="text-sm text-muted-foreground">Pick a method on the left or create a new one to manage its fields.</p>}
            {selectedId && (
              <Tabs defaultValue="fields">
                <div className="flex items-center justify-between mb-4">
                  <TabsList>
                    <TabsTrigger value="fields">Fields</TabsTrigger>
                    <TabsTrigger value="inventory">Inventory</TabsTrigger>
                  </TabsList>
                  <Button variant="ghost" size="sm" onClick={deleteMethod} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />Delete method
                  </Button>
                </div>

                <TabsContent value="fields" className="space-y-4">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => addField(false)}><Plus className="h-4 w-4 mr-2" />Add field</Button>
                    <Button size="sm" variant="outline" onClick={() => addField(true)}><Calculator className="h-4 w-4 mr-2" />Add calculated field</Button>
                    <Button size="sm" onClick={saveFields}><Save className="h-4 w-4 mr-2" />Save</Button>
                  </div>
                  {workingFields.length === 0 && (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                      No fields yet. <button className="underline" onClick={() => { loadDraft(); addField(false); }}>Add the first one</button>.
                    </div>
                  )}
                  {workingFields.length > 0 && (
                    <div className="overflow-x-auto -mx-2">
                      <div className="space-y-2 min-w-[600px] px-2">
                        <div className="grid grid-cols-[32px_1fr_120px_140px_100px_100px_40px] gap-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          <div></div><div>Description</div><div>Unit</div><div>PI Point</div><div>Min</div><div>Max</div><div></div>
                        </div>
                        {workingFields.map((f, i) => (
                          <div key={f.id} className="space-y-1">
                            <div className="grid grid-cols-[32px_1fr_120px_140px_100px_100px_40px] gap-2 items-center">
                              <div className="flex flex-col">
                                <button type="button" onClick={() => moveField(f.id, -1)} disabled={i === 0} className="h-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground" aria-label="Move up">
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </button>
                                <button type="button" onClick={() => moveField(f.id, 1)} disabled={i === workingFields.length - 1} className="h-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground" aria-label="Move down">
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                {f.is_calculated && <Calculator className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                <Input value={f.description} onChange={(e) => updateField(f.id, { description: e.target.value })} placeholder={f.is_calculated ? "e.g. Average" : "e.g. Acid number"} />
                              </div>
                              <Input value={f.unit ?? ""} onChange={(e) => updateField(f.id, { unit: e.target.value })} placeholder="mg KOH/g" />
                              <Input className="font-mono text-xs" value={f.pi_point ?? ""} onChange={(e) => updateField(f.id, { pi_point: e.target.value })} placeholder="PI tag" />
                              <Input className="font-mono" value={f.min_val ?? ""} onChange={(e) => updateField(f.id, { min_val: e.target.value === "" ? null : (e.target.value as any) })} inputMode="decimal" placeholder="0.0" />
                              <Input className="font-mono" value={f.max_val ?? ""} onChange={(e) => updateField(f.id, { max_val: e.target.value === "" ? null : (e.target.value as any) })} inputMode="decimal" placeholder="0.0" />
                              <Button variant="ghost" size="icon" onClick={() => removeField(f.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                            </div>
                            {f.is_calculated && (
                              <div className="grid grid-cols-[32px_1fr_40px] gap-2 pl-0">
                                <div />
                                <Input
                                  className="font-mono text-xs"
                                  value={f.formula ?? ""}
                                  onChange={(e) => updateField(f.id, { formula: e.target.value })}
                                  placeholder="Formula, e.g. ({Acid number} + {Base number}) / 2"
                                />
                                <div />
                              </div>
                            )}
                          </div>
                        ))}

                      </div>
                    </div>
                  )}
                  <div className="mt-4 space-y-1">
                    <Label className="text-xs text-muted-foreground block">
                      Tip: leave Min/Max blank to skip range warnings on sample entry.
                    </Label>
                    <Label className="text-xs text-muted-foreground block">
                      Calculated fields reference other fields by description in braces, e.g. <code className="font-mono">{`{Acid number} * 0.5`}</code>. Supported: + − × ÷, parentheses, and min/max/abs/sqrt/pow/round.
                    </Label>
                  </div>
                </TabsContent>

                <TabsContent value="inventory">
                  <MethodInventoryEditor methodId={selectedId} />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type InventoryOpt = { id: string; item_name: string; lab_stock: number };
type MII = { id: string; method_id: string; inventory_item_id: string; quantity_per_sample: number };

function MethodInventoryEditor({ methodId }: { methodId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<MII[]>([]);

  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory_options"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("inventory_items")
        .select("id, item_name, lab_stock")
        .order("item_name");
      if (error) throw error;
      return data as InventoryOpt[];
    },
  });

  const { data: existing = [] } = useQuery({
    queryKey: ["method_inventory_items", methodId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("method_inventory_items")
        .select("*")
        .eq("method_id", methodId);
      if (error) throw error;
      return data as MII[];
    },
  });

  useEffect(() => { setDraft(existing.map((r) => ({ ...r }))); }, [existing]);

  function addRow() {
    setDraft((d) => [
      ...d,
      { id: `new-${Date.now()}-${d.length}`, method_id: methodId, inventory_item_id: "", quantity_per_sample: 0 },
    ]);
  }
  function update(id: string, patch: Partial<MII>) {
    setDraft((d) => d.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function remove(id: string) {
    setDraft((d) => d.filter((r) => r.id !== id));
  }

  async function save() {
    const existingIds = new Set(existing.map((r) => r.id));
    const keptIds = new Set(draft.filter((r) => !r.id.startsWith("new-")).map((r) => r.id));
    const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
    if (toDelete.length) {
      const { error } = await (supabase as any).from("method_inventory_items").delete().in("id", toDelete);
      if (error) { toast.error(error.message); return; }
    }
    for (const r of draft) {
      if (!r.inventory_item_id) continue;
      const payload = {
        method_id: methodId,
        inventory_item_id: r.inventory_item_id,
        quantity_per_sample: Number(r.quantity_per_sample) || 0,
      };
      if (r.id.startsWith("new-")) {
        const { error } = await (supabase as any).from("method_inventory_items").insert(payload);
        if (error) { toast.error(error.message); return; }
      } else {
        const { error } = await (supabase as any).from("method_inventory_items").update(payload).eq("id", r.id);
        if (error) { toast.error(error.message); return; }
      }
    }
    toast.success("Inventory configuration saved");
    qc.invalidateQueries({ queryKey: ["method_inventory_items", methodId] });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start gap-4">
        <p className="text-sm text-muted-foreground">
          Pair inventory items with the quantity consumed each time this method is run on a sample.
          Stock is deducted from <strong>Lab Stock</strong> when the sample is first saved with this method.
        </p>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={addRow}><Plus className="h-4 w-4 mr-2" />Add item</Button>
          <Button size="sm" onClick={save}><Save className="h-4 w-4 mr-2" />Save</Button>
        </div>
      </div>

      {draft.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
          No inventory items configured for this method.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="space-y-2 min-w-[520px]">
            <div className="grid grid-cols-[1fr_160px_120px_40px] gap-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <div>Inventory item</div><div>Qty / sample</div><div>Lab stock</div><div></div>
            </div>
            {draft.map((r) => {
              const item = inventory.find((i) => i.id === r.inventory_item_id);
              return (
                <div key={r.id} className="grid grid-cols-[1fr_160px_120px_40px] gap-2 items-center">
                  <Select value={r.inventory_item_id} onValueChange={(v) => update(r.id, { inventory_item_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select inventory item" /></SelectTrigger>
                    <SelectContent>
                      {inventory.map((i) => (
                        <SelectItem key={i.id} value={i.id}>{i.item_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="font-mono"
                    inputMode="decimal"
                    value={r.quantity_per_sample}
                    onChange={(e) => update(r.id, { quantity_per_sample: e.target.value === "" ? 0 : Number(e.target.value) })}
                  />
                  <div className="text-sm text-muted-foreground font-mono px-2">{item ? item.lab_stock : "—"}</div>
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
