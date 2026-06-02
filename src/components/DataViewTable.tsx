import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUpDown, Search, Download, ChevronDown, Maximize2 } from "lucide-react";

type MethodField = { id: string; description: string; unit: string | null; position: number };
type Method = { id: string; name: string; fields: MethodField[] };

// Format sampled_at in the user's LOCAL timezone so it matches what the
// Sample Entry form shows (which reads getHours/getMinutes/getDate locally).
function formatSampledAt(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const isMidnight = d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;
  return isMidnight ? date : `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Row = {
  id: string;
  sample_number: string;
  sampled_at: string | null;
  date_analyzed: string | null;
  color: string | null;
  oil_visibility: string | null;
  particulates: string | null;
  sample_point_id: string;
  sample_point: string;
  analyst: string;
  readingByFieldId: Record<string, string | null>;
};

function MultiSelect({
  label,
  items,
  selected,
  onChange,
  onOpenChange,
}: {
  label: string;
  items: { id: string; name: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const allSelected = items.length > 0 && selected.size === items.length;
  const summary =
    selected.size === 0
      ? "None"
      : allSelected
      ? "All"
      : `${selected.size} selected`;
  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="justify-between gap-2 min-w-[220px] border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary text-foreground shadow-sm"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded-full bg-primary/15 text-primary text-[10px] font-semibold px-2 py-0.5">
              {selected.size}/{items.length}
            </span>
            <span className="text-xs text-muted-foreground">{summary}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="flex items-center justify-between px-1 pb-2 border-b mb-2">
          <span className="text-xs font-medium">{label}</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => onChange(new Set(items.map((i) => i.id)))}
            >
              All
            </button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:underline"
              onClick={() => onChange(new Set())}
            >
              None
            </button>
          </div>
        </div>
        <div className="max-h-64 overflow-auto space-y-1">
          {items.length === 0 && <p className="text-xs text-muted-foreground px-1">No items.</p>}
          {items.map((i) => {
            const checked = selected.has(i.id);
            return (
              <label
                key={i.id}
                className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer text-sm"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    const next = new Set(selected);
                    if (v) next.add(i.id);
                    else next.delete(i.id);
                    onChange(next);
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

export function DataViewTable({ fillHeight = false, onExpand }: { fillHeight?: boolean; onExpand?: () => void } = {}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "sampled_at", dir: "desc" });
  const [selectedMethods, setSelectedMethods] = useState<Set<string>>(new Set());
  const [selectedPoints, setSelectedPoints] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 100;

  const { data: methods } = useQuery({
    queryKey: ["data_view_methods"],
    queryFn: async (): Promise<Method[]> => {
      const { data, error } = await supabase
        .from("methods")
        .select("id, name, method_fields(id, description, unit, position, hidden)")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m) => ({
        id: m.id as string,
        name: m.name as string,
        fields: ((m.method_fields as MethodField[] & { hidden: boolean }[]) ?? [])
          .filter((f) => !(f as MethodField & { hidden: boolean }).hidden)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((f) => ({ id: f.id, description: f.description, unit: f.unit, position: f.position })),
      }));
    },
  });

  const { data: samplePoints } = useQuery({
    queryKey: ["data_view_points"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sample_points").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["data_view"],
    queryFn: async () => {
      const { data: samples, error } = await supabase
        .from("samples")
        .select(`
          id, sample_number, sampled_at, date_analyzed, color, oil_visibility, particulates, analyst_id, sample_point_id,
          sample_points!inner(name),
          sample_readings(value, method_field_id)
        `)
        .order("sampled_at", { ascending: false })
        .limit(1000);
      if (error) throw error;

      const analystIds = Array.from(new Set((samples ?? []).map((s: Record<string, unknown>) => s.analyst_id).filter(Boolean))) as string[];
      const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
      if (analystIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", analystIds);
        (profs ?? []).forEach((p) => profileMap.set(p.id, { full_name: p.full_name, email: p.email }));
      }

      const rows: Row[] = (samples ?? []).map((s: Record<string, unknown>) => {
        const prof = profileMap.get(s.analyst_id as string);
        const readingByFieldId: Record<string, string | null> = {};
        ((s.sample_readings as Array<{ value: string | null; method_field_id: string }>) ?? []).forEach((r) => {
          readingByFieldId[r.method_field_id] = r.value;
        });
        return {
          id: s.id as string,
          sample_number: s.sample_number as string,
          sampled_at: s.sampled_at as string | null,
          date_analyzed: s.date_analyzed as string | null,
          color: s.color as string | null,
          oil_visibility: s.oil_visibility as string | null,
          particulates: s.particulates as string | null,
          sample_point_id: s.sample_point_id as string,
          sample_point: (s.sample_points as { name: string })?.name ?? "",
          analyst: prof?.full_name ?? prof?.email ?? "",
          readingByFieldId,
        };
      });
      return rows;
    },
  });

  useEffect(() => {
    if (methods && selectedMethods.size === 0) {
      setSelectedMethods(new Set(methods.map((m) => m.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methods]);
  useEffect(() => {
    if (samplePoints && selectedPoints.size === 0) {
      setSelectedPoints(new Set(samplePoints.map((p) => p.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samplePoints]);

  const rows = data ?? [];

  const visibleMethods = useMemo(
    () => (methods ?? []).filter((m) => selectedMethods.has(m.id) && m.fields.length > 0),
    [methods, selectedMethods]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visibleFieldIds = visibleMethods.flatMap((m) => m.fields.map((f) => f.id));
    return rows.filter((r) => {
      if (selectedPoints.size > 0 && !selectedPoints.has(r.sample_point_id)) return false;
      // Require at least one reading for a field belonging to a selected method
      const hasReadingForSelectedMethod = visibleFieldIds.some((fid) => {
        const v = r.readingByFieldId[fid];
        return v !== undefined && v !== null && String(v).trim() !== "";
      });
      if (!hasReadingForSelectedMethod) return false;
      if (!q) return true;
      const readingStrs = visibleMethods.flatMap((m) =>
        m.fields.map((f) => String(r.readingByFieldId[f.id] ?? "")),
      );
      const hay = [
        r.sample_number, r.sample_point, r.analyst, r.color, r.oil_visibility, r.particulates,
        ...readingStrs,
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, selectedPoints, visibleMethods]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sort.key] ?? "";
      const bv = (b as unknown as Record<string, unknown>)[sort.key] ?? "";
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort]);

  // Reset to first page when filters/search/sort change
  useEffect(() => {
    setPage(0);
  }, [query, selectedMethods, selectedPoints, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageStart = currentPage * PAGE_SIZE;
  const pageRows = sorted.slice(pageStart, pageStart + PAGE_SIZE);

  const metaCols: { key: keyof Row; label: string; width: number; sticky?: number }[] = [
    { key: "sample_number", label: "Sample #", width: 140, sticky: 0 },
    { key: "sampled_at", label: "Sampled", width: 150, sticky: 140 },
    { key: "sample_point", label: "Sample Point", width: 160, sticky: 290 },
    { key: "analyst", label: "Analyst", width: 140 },
    { key: "date_analyzed", label: "Analyzed", width: 120 },
    { key: "color", label: "Color", width: 100 },
    { key: "oil_visibility", label: "Oil Vis.", width: 100 },
    { key: "particulates", label: "Particulates", width: 180 },
  ];

  function toggleSort(k: string) {
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" }));
  }

  const totalFieldCols = visibleMethods.reduce((acc, m) => acc + m.fields.length, 0);
  const totalCols = metaCols.length + totalFieldCols;

  function exportCsv() {
    const headerTop: string[] = [
      ...metaCols.map((c) => c.label),
      ...visibleMethods.flatMap((m) => m.fields.map((f) => `${m.name} · ${f.description}${f.unit ? ` (${f.unit})` : ""}`)),
    ];
    const lines = [headerTop.join(",")];
    sorted.forEach((r) => {
      const cells: string[] = [
        r.sample_number,
        r.sampled_at ?? "",
        r.sample_point,
        r.analyst,
        r.date_analyzed ?? "",
        r.color ?? "", r.oil_visibility ?? "", r.particulates ?? "",
        ...visibleMethods.flatMap((m) =>
          m.fields.map((f) => {
            const v = r.readingByFieldId[f.id];
            return v === undefined || v === null ? "" : String(v);
          }),
        ),
      ];
      lines.push(cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `lj-lims-samples-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className={fillHeight ? "h-full flex flex-col" : ""}>
      <CardContent className={`p-2 space-y-2 ${fillHeight ? "flex-1 flex flex-col min-h-0" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 h-9" placeholder="Search samples, methods, values…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <MultiSelect
            label="Methods"
            items={(methods ?? []).map((m) => ({ id: m.id, name: m.name }))}
            selected={selectedMethods}
            onChange={setSelectedMethods}
            onOpenChange={(open) => {
              if (open && methods && methods.length > 0 && selectedMethods.size === methods.length) {
                setSelectedMethods(new Set());
              }
            }}
          />
          <MultiSelect
            label="Sample Points"
            items={samplePoints ?? []}
            selected={selectedPoints}
            onChange={setSelectedPoints}
          />
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" />Export CSV
          </Button>
          {onExpand && (
            <Button variant="secondary" size="sm" onClick={onExpand} className="border border-primary/30 shadow-sm ml-auto">
              <Maximize2 className="h-4 w-4 mr-1.5" />Expand
            </Button>
          )}
        </div>

        <div className={`rounded-md border overflow-auto ${fillHeight ? "flex-1 min-h-0" : "max-h-[calc(100vh-200px)]"}`}>
          <table className="w-full text-sm border-collapse">
            <thead className="text-muted-foreground">
              <tr>
                {metaCols.map((c) => (
                  <th
                    key={c.key as string}
                    rowSpan={2}
                    style={{
                      width: c.width,
                      minWidth: c.width,
                      ...(c.sticky !== undefined ? { left: c.sticky } : {}),
                    }}
                    className={`text-left font-medium px-3 py-2 whitespace-nowrap border-b align-bottom bg-muted ${
                      c.sticky !== undefined ? "sticky z-30" : "sticky top-0 z-20"
                    } ${c.sticky !== undefined ? "top-0" : ""} ${
                      c.sticky !== undefined && c.sticky > 0 ? "border-l" : ""
                    }`}
                  >
                    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(c.key as string)}>
                      {c.label}<ArrowUpDown className="h-3 w-3 opacity-60" />
                    </button>
                  </th>
                ))}
                {visibleMethods.map((m) => (
                  <th
                    key={m.id}
                    colSpan={m.fields.length}
                    className="text-center font-semibold text-foreground px-3 py-2 border-b border-l whitespace-nowrap bg-muted sticky top-0 z-10"
                  >
                    {m.name}
                  </th>
                ))}
              </tr>
              <tr>
                {visibleMethods.flatMap((m) =>
                  m.fields.map((f, idx) => (
                    <th
                      key={f.id}
                      className={`text-left font-medium px-3 py-2 whitespace-nowrap border-b text-xs bg-muted sticky z-10 ${idx === 0 ? "border-l" : ""}`}
                      style={{ top: 37 }}
                    >
                      {f.description}
                      {f.unit ? <span className="text-muted-foreground"> ({f.unit})</span> : null}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={totalCols} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && sorted.length === 0 && (
                <tr><td colSpan={totalCols} className="px-3 py-12 text-center text-muted-foreground">No samples found.</td></tr>
              )}
              {pageRows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/40 group">
                  <td className="px-3 py-2 font-mono sticky left-0 z-10 bg-background group-hover:bg-muted" style={{ width: 140, minWidth: 140 }}>{r.sample_number}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground sticky z-10 bg-background group-hover:bg-muted border-l" style={{ left: 140, width: 150, minWidth: 150 }}>{formatSampledAt(r.sampled_at)}</td>
                  <td className="px-3 py-2 sticky z-10 bg-background group-hover:bg-muted border-l" style={{ left: 290, width: 160, minWidth: 160 }}>{r.sample_point}</td>
                  <td className="px-3 py-2">{r.analyst}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{r.date_analyzed ?? "—"}</td>
                  <td className="px-3 py-2">{r.color ?? "—"}</td>
                  <td className="px-3 py-2">{r.oil_visibility ?? "—"}</td>
                  <td className="px-3 py-2 max-w-[180px] truncate">{r.particulates ?? "—"}</td>
                  {visibleMethods.flatMap((m) =>
                    m.fields.map((f, idx) => {
                      const v = r.readingByFieldId[f.id];
                      return (
                        <td
                          key={f.id}
                          className={`px-3 py-2 font-mono text-xs whitespace-nowrap ${idx === 0 ? "border-l" : ""}`}
                        >
                          {v === undefined || v === null ? <span className="text-muted-foreground">—</span> : v}
                        </td>
                      );
                    }),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-muted-foreground">
            {sorted.length === 0
              ? "0 samples"
              : `Showing ${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, sorted.length)} of ${sorted.length} samples (${rows.length} loaded)`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage <= 0}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              Page {currentPage + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
