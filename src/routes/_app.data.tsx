import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Search, Download } from "lucide-react";

export const Route = createFileRoute("/_app/data")({
  head: () => ({ meta: [{ title: "Data View — LJ LIMS" }] }),
  component: DataView,
});

type Row = {
  id: string;
  sample_number: string;
  sampled_at: string | null;
  date_analyzed: string | null;
  color: string | null;
  oil_visibility: string | null;
  particulates: string | null;
  sample_point: string;
  analyst: string;
  readings: { method: string; field: string; unit: string | null; value: number | null }[];
};

function DataView() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "sampled_at", dir: "desc" });

  const { data, isLoading } = useQuery({
    queryKey: ["data_view"],
    queryFn: async () => {
      const { data: samples, error } = await supabase
        .from("samples")
        .select(`
          id, sample_number, sampled_at, date_analyzed, color, oil_visibility, particulates,
          sample_points!inner(name),
          profiles(full_name, email),
          sample_readings(value, method_fields!inner(description, unit, methods!inner(name)))
        `)
        .order("sampled_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const rows: Row[] = (samples ?? []).map((s: Record<string, unknown>) => ({
        id: s.id as string,
        sample_number: s.sample_number as string,
        sampled_at: s.sampled_at as string | null,
        date_analyzed: s.date_analyzed as string | null,
        color: s.color as string | null,
        oil_visibility: s.oil_visibility as string | null,
        particulates: s.particulates as string | null,
        sample_point: (s.sample_points as { name: string })?.name ?? "",
        analyst: ((s.profiles as { full_name?: string; email?: string } | null)?.full_name) ?? ((s.profiles as { email?: string } | null)?.email ?? ""),
        readings: ((s.sample_readings as Array<Record<string, unknown>>) ?? []).map((r) => {
          const mf = r.method_fields as { description: string; unit: string | null; methods: { name: string } };
          return { method: mf.methods.name, field: mf.description, unit: mf.unit, value: r.value as number | null };
        }),
      }));
      return rows;
    },
  });

  const rows = data ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.sample_number, r.sample_point, r.analyst, r.color, r.oil_visibility, r.particulates,
        ...r.readings.flatMap((x) => [x.method, x.field, String(x.value ?? "")]),
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

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

  const cols: { key: keyof Row; label: string }[] = [
    { key: "sample_number", label: "Sample #" },
    { key: "sample_point", label: "Sample Point" },
    { key: "analyst", label: "Analyst" },
    { key: "sampled_at", label: "Sampled" },
    { key: "date_analyzed", label: "Analyzed" },
    { key: "color", label: "Color" },
    { key: "oil_visibility", label: "Oil Vis." },
    { key: "particulates", label: "Particulates" },
  ];

  function toggleSort(k: string) {
    setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" }));
  }

  function exportCsv() {
    const headers = [...cols.map((c) => c.label), "Readings"];
    const lines = [headers.join(",")];
    sorted.forEach((r) => {
      const readings = r.readings.map((x) => `${x.method}:${x.field}=${x.value ?? ""}${x.unit ? x.unit : ""}`).join(" | ");
      const cells = [
        r.sample_number, r.sample_point, r.analyst,
        r.sampled_at ?? "", r.date_analyzed ?? "",
        r.color ?? "", r.oil_visibility ?? "", r.particulates ?? "",
        readings,
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `lj-lims-samples-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Data View</h1>
          <p className="text-sm text-muted-foreground">All samples across all methods. Sort, filter, search.</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search samples, methods, values…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          <div className="rounded-md border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-muted-foreground sticky top-0">
                <tr>
                  {cols.map((c) => (
                    <th key={c.key as string} className="text-left font-medium px-3 py-2 whitespace-nowrap">
                      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(c.key as string)}>
                        {c.label}<ArrowUpDown className="h-3 w-3 opacity-60" />
                      </button>
                    </th>
                  ))}
                  <th className="text-left font-medium px-3 py-2">Readings</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={cols.length + 1} className="px-3 py-8 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {!isLoading && sorted.length === 0 && (
                  <tr><td colSpan={cols.length + 1} className="px-3 py-12 text-center text-muted-foreground">No samples found.</td></tr>
                )}
                {sorted.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/40">
                    <td className="px-3 py-2 font-mono">{r.sample_number}</td>
                    <td className="px-3 py-2">{r.sample_point}</td>
                    <td className="px-3 py-2">{r.analyst}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{r.sampled_at?.replace("T", " ").slice(0, 16) ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{r.date_analyzed ?? "—"}</td>
                    <td className="px-3 py-2">{r.color ?? "—"}</td>
                    <td className="px-3 py-2">{r.oil_visibility ?? "—"}</td>
                    <td className="px-3 py-2 max-w-[180px] truncate">{r.particulates ?? "—"}</td>
                    <td className="px-3 py-2">
                      {r.readings.length === 0 ? <span className="text-muted-foreground">—</span> : (
                        <div className="flex flex-wrap gap-1">
                          {r.readings.map((x, i) => (
                            <span key={i} className="inline-flex items-center rounded bg-secondary text-secondary-foreground px-2 py-0.5 text-xs">
                              <span className="text-muted-foreground mr-1">{x.method}·{x.field}:</span>
                              <span className="font-mono">{x.value ?? "—"}{x.unit ? ` ${x.unit}` : ""}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">{sorted.length} of {rows.length} samples shown.</p>
        </CardContent>
      </Card>
    </div>
  );
}
