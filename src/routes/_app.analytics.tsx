import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronDown, CalendarIcon, Save, Trash2 } from "lucide-react";
import { format, subDays, parseISO, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({ meta: [{ title: "Analytics — LJ LIMS" }] }),
  component: AnalyticsPage,
});

type MethodField = { id: string; description: string; unit: string | null; position: number; hidden: boolean };
type Method = { id: string; name: string; fields: MethodField[] };
type SamplePoint = { id: string; name: string };

type ChartType = "line" | "bar" | "scatter";
type Aggregation = "none" | "avg" | "min" | "max" | "count";
type Bucket = "day" | "week" | "month";

type PlotConfig = {
  chartType: ChartType;
  methodId: string | null;
  fieldId: string | null;
  // scatter X axis
  xMethodId: string | null;
  xFieldId: string | null;
  pointIds: string[]; // empty = all
  rangeDays: number; // 0 = custom
  from: string | null; // ISO
  to: string | null;   // ISO
  aggregation: Aggregation;
  bucket: Bucket;
};

const DEFAULT_CONFIG: PlotConfig = {
  chartType: "line",
  methodId: null,
  fieldId: null,
  xMethodId: null,
  xFieldId: null,
  pointIds: [],
  rangeDays: 30,
  from: null,
  to: null,
  aggregation: "none",
  bucket: "day",
};

const SERIES_COLORS = [
  "hsl(220, 70%, 50%)",
  "hsl(160, 60%, 45%)",
  "hsl(30, 80%, 55%)",
  "hsl(280, 65%, 60%)",
  "hsl(0, 70%, 55%)",
  "hsl(190, 70%, 45%)",
  "hsl(50, 80%, 50%)",
  "hsl(340, 70%, 55%)",
];

function PointsMultiSelect({
  items,
  selected,
  onChange,
  placeholder = "All sample points",
}: {
  items: SamplePoint[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const summary =
    selected.length === 0
      ? placeholder
      : selected.length === items.length
      ? "All sample points"
      : `${selected.length} selected`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between gap-2">
          <span className="truncate text-sm">{summary}</span>
          <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="flex items-center justify-between px-1 pb-2 border-b mb-2">
          <span className="text-xs font-medium">Sample Points</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => onChange(items.map((i) => i.id))}
            >
              All
            </button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:underline"
              onClick={() => onChange([])}
            >
              None
            </button>
          </div>
        </div>
        <div className="max-h-64 overflow-auto space-y-1">
          {items.map((i) => {
            const checked = selected.includes(i.id);
            return (
              <label
                key={i.id}
                className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    if (v) onChange([...selected, i.id]);
                    else onChange(selected.filter((x) => x !== i.id));
                  }}
                />
                <span className="truncate">{i.name}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AnalyticsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [config, setConfig] = useState<PlotConfig>(DEFAULT_CONFIG);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  const set = <K extends keyof PlotConfig>(k: K, v: PlotConfig[K]) =>
    setConfig((c) => ({ ...c, [k]: v }));

  // --- Reference data ---
  const { data: methods } = useQuery({
    queryKey: ["analytics_methods"],
    queryFn: async (): Promise<Method[]> => {
      const { data, error } = await supabase
        .from("methods")
        .select("id, name, method_fields(id, description, unit, position, hidden)")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((m) => ({
        id: m.id as string,
        name: m.name as string,
        fields: ((m.method_fields as MethodField[]) ?? [])
          .filter((f) => !f.hidden)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
      })).filter((m) => m.fields.length > 0);
    },
  });

  const { data: samplePoints } = useQuery({
    queryKey: ["analytics_points"],
    queryFn: async (): Promise<SamplePoint[]> => {
      const { data, error } = await supabase.from("sample_points").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as SamplePoint[];
    },
  });

  // Saved views
  const { data: savedViews } = useQuery({
    queryKey: ["analytics_saved_views", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_analytics_views")
        .select("id, name, config, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Default field selection once methods load
  useEffect(() => {
    if (methods && methods.length && !config.methodId) {
      const m = methods[0];
      setConfig((c) => ({ ...c, methodId: m.id, fieldId: m.fields[0]?.id ?? null }));
    }
  }, [methods, config.methodId]);

  // Compute date range
  const dateRange = useMemo(() => {
    if (config.rangeDays > 0) {
      const to = new Date();
      const from = subDays(to, config.rangeDays);
      return { from, to };
    }
    return {
      from: config.from ? parseISO(config.from) : subDays(new Date(), 30),
      to: config.to ? parseISO(config.to) : new Date(),
    };
  }, [config.rangeDays, config.from, config.to]);

  // --- Data fetch (readings + samples in range) ---
  const fieldIds = useMemo(() => {
    const ids = [config.fieldId, config.xFieldId].filter(Boolean) as string[];
    return Array.from(new Set(ids));
  }, [config.fieldId, config.xFieldId]);

  const { data: plotData, isLoading } = useQuery({
    queryKey: ["analytics_data", fieldIds, dateRange.from.toISOString(), dateRange.to.toISOString(), config.pointIds.join(",")],
    enabled: fieldIds.length > 0,
    queryFn: async () => {
      let q = supabase
        .from("samples")
        .select(`
          id, sample_number, sampled_at, sample_point_id,
          sample_points!inner(name),
          sample_readings!inner(value, method_field_id)
        `)
        .gte("sampled_at", dateRange.from.toISOString())
        .lte("sampled_at", dateRange.to.toISOString())
        .in("sample_readings.method_field_id", fieldIds)
        .order("sampled_at", { ascending: true })
        .limit(5000);
      if (config.pointIds.length > 0) {
        q = q.in("sample_point_id", config.pointIds);
      }
      const { data, error } = await q;
      if (error) throw error;
      type SampleRow = {
        id: string;
        sample_number: string;
        sampled_at: string | null;
        sample_point_id: string;
        sample_points: { name: string };
        sample_readings: Array<{ value: number | null; method_field_id: string }>;
      };
      return (data ?? []) as unknown as SampleRow[];
    },
  });

  // Build series data
  const yField = useMemo(() => {
    if (!methods || !config.methodId || !config.fieldId) return null;
    const m = methods.find((mm) => mm.id === config.methodId);
    return m?.fields.find((f) => f.id === config.fieldId) ?? null;
  }, [methods, config.methodId, config.fieldId]);

  const xField = useMemo(() => {
    if (config.chartType !== "scatter") return null;
    if (!methods || !config.xMethodId || !config.xFieldId) return null;
    const m = methods.find((mm) => mm.id === config.xMethodId);
    return m?.fields.find((f) => f.id === config.xFieldId) ?? null;
  }, [methods, config.xMethodId, config.xFieldId, config.chartType]);

  // Series grouping = by sample point name
  type Pt = { x: number | string; y: number; label?: string };
  const chartSeries = useMemo(() => {
    if (!plotData || !config.fieldId) return [] as { name: string; color: string; data: Pt[] }[];
    const byPoint = new Map<string, { name: string; rows: typeof plotData }>();
    for (const s of plotData) {
      const name = s.sample_points?.name ?? "—";
      if (!byPoint.has(s.sample_point_id)) byPoint.set(s.sample_point_id, { name, rows: [] });
      byPoint.get(s.sample_point_id)!.rows.push(s);
    }

    const series: { name: string; color: string; data: Pt[] }[] = [];
    let idx = 0;
    for (const [, group] of byPoint) {
      const pts: Pt[] = [];
      if (config.chartType === "scatter" && xField) {
        for (const s of group.rows) {
          const yVal = s.sample_readings.find((r) => r.method_field_id === config.fieldId)?.value;
          const xVal = s.sample_readings.find((r) => r.method_field_id === xField.id)?.value;
          if (yVal == null || xVal == null) continue;
          pts.push({ x: Number(xVal), y: Number(yVal), label: s.sample_number });
        }
      } else {
        // line / bar — time on x
        const rows: { t: number; v: number }[] = [];
        for (const s of group.rows) {
          const yVal = s.sample_readings.find((r) => r.method_field_id === config.fieldId)?.value;
          if (yVal == null || !s.sampled_at) continue;
          rows.push({ t: new Date(s.sampled_at).getTime(), v: Number(yVal) });
        }
        if (config.aggregation === "none") {
          rows.sort((a, b) => a.t - b.t);
          for (const r of rows) pts.push({ x: r.t, y: r.v });
        } else {
          const buckets = new Map<number, number[]>();
          for (const r of rows) {
            const d = new Date(r.t);
            const key =
              config.bucket === "day" ? startOfDay(d).getTime()
              : config.bucket === "week" ? startOfWeek(d).getTime()
              : startOfMonth(d).getTime();
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key)!.push(r.v);
          }
          const keys = [...buckets.keys()].sort((a, b) => a - b);
          for (const k of keys) {
            const arr = buckets.get(k)!;
            let v = 0;
            if (config.aggregation === "avg") v = arr.reduce((s, n) => s + n, 0) / arr.length;
            else if (config.aggregation === "min") v = Math.min(...arr);
            else if (config.aggregation === "max") v = Math.max(...arr);
            else if (config.aggregation === "count") v = arr.length;
            pts.push({ x: k, y: v });
          }
        }
      }
      series.push({
        name: group.name,
        color: SERIES_COLORS[idx % SERIES_COLORS.length],
        data: pts,
      });
      idx++;
    }
    return series;
  }, [plotData, config.fieldId, config.chartType, config.aggregation, config.bucket, xField]);

  // For bar/line we merge series into wide rows keyed by x
  const mergedTimeData = useMemo(() => {
    if (config.chartType === "scatter") return [];
    const map = new Map<number, Record<string, number | string>>();
    for (const s of chartSeries) {
      for (const p of s.data) {
        const xk = Number(p.x);
        if (!map.has(xk)) map.set(xk, { x: xk });
        map.get(xk)![s.name] = p.y;
      }
    }
    return [...map.values()].sort((a, b) => Number(a.x) - Number(b.x));
  }, [chartSeries, config.chartType]);

  const xTickFormatter = (v: number | string) => {
    if (config.chartType === "scatter") return String(v);
    const d = new Date(Number(v));
    if (config.bucket === "month" || config.rangeDays >= 180) return format(d, "MMM yy");
    if (config.bucket === "week" || config.rangeDays >= 60) return format(d, "MMM d");
    return format(d, "MMM d");
  };

  const yLabel = yField ? `${yField.description}${yField.unit ? ` (${yField.unit})` : ""}` : "Value";
  const xLabel = config.chartType === "scatter"
    ? (xField ? `${xField.description}${xField.unit ? ` (${xField.unit})` : ""}` : "X")
    : "Sampled";

  // --- Save view ---
  async function saveView() {
    if (!user) return;
    if (!saveName.trim()) {
      toast.error("Name required");
      return;
    }
    const { error } = await supabase.from("saved_analytics_views").insert({
      user_id: user.id,
      name: saveName.trim(),
      config: config as unknown as Record<string, unknown>,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("View saved");
    setSaveName("");
    setSaveOpen(false);
    qc.invalidateQueries({ queryKey: ["analytics_saved_views"] });
  }

  async function deleteView(id: string) {
    const { error } = await supabase.from("saved_analytics_views").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("View deleted");
    qc.invalidateQueries({ queryKey: ["analytics_saved_views"] });
  }

  function loadView(cfg: unknown) {
    setConfig({ ...DEFAULT_CONFIG, ...(cfg as PlotConfig) });
  }

  const fieldsForY = useMemo(() => {
    const m = methods?.find((mm) => mm.id === config.methodId);
    return m?.fields ?? [];
  }, [methods, config.methodId]);

  const fieldsForX = useMemo(() => {
    const m = methods?.find((mm) => mm.id === config.xMethodId);
    return m?.fields ?? [];
  }, [methods, config.xMethodId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Plot sample readings across methods, sample points, and time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedViews && savedViews.length > 0 && (
            <Select onValueChange={(id) => {
              const v = savedViews.find((x) => x.id === id);
              if (v) loadView(v.config);
            }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Load saved view" />
              </SelectTrigger>
              <SelectContent>
                {savedViews.map((v) => (
                  <div key={v.id} className="flex items-center justify-between pr-1">
                    <SelectItem value={v.id} className="flex-1">{v.name}</SelectItem>
                    <button
                      type="button"
                      className="p-1 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteView(v.id); }}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </SelectContent>
            </Select>
          )}
          <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Save className="h-4 w-4 mr-2" />Save view
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Save analytics view</DialogTitle></DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="view-name">Name</Label>
                <Input
                  id="view-name"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g. Tank A — weekly TAN"
                />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setSaveOpen(false)}>Cancel</Button>
                <Button onClick={saveView}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Chart type</Label>
              <Select value={config.chartType} onValueChange={(v: ChartType) => set("chartType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="line">Line (trend over time)</SelectItem>
                  <SelectItem value="bar">Bar (comparison)</SelectItem>
                  <SelectItem value="scatter">Scatter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Method (Y)</Label>
              <Select
                value={config.methodId ?? ""}
                onValueChange={(v) => setConfig((c) => ({ ...c, methodId: v, fieldId: methods?.find((m) => m.id === v)?.fields[0]?.id ?? null }))}
              >
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  {(methods ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Field (Y)</Label>
              <Select value={config.fieldId ?? ""} onValueChange={(v) => set("fieldId", v)} disabled={!config.methodId}>
                <SelectTrigger><SelectValue placeholder="Select field" /></SelectTrigger>
                <SelectContent>
                  {fieldsForY.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.description}{f.unit ? ` (${f.unit})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Sample points</Label>
              <PointsMultiSelect
                items={samplePoints ?? []}
                selected={config.pointIds}
                onChange={(v) => set("pointIds", v)}
              />
            </div>

            {config.chartType === "scatter" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Method (X)</Label>
                  <Select
                    value={config.xMethodId ?? ""}
                    onValueChange={(v) => setConfig((c) => ({ ...c, xMethodId: v, xFieldId: methods?.find((m) => m.id === v)?.fields[0]?.id ?? null }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                    <SelectContent>
                      {(methods ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Field (X)</Label>
                  <Select value={config.xFieldId ?? ""} onValueChange={(v) => set("xFieldId", v)} disabled={!config.xMethodId}>
                    <SelectTrigger><SelectValue placeholder="Select field" /></SelectTrigger>
                    <SelectContent>
                      {fieldsForX.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.description}{f.unit ? ` (${f.unit})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Date range</Label>
              <Select
                value={String(config.rangeDays)}
                onValueChange={(v) => set("rangeDays", Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="180">Last 180 days</SelectItem>
                  <SelectItem value="365">Last 365 days</SelectItem>
                  <SelectItem value="0">Custom…</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.rangeDays === 0 && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !config.from && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {config.from ? format(parseISO(config.from), "PPP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={config.from ? parseISO(config.from) : undefined}
                        onSelect={(d) => set("from", d ? d.toISOString() : null)}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !config.to && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {config.to ? format(parseISO(config.to), "PPP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={config.to ? parseISO(config.to) : undefined}
                        onSelect={(d) => set("to", d ? d.toISOString() : null)}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}

            {config.chartType !== "scatter" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Aggregation</Label>
                  <Select value={config.aggregation} onValueChange={(v: Aggregation) => set("aggregation", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (raw points)</SelectItem>
                      <SelectItem value="avg">Average</SelectItem>
                      <SelectItem value="min">Minimum</SelectItem>
                      <SelectItem value="max">Maximum</SelectItem>
                      <SelectItem value="count">Count</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {config.aggregation !== "none" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Bucket</Label>
                    <Select value={config.bucket} onValueChange={(v: Bucket) => set("bucket", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Daily</SelectItem>
                        <SelectItem value="week">Weekly</SelectItem>
                        <SelectItem value="month">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="h-[480px] w-full rounded-md border bg-card p-2">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
            ) : !config.methodId || !config.fieldId ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Choose a method and field to begin.</div>
            ) : config.chartType === "scatter" && !xField ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Choose an X-axis method and field.</div>
            ) : chartSeries.length === 0 || chartSeries.every((s) => s.data.length === 0) ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data in this range.</div>
            ) : config.chartType === "line" ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mergedTimeData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                  <XAxis dataKey="x" tickFormatter={xTickFormatter} type="number" domain={["dataMin", "dataMax"]} scale="time" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} label={{ value: yLabel, angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
                  <Tooltip labelFormatter={(v) => format(new Date(Number(v)), "PPpp")} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {chartSeries.map((s) => (
                    <Line key={s.name} type="monotone" dataKey={s.name} stroke={s.color} dot={{ r: 2 }} strokeWidth={2} connectNulls />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : config.chartType === "bar" ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mergedTimeData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                  <XAxis dataKey="x" tickFormatter={xTickFormatter} type="number" domain={["dataMin", "dataMax"]} scale="time" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} label={{ value: yLabel, angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
                  <Tooltip labelFormatter={(v) => format(new Date(Number(v)), "PPpp")} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {chartSeries.map((s) => (
                    <Bar key={s.name} dataKey={s.name} fill={s.color} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                  <XAxis type="number" dataKey="x" name={xLabel} tick={{ fontSize: 11 }} label={{ value: xLabel, position: "insideBottom", offset: -5, style: { fontSize: 11 } }} />
                  <YAxis type="number" dataKey="y" name={yLabel} tick={{ fontSize: 11 }} label={{ value: yLabel, angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {chartSeries.map((s) => (
                    <Scatter key={s.name} name={s.name} data={s.data} fill={s.color} />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {chartSeries.reduce((acc, s) => acc + s.data.length, 0)} points across {chartSeries.length} series
            {" · "}
            {format(dateRange.from, "PP")} → {format(dateRange.to, "PP")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
