import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Save, Calculator } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/methods")({
  head: () => ({ meta: [{ title: "Methods — LJ LIMS" }] }),
  component: Methods,
});

type Method = { id: string; name: string };
type MethodField = { id: string; method_id: string; description: string; unit: string | null; min_val: number | null; max_val: number | null; position: number; is_calculated: boolean; formula: string | null };

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
  const workingFields = draftFields.length || selectedId !== (draftFields[0]?.method_id ?? null) ? draftFields : baseFields;

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
      { id: `new-${Date.now()}`, method_id: selectedId, description: "", unit: "", min_val: null, max_val: null, position: list.length, is_calculated: calculated, formula: calculated ? "" : null },
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
        min_val: f.min_val,
        max_val: f.max_val,
        position: i,
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {selectedId ? `Fields — ${methods.find((m) => m.id === selectedId)?.name}` : "Select a method"}
            </CardTitle>
            {selectedId && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={deleteMethod} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />Delete method
                </Button>
                <Button size="sm" variant="outline" onClick={() => addField(false)}><Plus className="h-4 w-4 mr-2" />Add field</Button>
                <Button size="sm" variant="outline" onClick={() => addField(true)}><Calculator className="h-4 w-4 mr-2" />Add calculated field</Button>
                <Button size="sm" onClick={saveFields}><Save className="h-4 w-4 mr-2" />Save</Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!selectedId && <p className="text-sm text-muted-foreground">Pick a method on the left or create a new one to manage its fields.</p>}
            {selectedId && workingFields.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No fields yet. <button className="underline" onClick={() => { loadDraft(); addField(false); }}>Add the first one</button>.
              </div>
            )}
            {selectedId && workingFields.length > 0 && (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_120px_100px_100px_40px] gap-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <div>Description</div><div>Unit</div><div>Min</div><div>Max</div><div></div>
                </div>
                {workingFields.map((f) => (
                  <div key={f.id} className="space-y-1">
                    <div className="grid grid-cols-[1fr_120px_100px_100px_40px] gap-2 items-center">
                      <div className="flex items-center gap-2">
                        {f.is_calculated && <Calculator className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        <Input value={f.description} onChange={(e) => updateField(f.id, { description: e.target.value })} placeholder={f.is_calculated ? "e.g. Average" : "e.g. Acid number"} />
                      </div>
                      <Input value={f.unit ?? ""} onChange={(e) => updateField(f.id, { unit: e.target.value })} placeholder="mg KOH/g" />
                      <Input className="font-mono" value={f.min_val ?? ""} onChange={(e) => updateField(f.id, { min_val: e.target.value === "" ? null : Number(e.target.value) })} inputMode="decimal" />
                      <Input className="font-mono" value={f.max_val ?? ""} onChange={(e) => updateField(f.id, { max_val: e.target.value === "" ? null : Number(e.target.value) })} inputMode="decimal" />
                      <Button variant="ghost" size="icon" onClick={() => removeField(f.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                    </div>
                    {f.is_calculated && (
                      <div className="grid grid-cols-[1fr_40px] gap-2 pl-6">
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
            )}
            {selectedId && (
              <div className="mt-4 space-y-1">
                <Label className="text-xs text-muted-foreground block">
                  Tip: leave Min/Max blank to skip range warnings on sample entry.
                </Label>
                <Label className="text-xs text-muted-foreground block">
                  Calculated fields reference other fields by description in braces, e.g. <code className="font-mono">{`{Acid number} * 0.5`}</code>. Supported: + − × ÷, parentheses, and min/max/abs/sqrt/pow/round.
                </Label>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
