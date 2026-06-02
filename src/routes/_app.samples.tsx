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
import { MultiSelect } from "@/components/MultiSelect";
import { Copy, Files, Maximize2, Minimize2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { evalFormula, extractNumeric } from "@/lib/formula";
import { applyMethodInventoryUsage } from "@/lib/inventory-usage";
import { SAMPLE_STATUSES, type SampleStatus } from "@/lib/schedule";

type SamplesSearch = {
  scheduleId?: string;
  pointId?: string;
  sampleNumber?: string;
};

export const Route = createFileRoute("/_app/samples")({
  head: () => ({ meta: [{ title: "Sample Entry — LJ LIMS" }] }),
  validateSearch: (search: Record<string, unknown>): SamplesSearch => ({
    scheduleId: typeof search.scheduleId === "string" ? search.scheduleId : undefined,
    pointId: typeof search.pointId === "string" ? search.pointId : undefined,
    sampleNumber: typeof search.sampleNumber === "string" ? search.sampleNumber : undefined,
  }),
  component: SampleEntry,
});

type SamplePoint = { id: string; name: string };
type Method = { id: string; name: string };
type MethodField = {
  id: string;
  method_id: string;
  description: string;
  unit: string | null;
  min_val: number | null;
  max_val: number | null;
  position: number;
  is_calculated: boolean;
  formula: string | null;
};
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
  status: string | null;
  notes: string | null;
};

function genSampleNumber() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function genUniqueSampleNumber(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate =
      attempt === 0
        ? genSampleNumber()
        : `${genSampleNumber()}-${String(Math.floor(Math.random() * 100)).padStart(2, "0")}`;
    const { data, error } = await supabase
      .from("samples")
      .select("id")
      .eq("sample_number", candidate)
      .maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
  }
  // Extremely unlikely fallback
  return `${genSampleNumber()}-${Date.now().toString().slice(-4)}`;
}

function todayISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}


function SampleEntry() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [scheduleId, setScheduleId] = useState<string | null>(null);

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
  const [dateAnalyzed, setDateAnalyzed] = useState(todayISO());

  const [status, setStatus] = useState<SampleStatus | "">("");
  const [notes, setNotes] = useState("");
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const [selectedMethodIds, setSelectedMethodIds] = useState<Set<string>>(new Set());
  const [readings, setReadings] = useState<Record<string, string>>({});
  const [searchPoint, setSearchPoint] = useState<string>("");
  const [searchNumber, setSearchNumber] = useState("");
  const [newPointName, setNewPointName] = useState("");
  const [readingsExpanded, setReadingsExpanded] = useState(false);

  const selectedMethodIdsKey = useMemo(
    () => [...selectedMethodIds].sort().join(","),
    [selectedMethodIds],
  );

  const { data: methodFields = [] } = useQuery({
    queryKey: ["method_fields_multi", selectedMethodIdsKey],
    queryFn: async () => {
      if (selectedMethodIds.size === 0) return [];
      const { data, error } = await supabase
        .from("method_fields")
        .select("*")
        .in("method_id", [...selectedMethodIds])
        .eq("hidden", false)
        .order("position");
      if (error) throw error;
      return data as MethodField[];
    },
    enabled: selectedMethodIds.size > 0,
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
        .in(
          "method_field_id",
          methodFields.map((f) => f.id),
        );
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: { method_field_id: string; value: string | null }) => {
        map[r.method_field_id] = r.value == null ? "" : r.value;
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
    setDateAnalyzed(todayISO());

    setStatus("");
    setNotes("");
    setReadings({});
  };

  async function loadSample(pointId: string, number: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("samples")
      .select("*")
      .eq("sample_point_id", pointId)
      .eq("sample_number", number)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      return false;
    }
    if (!data) return false;
    const s = data as SampleRow;
    setActiveSampleId(s.id);
    setSamplePointId(s.sample_point_id);
    setSampleNumber(s.sample_number);
    setSampledAt(s.sampled_at ? (() => {
      const d = new Date(s.sampled_at);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    })() : "");
    setColor(s.color ?? "");
    setOilVisibility(s.oil_visibility ?? "");
    setDateAnalyzed(s.date_analyzed ?? todayISO());

    setDateAnalyzed(s.date_analyzed ?? "");
    setStatus((s.status as SampleStatus) ?? "");
    setNotes(s.notes ?? "");
    setReadings({});
    // Auto-select all methods that have readings for this sample
    const { data: srData } = await supabase
      .from("sample_readings")
      .select("method_field_id, value")
      .eq("sample_id", s.id)
      .not("value", "is", null);
    const fieldIds = (srData ?? [])
      .filter((r: any) => r.value !== "")
      .map((r: any) => r.method_field_id) as string[];
    if (fieldIds.length > 0) {
      const { data: mfData } = await supabase
        .from("method_fields")
        .select("method_id")
        .in("id", fieldIds);
      const methodIds = [...new Set((mfData ?? []).map((f: any) => f.method_id))] as string[];
      setSelectedMethodIds(new Set(methodIds));
    } else {
      setSelectedMethodIds(new Set());
    }
    return true;
  }

  // Auto-load whenever a sample number is selected for the chosen point
  useEffect(() => {
    if (!searchPoint || !searchNumber) return;
    (async () => {
      const ok = await loadSample(searchPoint, searchNumber);
      if (!ok) toast.error("Sample not found.");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchPoint, searchNumber]);

  function clearForm() {
    resetForm();
    setSearchNumber("");
    setSelectedMethodIds(new Set());
  }


  // Apply incoming search params from Sample Schedule navigation
  useEffect(() => {
    if (search.scheduleId) setScheduleId(search.scheduleId);
    else setScheduleId(null);
    (async () => {
      if (search.pointId && search.sampleNumber) {
        await loadSample(search.pointId, search.sampleNumber);
      } else if (search.pointId) {
        setSamplePointId(search.pointId);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.scheduleId, search.pointId, search.sampleNumber]);

  async function addSamplePoint() {
    if (!newPointName.trim()) return;
    const { error } = await supabase.from("sample_points").insert({ name: newPointName.trim() });
    if (error) {
      toast.error(error.message);
      return;
    }
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
      status: status || null,
      notes: notes || null,
    };
    let sampleId = activeSampleId;
    if (sampleId) {
      const { error } = await supabase.from("samples").update(payload).eq("id", sampleId);
      if (error) {
        toast.error(error.message);
        return;
      }
    } else {
      const { data, error } = await supabase.from("samples").insert(payload).select("id").single();
      if (error) {
        toast.error(error.message);
        return;
      }
      sampleId = data.id as string;
      setActiveSampleId(sampleId);
    }

    if (selectedMethodIds.size > 0 && methodFields.length) {
      const fieldsByMethod = new Map<string, MethodField[]>();
      methodFields.forEach((f) => {
        const arr = fieldsByMethod.get(f.method_id) ?? [];
        arr.push(f);
        fieldsByMethod.set(f.method_id, arr);
      });
      const allRows: { sample_id: string; method_field_id: string; value: string }[] = [];
      fieldsByMethod.forEach((fields) => {
        const valuesByDesc: Record<string, number> = {};
        fields.forEach((f) => {
          if (!f.is_calculated) {
            const n = extractNumeric(readings[f.id]);
            if (n !== null) valuesByDesc[f.description] = n;
          }
        });
        fields.forEach((f) => {
          if (f.is_calculated) {
            const computed = evalFormula(f.formula ?? "", valuesByDesc);
            if (computed == null) return;
            allRows.push({ sample_id: sampleId!, method_field_id: f.id, value: String(computed) });
          } else {
            const v = readings[f.id];
            if (v === undefined || v === "") return;
            allRows.push({ sample_id: sampleId!, method_field_id: f.id, value: String(v) });
          }
        });
      });
      if (allRows.length) {
        const { error } = await supabase
          .from("sample_readings")
          .upsert(allRows, { onConflict: "sample_id,method_field_id" });
        if (error) {
          toast.error(error.message);
          return;
        }
      }
      for (const mid of selectedMethodIds) {
        try {
          await applyMethodInventoryUsage(sampleId!, mid, user?.id ?? null);
        } catch (e: any) {
          toast.error(`Inventory: ${e.message}`);
        }
      }
    }
    await linkToSchedule(sampleNumber);
    toast.success("Sample saved");
    qc.invalidateQueries({ queryKey: ["data_view"] });
    qc.invalidateQueries({ queryKey: ["sample_numbers_for_point"] });
    qc.invalidateQueries({ queryKey: ["inventory_items"] });
    qc.invalidateQueries({ queryKey: ["sample_inventory_usage"] });
  }

  async function linkToSchedule(num: string) {
    if (!scheduleId) return;
    const nextStatus: SampleStatus = (status as SampleStatus) || "Lab";
    const { error } = await supabase
      .from("sample_schedules")
      .update({ sample_number: num, status: nextStatus })
      .eq("id", scheduleId);
    if (error) {
      toast.error(`Schedule: ${error.message}`);
      return;
    }
    if (!status) setStatus(nextStatus);
    qc.invalidateQueries({ queryKey: ["sample_schedules"] });
    qc.invalidateQueries({ queryKey: ["sample_schedules_view"] });
    // Keep URL in sync so re-clicking the row loads this sample
    navigate({
      to: "/samples",
      search: { scheduleId, pointId: samplePointId, sampleNumber: num },
      replace: true,
    });
  }


  async function saveAsSample() {
    if (!samplePointId) {
      toast.error("Sample point is required.");
      return;
    }
    const newNumber = await genUniqueSampleNumber();
    const payload = {
      sample_point_id: samplePointId,
      sample_number: newNumber,
      analyst_id: user!.id,
      sampled_at: sampledAt ? new Date(sampledAt).toISOString() : null,
      color: color || null,
      oil_visibility: oilVisibility || null,
      particulates: particulates || null,
      date_analyzed: dateAnalyzed || null,
      status: status || null,
      notes: notes || null,
    };
    const { data, error } = await supabase.from("samples").insert(payload).select("id").single();
    if (error) {
      toast.error(error.message);
      return;
    }
    const newId = data.id as string;

    if (selectedMethodIds.size > 0 && methodFields.length) {
      const fieldsByMethod = new Map<string, MethodField[]>();
      methodFields.forEach((f) => {
        const arr = fieldsByMethod.get(f.method_id) ?? [];
        arr.push(f);
        fieldsByMethod.set(f.method_id, arr);
      });
      const allRows: { sample_id: string; method_field_id: string; value: string }[] = [];
      fieldsByMethod.forEach((fields) => {
        const valuesByDesc: Record<string, number> = {};
        fields.forEach((f) => {
          if (!f.is_calculated) {
            const n = extractNumeric(readings[f.id]);
            if (n !== null) valuesByDesc[f.description] = n;
          }
        });
        fields.forEach((f) => {
          if (f.is_calculated) {
            const computed = evalFormula(f.formula ?? "", valuesByDesc);
            if (computed == null) return;
            allRows.push({ sample_id: newId, method_field_id: f.id, value: String(computed) });
          } else {
            const v = readings[f.id];
            if (v === undefined || v === "") return;
            allRows.push({ sample_id: newId, method_field_id: f.id, value: String(v) });
          }
        });
      });
      if (allRows.length) {
        await supabase.from("sample_readings").insert(allRows);
      }
    }
    for (const mid of selectedMethodIds) {
      try {
        await applyMethodInventoryUsage(newId, mid, user?.id ?? null);
      } catch (e: any) {
        toast.error(`Inventory: ${e.message}`);
      }
    }

    setActiveSampleId(newId);
    setSampleNumber(newNumber);
    await linkToSchedule(newNumber);
    toast.success(`Saved as ${newNumber}`);
    qc.invalidateQueries({ queryKey: ["data_view"] });
    qc.invalidateQueries({ queryKey: ["inventory_items"] });
    qc.invalidateQueries({ queryKey: ["sample_inventory_usage"] });
  }

  async function duplicateSample() {
    if (!samplePointId || !sampleNumber) {
      toast.error("Sample point and number are required.");
      return;
    }
    const newNumber = `${sampleNumber}_1`;
    const payload = {
      sample_point_id: samplePointId,
      sample_number: newNumber,
      analyst_id: user!.id,
      sampled_at: sampledAt ? new Date(sampledAt).toISOString() : null,
      color: color || null,
      oil_visibility: oilVisibility || null,
      particulates: particulates || null,
      date_analyzed: dateAnalyzed || null,
      status: status || null,
      notes: notes || null,
    };
    const { data, error } = await supabase.from("samples").insert(payload).select("id").single();
    if (error) {
      toast.error(error.message);
      return;
    }
    const newId = data.id as string;

    if (selectedMethodIds.size > 0 && methodFields.length) {
      const fieldsByMethod = new Map<string, MethodField[]>();
      methodFields.forEach((f) => {
        const arr = fieldsByMethod.get(f.method_id) ?? [];
        arr.push(f);
        fieldsByMethod.set(f.method_id, arr);
      });
      const allRows: { sample_id: string; method_field_id: string; value: string }[] = [];
      fieldsByMethod.forEach((fields) => {
        const valuesByDesc: Record<string, number> = {};
        fields.forEach((f) => {
          if (!f.is_calculated) {
            const n = extractNumeric(readings[f.id]);
            if (n !== null) valuesByDesc[f.description] = n;
          }
        });
        fields.forEach((f) => {
          if (f.is_calculated) {
            const computed = evalFormula(f.formula ?? "", valuesByDesc);
            if (computed == null) return;
            allRows.push({ sample_id: newId, method_field_id: f.id, value: String(computed) });
          } else {
            const v = readings[f.id];
            if (v === undefined || v === "") return;
            allRows.push({ sample_id: newId, method_field_id: f.id, value: String(v) });
          }
        });
      });
      if (allRows.length) {
        await supabase.from("sample_readings").insert(allRows);
      }
    }
    for (const mid of selectedMethodIds) {
      try {
        await applyMethodInventoryUsage(newId, mid, user?.id ?? null);
      } catch (e: any) {
        toast.error(`Inventory: ${e.message}`);
      }
    }

    setActiveSampleId(newId);
    setSampleNumber(newNumber);
    toast.success(`Duplicated as ${newNumber}`);
    qc.invalidateQueries({ queryKey: ["data_view"] });
    qc.invalidateQueries({ queryKey: ["inventory_items"] });
    qc.invalidateQueries({ queryKey: ["sample_inventory_usage"] });
    qc.invalidateQueries({ queryKey: ["sample_numbers_for_point"] });
  }

  async function deleteSample() {
    if (!activeSampleId) return;
    if (!confirm("Delete this sample and all its readings?")) return;
    const { error } = await supabase.from("samples").delete().eq("id", activeSampleId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Sample deleted");
    resetForm();
    qc.invalidateQueries({ queryKey: ["data_view"] });
    qc.invalidateQueries({ queryKey: ["sample_numbers_for_point"] });
  }

  const activePoint = useMemo(
    () => samplePoints.find((p) => p.id === samplePointId)?.name ?? "—",
    [samplePoints, samplePointId],
  );

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-3rem)]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sample Entry</h1>
          <p className="text-sm text-muted-foreground">
            Analyst: <span className="font-medium text-foreground">{profile?.full_name ?? "—"}</span>
            {activeSampleId && (
              <>
                {" "}
                · Editing <span className="font-mono text-foreground">{sampleNumber}</span> @ {activePoint}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {activeSampleId && (
            <Button variant="outline" size="sm" onClick={resetForm}>
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          )}
          {activeSampleId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={deleteSample}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          )}
          {activeSampleId && (
            <Button variant="outline" size="sm" onClick={duplicateSample}>
              <Files className="h-4 w-4 mr-1" />
              Duplicate
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={saveAsSample}>
            <Copy className="h-4 w-4 mr-1" />
            Save As
          </Button>
          <Button size="sm" onClick={saveSample}>
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Find · Sample Point</Label>
              <Select
                value={searchPoint}
                onValueChange={(v) => {
                  setSearchPoint(v);
                  setSearchNumber("");
                }}
              >
                <SelectTrigger className="w-56 h-9">
                  <SelectValue placeholder="Select point" />
                </SelectTrigger>
                <SelectContent>
                  {samplePoints.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
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
                  {searchSampleNumbers.map((n) => (
                    <SelectItem key={n} value={n} className="font-mono">
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={clearForm}>
              <Plus className="h-4 w-4 mr-1" />
              Clear
            </Button>
            <div className="ml-auto flex items-center justify-center flex-1">
              <span className="text-2xl font-bold tracking-tight">
                Sample: {samplePoints.find((p) => p.id === samplePointId)?.name ?? ""} - {sampleNumber}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0">
        <Card className="lg:col-span-1 flex flex-col min-h-0">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Sample data</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Sample Point</Label>
                <div className="flex gap-2">
                  <Select value={samplePointId} onValueChange={setSamplePointId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select point" />
                    </SelectTrigger>
                    <SelectContent>
                      {samplePoints.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Add new point…"
                    className="h-9"
                    value={newPointName}
                    onChange={(e) => setNewPointName(e.target.value)}
                  />
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={addSamplePoint}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sample Number</Label>
                <Input
                  className="font-mono h-9"
                  value={sampleNumber}
                  onChange={(e) => setSampleNumber(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date &amp; Time Sampled</Label>
                <Input
                  type="datetime-local"
                  className="h-9 dark:[&::-webkit-calendar-picker-indicator]:invert"

                  value={sampledAt}
                  onChange={(e) => setSampledAt(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date Analyzed</Label>
                <Input
                  type="date"
                  className="h-9 dark:[&::-webkit-calendar-picker-indicator]:invert"
                  value={dateAnalyzed}
                  onChange={(e) => setDateAnalyzed(e.target.value)}
                />
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
                <Label className="text-xs">Particulates</Label>
                <Textarea
                  rows={1}
                  className="min-h-9"
                  value={particulates}
                  onChange={(e) => setParticulates(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as SampleStatus)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {SAMPLE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`lg:col-span-2 flex flex-col min-h-0 ${readingsExpanded ? "fixed inset-0 z-50 rounded-none" : ""}`}>
          <CardHeader className="py-3">
            <div className="flex items-end justify-between gap-2">
              <CardTitle className="text-sm">Method readings</CardTitle>
              <div className="flex items-center gap-2">
                <MultiSelect
                  label="Methods"
                  items={methods.map((m) => ({ id: m.id, name: m.name }))}
                  selected={selectedMethodIds}
                  onChange={setSelectedMethodIds}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setReadingsExpanded((v) => !v)}
                  className="border border-primary/30 shadow-sm"
                >
                  {readingsExpanded ? (
                    <><Minimize2 className="h-4 w-4 mr-1.5" />Collapse</>
                  ) : (
                    <><Maximize2 className="h-4 w-4 mr-1.5" />Expand</>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {selectedMethodIds.size === 0 && (
              <p className="text-sm text-muted-foreground">Select one or more methods to enter readings.</p>
            )}
            {selectedMethodIds.size > 0 && methodFields.length === 0 && (
              <p className="text-sm text-muted-foreground">The selected method(s) have no fields.</p>
            )}
            {methodFields.length > 0 && (
              <div className="space-y-3">
                {methods
                  .filter((m) => selectedMethodIds.has(m.id))
                  .map((m) => {
                    const fields = methodFields.filter((f) => f.method_id === m.id);
                    if (fields.length === 0) return null;
                    const valuesByDesc: Record<string, number> = {};
                    fields.forEach((f) => {
                      if (!f.is_calculated) {
                        const n = extractNumeric(readings[f.id]);
                        if (n !== null) valuesByDesc[f.description] = n;
                      }
                    });
                    return (
                      <div key={m.id} className="rounded-md border bg-muted/20 p-2">
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                            {m.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {fields.length} field{fields.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {fields.map((f) => {
                            let displayValue = "";
                            let num: number | null = null;
                            if (f.is_calculated) {
                              const c = evalFormula(f.formula ?? "", valuesByDesc);
                              num = c;
                              displayValue = c == null ? "" : String(Math.round(c * 10000) / 10000);
                            } else {
                              const v = readings[f.id] ?? "";
                              displayValue = v;
                              num = extractNumeric(v);
                            }
                            const oor =
                              num !== null &&
                              !Number.isNaN(num) &&
                              ((f.min_val != null && num < f.min_val) ||
                                (f.max_val != null && num > f.max_val));
                            return (
                              <div
                                key={f.id}
                                className="rounded-md border p-2 space-y-1.5 bg-card min-w-[180px] flex-1 basis-[180px] max-w-[260px]"
                              >
                                <div className="flex items-center gap-1.5">
                                  {f.is_calculated && (
                                    <span
                                      title="Calculated"
                                      className="text-[10px] font-mono px-1 rounded bg-muted text-muted-foreground"
                                    >
                                      ƒ
                                    </span>
                                  )}
                                  <span className="text-xs font-medium">{f.description}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                  <span>Unit: {f.unit ?? "—"}</span>
                                  <span>Min: {f.min_val ?? "—"}</span>
                                  <span>Max: {f.max_val ?? "—"}</span>
                                </div>
                                {f.is_calculated ? (
                                  <div
                                    className={`font-mono h-8 px-2 flex items-center text-xs rounded-md border bg-muted/40 ${oor ? "border-destructive text-destructive" : ""}`}
                                  >
                                    {displayValue || <span className="text-muted-foreground">—</span>}
                                  </div>
                                ) : (
                                  <Input
                                    className={`font-mono h-8 text-xs ${oor ? "border-destructive text-destructive" : ""}`}
                                    value={displayValue}
                                    onChange={(e) =>
                                      setReadings((r) => ({ ...r, [f.id]: e.target.value }))
                                    }
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
