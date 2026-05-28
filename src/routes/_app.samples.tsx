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
import { Separator } from "@/components/ui/separator";
import { Plus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/samples")({
  head: () => ({ meta: [{ title: "Sample Entry — LJ LIMS" }] }),
  component: SampleEntry,
});

type SamplePoint = { id: string; name: string };
type Method = { id: string; name: string };
type MethodField = { id: string; method_id: string; description: string; unit: string | null; min_val: number | null; max_val: number | null; position: number };
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
      toast.error("Pick a sample point and enter a sample number.");
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

    // Save readings
    if (selectedMethodId && methodFields.length) {
      const rows = methodFields
        .filter((f) => readings[f.id] !== undefined && readings[f.id] !== "")
        .map((f) => ({
          sample_id: sampleId!,
          method_field_id: f.id,
          value: Number(readings[f.id]),
        }));
      if (rows.length) {
        const { error } = await supabase
          .from("sample_readings")
          .upsert(rows, { onConflict: "sample_id,method_field_id" });
        if (error) { toast.error(error.message); return; }
      }
    }
    toast.success("Sample saved");
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
  }

  const activePoint = useMemo(
    () => samplePoints.find((p) => p.id === samplePointId)?.name ?? "—",
    [samplePoints, samplePointId]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sample Entry</h1>
          <p className="text-sm text-muted-foreground">
            Analyst: <span className="font-medium text-foreground">{profile?.full_name ?? "—"}</span>
            {activeSampleId && <> · Editing <span className="font-mono text-foreground">{sampleNumber}</span> @ {activePoint}</>}
          </p>
        </div>
        <div className="flex gap-2">
          {activeSampleId && (
            <Button variant="outline" size="sm" onClick={resetForm}><Plus className="h-4 w-4 mr-2" />New sample</Button>
          )}
          {activeSampleId && (
            <Button variant="ghost" size="sm" onClick={deleteSample} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />Delete
            </Button>
          )}
          <Button size="sm" onClick={saveSample}><Save className="h-4 w-4 mr-2" />Save</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Find existing sample</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Sample Point</Label>
              <Select value={searchPoint} onValueChange={setSearchPoint}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Select point" /></SelectTrigger>
                <SelectContent>
                  {samplePoints.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sample Number</Label>
              <Input className="w-56 font-mono" value={searchNumber} onChange={(e) => setSearchNumber(e.target.value)} />
            </div>
            <Button variant="outline" onClick={findSample}><Search className="h-4 w-4 mr-2" />Find</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sample data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Sample Point</Label>
              <div className="flex gap-2">
                <Select value={samplePointId} onValueChange={setSamplePointId}>
                  <SelectTrigger><SelectValue placeholder="Select point" /></SelectTrigger>
                  <SelectContent>
                    {samplePoints.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-1">
                <Input placeholder="Add new point…" value={newPointName} onChange={(e) => setNewPointName(e.target.value)} />
                <Button variant="outline" size="icon" onClick={addSamplePoint}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Sample Number</Label>
              <Input className="font-mono" value={sampleNumber} onChange={(e) => setSampleNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date &amp; Time Sampled</Label>
              <Input type="datetime-local" value={sampledAt} onChange={(e) => setSampledAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <Input value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Oil Visibility</Label>
              <Input value={oilVisibility} onChange={(e) => setOilVisibility(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Particulates</Label>
              <Textarea rows={1} value={particulates} onChange={(e) => setParticulates(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Date Analyzed</Label>
              <Input type="date" value={dateAnalyzed} onChange={(e) => setDateAnalyzed(e.target.value)} />
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-end gap-3 mb-4">
              <div className="space-y-1.5 w-72">
                <Label>Method</Label>
                <Select value={selectedMethodId} onValueChange={(v) => { setSelectedMethodId(v); setReadings({}); }}>
                  <SelectTrigger><SelectValue placeholder="Select a method to add data" /></SelectTrigger>
                  <SelectContent>
                    {methods.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No methods yet. Create one on the Methods page.</div>}
                    {methods.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedMethodId && methodFields.length === 0 && (
              <p className="text-sm text-muted-foreground">This method has no fields. Add fields on the Methods page.</p>
            )}
            {methodFields.length > 0 && (
              <div className="rounded-md border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Description</th>
                      <th className="text-left font-medium px-3 py-2 w-24">Unit</th>
                      <th className="text-left font-medium px-3 py-2 w-24">Min</th>
                      <th className="text-left font-medium px-3 py-2 w-24">Max</th>
                      <th className="text-left font-medium px-3 py-2 w-48">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {methodFields.map((f) => {
                      const v = readings[f.id] ?? "";
                      const num = v === "" ? null : Number(v);
                      const oor = num !== null && !Number.isNaN(num) && ((f.min_val != null && num < f.min_val) || (f.max_val != null && num > f.max_val));
                      return (
                        <tr key={f.id} className="border-t">
                          <td className="px-3 py-2">{f.description}</td>
                          <td className="px-3 py-2 text-muted-foreground">{f.unit ?? "—"}</td>
                          <td className="px-3 py-2 font-mono text-xs">{f.min_val ?? "—"}</td>
                          <td className="px-3 py-2 font-mono text-xs">{f.max_val ?? "—"}</td>
                          <td className="px-3 py-2">
                            <Input
                              className={`font-mono ${oor ? "border-destructive text-destructive" : ""}`}
                              value={v}
                              onChange={(e) => setReadings((r) => ({ ...r, [f.id]: e.target.value }))}
                              inputMode="decimal"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
