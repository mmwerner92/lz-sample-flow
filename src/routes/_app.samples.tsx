import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Plus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { evalFormula } from "@/lib/formula";

export const Route = createFileRoute("/_app/samples")({
  head: () => ({ meta: [{ title: "Sample Entry — LJ LIMS" }] }),
  component: SampleEntry,
});

type SamplePoint = { id: string; name: string };
type Method = { id: string; name: string };
type MethodField = { id: string; method_id: string; description: string; unit: string | null; min_val: number | null; max_val: number | null; position: number; is_calculated: boolean; formula: string | null };
type SampleRow = {
  id: string;
  sample_point_id: string;
  sample_number: string;
  analyst_id: string | null;
  sampled_at: string | null;
  color: string | null;
  oil_visibility: string | null;
  particulates: string | null;
  date_analyzed: string | null;
};

function genSampleNumber() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function SampleEntry() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const { data: samplePoints = [] } = useQuery({
    queryKey: ["sample_points"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sample_points").select("*").order("name");
      if (error) throw error;
      return data as SamplePoint[];
    },
  });

  const { data: methods = [] } = useQuery({
    queryKey: ["methods"],
    queryFn: async () => {
      const { data, error } = await supabase.from("methods").select("*").order("name");
      if (error) throw error;
      return data as Method[];
    },
  });

  const [samplePointId, setSamplePointId] = useState<string>("");
  const [sampleNumber, setSampleNumber] = useState<string>(genSampleNumber());
  const [sampledAt, setSampledAt] = useState("");
  const [color, setColor] = useState("");
  const [oilVisibility, setOilVisibility] = useState("");
  const [particulates, setParticulates] = useState("");
  const [dateAnalyzed, setDateAnalyzed] = useState("");
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const [readings, setReadings] = useState<Record<string, string>>({});
  const [searchPoint, setSearchPoint] = useState<string>("");
  const [searchNumber, setSearchNumber] = useState("");
  const [newPointName, setNewPointName] = useState("");

  const { data: methodFields = [] } = useQuery({
    queryKey: ["method_fields", selectedMethodId],
    queryFn: async () => {
      if (!selectedMethodId) return [];
      const { data, error } = await supabase.from("method_fields").select("*").eq("method_id", selectedMethodId).order("position");
      if (error) throw error;
      return data as MethodField[];
    },
    enabled: !!selectedMethodId,
  });

  const { data: searchSampleNumbers = [] } = useQuery({
    queryKey: ["sample_numbers_for_point", searchPoint],
    queryFn: async () => {
      if (!searchPoint) return [];
      const { data, error } = await supabase
        .from("samples")
        .select("sample_number")
        .eq("sample_point_id", searchPoint)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: { sample_number: string }) => r.sample_number);
    },
    enabled: !!searchPoint,
  });

  // Load existing readings for active sample + method
  useEffect(() => {
    (async () => {
      if (!activeSampleId || !methodFields.length) return;
      const { data } = await supabase
        .from("sample_readings")
        .select("method_field_id, value")
        .eq("sample_id", activeSampleId)
        .in("method_field_id", methodFields.map((f) => f.id));
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: { method_field_id: string; value: number | null }) => {
        map[r.method_field_id] = r.value == null ? "" : String(r.value);
      });
      setReadings((prev) => ({ ...prev, ...map }));
    })();
  }, [activeSampleId, methodFields]);

  const resetForm = () => {
    setActiveSampleId(null);
    setSampleNumber(genSampleNumber());
    setSampledAt("");
    setColor("");
    setOilVisibility("");
    setParticulates("");
    setDateAnalyzed("");
    setReadings({});
  };

  async function findSample() {
    if (!searchPoint || !searchNumber) {
      toast.error("Pick a sample point and sample number.");
      return;
    }
    const { data, error } = await supabase
      .from("samples")
      .select("*")
      .eq("sample_point_id", searchPoint)
      .eq("sample_number", searchNumber)
      .maybeSingle();
    if (error) { toast.error(error.message); return; }
    if (!data) { toast.error("Sample not found."); return; }
    const s = data as SampleRow;
    setActiveSampleId(s.id);
    setSamplePointId(s.sample_point_id);
    setSampleNumber(s.sample_number);
    setSampledAt(s.sampled_at ? s.sampled_at.slice(0, 16) : "");
    setColor(s.color ?? "");
    setOilVisibility(s.oil_visibility ?? "");
    setParticulates(s.particulates ?? "");
    setDateAnalyzed(s.date_analyzed ?? "");
    setReadings({});
    toast.success(`Loaded sample ${s.sample_number}`);
  }

  async function addSamplePoint() {
    if (!newPointName.trim()) return;
    const { error } = await supabase.from("sample_points").insert({ name: newPointName.trim() });
    if (error) { toast.error(error.message); return; }
    setNewPointName("");
    toast.success("Sample point added");
    qc.invalidateQueries({ queryKey: ["sample_points"] });
  }

  async function saveSample() {
    if (!samplePointId || !sampleNumber) {
      toast.error("Sample point and number are required.");
      return;
    }
    const payload = {
      sample_point_id: samplePointId,
      sample_number: sampleNumber,
      analyst_id: user!.id,
      sampled_at: sampledAt ? new Date(sampledAt).toISOString() : null,
      color: color || null,
      oil_visibility: oilVisibility || null,
      particulates: particulates || null,
      date_analyzed: dateAnalyzed || null,
    };
    let sampleId = activeSampleId;
    if (sampleId) {
      const { error } = await supabase.from("samples").update(payload).eq("id", sampleId);
      if (error) { toast.error(error.message); return; }
    } else {
      const { data, error } = await supabase.from("samples").insert(payload).select("id").single();
      if (error) { toast.error(error.message); return; }
      sampleId = data.id as string;
      setActiveSampleId(sampleId);
    }

    if (selectedMethodId && methodFields.length) {
      // Build description -> value map for formulas (input fields only)
      const valuesByDesc: Record<string, number> = {};
      methodFields.forEach((f) => {
        if (!f.is_calculated) {
          const v = readings[f.id];
          if (v !== undefined && v !== "" && !Number.isNaN(Number(v))) {
            valuesByDesc[f.description] = Number(v);
          }
        }
      });
      const rows = methodFields
        .map((f) => {
          if (f.is_calculated) {
            const computed = evalFormula(f.formula ?? "", valuesByDesc);
            if (computed == null) return null;
            return { sample_id: sampleId!, method_field_id: f.id, value: computed };
          }
          const v = readings[f.id];
          if (v === undefined || v === "") return null;
          return { sample_id: sampleId!, method_field_id: f.id, value: Number(v) };
        })
        .filter((r): r is { sample_id: string; method_field_id: string; value: number } => r !== null);
      if (rows.length) {
        const { error } = await supabase
          .from("sample_readings")
          .upsert(rows, { onConflict: "sample_id,method_field_id" });
        if (error) { toast.error(error.message); return; }
      }
    }
    toast.success("Sample saved");
    toast.success("Sample saved");
    qc.invalidateQueries({ queryKey: ["data_view"] });
    qc.invalidateQueries({ queryKey: ["sample_numbers_for_point"] });
  }

  async function saveAsSample() {
    if (!samplePointId) {
      toast.error("Sample point is required.");
      return;
    }
    const newNumber = genSampleNumber();
    const payload = {
      sample_point_id: samplePointId,
      sample_number: newNumber,
      analyst_id: user!.id,
      sampled_at: sampledAt ? new Date(sampledAt).toISOString() : null,
      color: color || null,
      oil_visibility: oilVisibility || null,
      particulates: particulates || null,
      date_analyzed: dateAnalyzed || null,
    };
    const { data, error } = await supabase.from("samples").insert(payload).select("id").single();
    if (error) { toast.error(error.message); return; }
    const newId = data.id as string;

    if (selectedMethodId && methodFields.length) {
      const valuesByDesc: Record<string, number> = {};
      methodFields.forEach((f) => {
        if (!f.is_calculated) {
          const v = readings[f.id];
          if (v !== undefined && v !== "" && !Number.isNaN(Number(v))) {
            valuesByDesc[f.description] = Number(v);
          }
        }
      });
      const rows = methodFields
        .map((f) => {
          if (f.is_calculated) {
            const computed = evalFormula(f.formula ?? "", valuesByDesc);
            if (computed == null) return null;
            return { sample_id: newId, method_field_id: f.id, value: computed };
          }
          const v = readings[f.id];
          if (v === undefined || v === "") return null;
          return { sample_id: newId, method_field_id: f.id, value: Number(v) };
        })
        .filter((r): r is { sample_id: string; method_field_id: string; value: number } => r !== null);
      if (rows.length) {
        await supabase.from("sample_readings").insert(rows);
      }
    }

    setActiveSampleId(newId);
    setSampleNumber(newNumber);
    toast.success(`Saved as ${newNumber}`);
    qc.invalidateQueries({ queryKey: ["data_view"] });
  }

  async function deleteSample() {
    if (!activeSampleId) return;
    if (!confirm("Delete this sample and all its readings?")) return;
    const { error } = await supabase.from("samples").delete().eq("id", activeSampleId);
    if (error) { toast.error(error.message); return; }
    toast.success("Sample deleted");
    resetForm();
    qc.invalidateQueries({ queryKey: ["data_view"] });
    qc.invalidateQueries({ queryKey: ["sample_numbers_for_point"] });
  }

  const activePoint = useMemo(
    () => samplePoints.find((p) => p.id === samplePointId)?.name ?? "—",
    [samplePoints, samplePointId]
  );

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-6rem)]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Sample Entry</h1>
          <p className="text-xs text-muted-foreground">
            Analyst: <span className="font-medium text-foreground">{profile?.full_name ?? "—"}</span>
            {activeSampleId && <> · Editing <span className="font-mono text-foreground">{sampleNumber}</span> @ {activePoint}</>}
          </p>
        </div>
        <div className="flex gap-2">
          {activeSampleId && (
            <Button variant="outline" size="sm" onClick={resetForm}><Plus className="h-4 w-4 mr-1" />New</Button>
          )}
          {activeSampleId && (
            <Button variant="ghost" size="sm" onClick={deleteSample} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-1" />Delete
            </Button>
          )}
          <Button size="sm" onClick={saveSample}><Save className="h-4 w-4 mr-1" />Save</Button>
        </div>
      </div>

      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Find · Sample Point</Label>
              <Select value={searchPoint} onValueChange={(v) => { setSearchPoint(v); setSearchNumber(""); }}>
                <SelectTrigger className="w-56 h-9"><SelectValue placeholder="Select point" /></SelectTrigger>
                <SelectContent>
                  {samplePoints.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sample Number</Label>
              <Select value={searchNumber} onValueChange={setSearchNumber} disabled={!searchPoint}>
                <SelectTrigger className="w-56 h-9 font-mono">
                  <SelectValue placeholder={searchPoint ? "Select sample" : "Pick point first"} />
                </SelectTrigger>
                <SelectContent>
                  {searchSampleNumbers.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No samples for this point</div>
                  )}
                  {searchSampleNumbers.map((n) => <SelectItem key={n} value={n} className="font-mono">{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={findSample}><Search className="h-4 w-4 mr-1" />Load</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 flex-1 min-h-0">
        <Card className="lg:col-span-3 flex flex-col min-h-0">
          <CardHeader className="py-3"><CardTitle className="text-sm">Sample data</CardTitle></CardHeader>
          <CardContent className="flex-1 overflow-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Sample Point</Label>
                <div className="flex gap-2">
                  <Select value={samplePointId} onValueChange={setSamplePointId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select point" /></SelectTrigger>
                    <SelectContent>
                      {samplePoints.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Add new point…" className="h-9" value={newPointName} onChange={(e) => setNewPointName(e.target.value)} />
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={addSamplePoint}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sample Number</Label>
                <Input className="font-mono h-9" value={sampleNumber} onChange={(e) => setSampleNumber(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date &amp; Time Sampled</Label>
                <Input type="datetime-local" className="h-9" value={sampledAt} onChange={(e) => setSampledAt(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Color</Label>
                <Input className="h-9" value={color} onChange={(e) => setColor(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Oil Visibility</Label>
                <Input className="h-9" value={oilVisibility} onChange={(e) => setOilVisibility(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date Analyzed</Label>
                <Input type="date" className="h-9" value={dateAnalyzed} onChange={(e) => setDateAnalyzed(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Particulates</Label>
                <Textarea rows={1} className="min-h-9" value={particulates} onChange={(e) => setParticulates(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 flex flex-col min-h-0">
          <CardHeader className="py-3">
            <div className="flex items-end justify-between gap-2">
              <CardTitle className="text-sm">Method readings</CardTitle>
              <Select value={selectedMethodId} onValueChange={(v) => { setSelectedMethodId(v); setReadings({}); }}>
                <SelectTrigger className="h-8 w-52 text-xs"><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  {methods.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No methods yet.</div>}
                  {methods.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {!selectedMethodId && (
              <p className="text-sm text-muted-foreground">Select a method to enter readings.</p>
            )}
            {selectedMethodId && methodFields.length === 0 && (
              <p className="text-sm text-muted-foreground">This method has no fields.</p>
            )}
            {methodFields.length > 0 && (
              <div className="rounded-md border bg-card overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-2 py-1.5">Description</th>
                      <th className="text-left font-medium px-2 py-1.5 w-14">Unit</th>
                      <th className="text-left font-medium px-2 py-1.5 w-14">Min</th>
                      <th className="text-left font-medium px-2 py-1.5 w-14">Max</th>
                      <th className="text-left font-medium px-2 py-1.5 w-28">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const valuesByDesc: Record<string, number> = {};
                      methodFields.forEach((f) => {
                        if (!f.is_calculated) {
                          const rv = readings[f.id];
                          if (rv !== undefined && rv !== "" && !Number.isNaN(Number(rv))) {
                            valuesByDesc[f.description] = Number(rv);
                          }
                        }
                      });
                      return methodFields.map((f) => {
                        let displayValue = "";
                        let num: number | null = null;
                        if (f.is_calculated) {
                          const c = evalFormula(f.formula ?? "", valuesByDesc);
                          num = c;
                          displayValue = c == null ? "" : String(Math.round(c * 10000) / 10000);
                        } else {
                          const v = readings[f.id] ?? "";
                          displayValue = v;
                          num = v === "" ? null : Number(v);
                        }
                        const oor = num !== null && !Number.isNaN(num) && ((f.min_val != null && num < f.min_val) || (f.max_val != null && num > f.max_val));
                        return (
                          <tr key={f.id} className="border-t">
                            <td className="px-2 py-1.5">
                              <span className="inline-flex items-center gap-1">
                                {f.is_calculated && <span title="Calculated" className="text-[10px] font-mono px-1 rounded bg-muted text-muted-foreground">ƒ</span>}
                                {f.description}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground">{f.unit ?? "—"}</td>
                            <td className="px-2 py-1.5 font-mono">{f.min_val ?? "—"}</td>
                            <td className="px-2 py-1.5 font-mono">{f.max_val ?? "—"}</td>
                            <td className="px-2 py-1.5">
                              {f.is_calculated ? (
                                <div className={`font-mono h-7 px-2 flex items-center text-xs rounded-md border bg-muted/40 ${oor ? "border-destructive text-destructive" : ""}`}>
                                  {displayValue || <span className="text-muted-foreground">—</span>}
                                </div>
                              ) : (
                                <Input
                                  className={`font-mono h-7 text-xs ${oor ? "border-destructive text-destructive" : ""}`}
                                  value={displayValue}
                                  onChange={(e) => setReadings((r) => ({ ...r, [f.id]: e.target.value }))}
                                  inputMode="decimal"
                                />
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
