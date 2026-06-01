import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole } from "@/lib/use-my-role";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/imports")({
  head: () => ({ meta: [{ title: "Imports — LJ LIMS" }] }),
  component: ImportsPage,
});

type MethodField = { id: string; description: string; unit: string | null; position: number };
type Method = { id: string; name: string; fields: MethodField[] };

type ParsedRow = {
  rowIndex: number;
  sample_number: string;
  sampled_at: string | null; // ISO
  sample_point_name: string;
  analyst_name: string;
  date_analyzed: string | null;
  color: string | null;
  oil_visibility: string | null;
  particulates: string | null;
  notes: string | null;
  status: string | null;
  readings: { method_field_id: string; value: number | null }[];
  action: "insert" | "update" | "error";
  matchedSampleId?: string;
  resolvedAnalystId: string | null;
  analystMissing: boolean;
  resolvedSamplePointId: string | null;
  errors: string[];
};

const META_HEADERS = [
  "Sample #",
  "Sampled",
  "Sample Point",
  "Analyst",
  "Analyzed",
  "Color",
  "Oil Vis.",
  "Particulates",
  "Notes",
  "Status",
];

function fieldHeader(method: Method, f: MethodField) {
  return `${method.name} · ${f.description}${f.unit ? ` (${f.unit})` : ""}`;
}

function toISO(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H ?? 0, d.M ?? 0, Math.floor(d.S ?? 0))).toISOString();
  }
  const s = String(v).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function toDateOnly(v: unknown): string | null {
  const iso = toISO(v);
  return iso ? iso.slice(0, 10) : null;
}

function ImportsPage() {
  const { user } = useAuth();
  const role = useMyRole();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const { data: methods } = useQuery({
    queryKey: ["import_methods"],
    queryFn: async (): Promise<Method[]> => {
      const { data, error } = await supabase
        .from("methods")
        .select("id, name, method_fields(id, description, unit, position, hidden)")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((m) => ({
        id: m.id as string,
        name: m.name as string,
        fields: ((m.method_fields as Array<MethodField & { hidden: boolean }>) ?? [])
          .filter((f) => !f.hidden)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((f) => ({ id: f.id, description: f.description, unit: f.unit, position: f.position })),
      }));
    },
  });

  const { data: samplePoints } = useQuery({
    queryKey: ["import_points"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sample_points").select("id, name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["import_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email");
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
  });

  const headerList = useMemo(() => {
    if (!methods) return [];
    return [
      ...META_HEADERS,
      ...methods.flatMap((m) => m.fields.map((f) => fieldHeader(m, f))),
    ];
  }, [methods]);

  // Gate: admin or editor only
  if (role.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }
  const r = role.data?.role;
  if (r !== "admin" && r !== "editor") {
    return <Navigate to="/data" />;
  }

  function downloadTemplate() {
    if (!methods) return;
    const headers = headerList;
    // Example row to show formatting
    const example: Record<string, string | number> = {};
    headers.forEach((h) => (example[h] = ""));
    example["Sample #"] = "EXAMPLE-001";
    example["Sampled"] = new Date().toISOString().slice(0, 16).replace("T", " ");
    example["Sample Point"] = samplePoints?.[0]?.name ?? "";
    example["Analyst"] = profiles?.[0]?.full_name ?? profiles?.[0]?.email ?? "";

    const ws = XLSX.utils.json_to_sheet([example], { header: headers });
    // Set column widths
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(12, Math.min(40, h.length + 2)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Samples");
    XLSX.writeFile(wb, `lj-lims-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function onFile(file: File) {
    if (!methods || !samplePoints || !profiles) return;
    setParsing(true);
    setRows(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });

      // Build lookup maps
      const pointByName = new Map(samplePoints.map((p) => [p.name.trim().toLowerCase(), p.id]));
      const profileLookup = new Map<string, string>();
      profiles.forEach((p) => {
        if (p.full_name) profileLookup.set(p.full_name.trim().toLowerCase(), p.id);
        if (p.email) profileLookup.set(p.email.trim().toLowerCase(), p.id);
      });

      // field header → method_field_id
      const fieldByHeader = new Map<string, string>();
      methods.forEach((m) => m.fields.forEach((f) => fieldByHeader.set(fieldHeader(m, f), f.id)));

      // Collect candidate (sample_number, sampled_at) pairs to look up existing samples
      const parsed: ParsedRow[] = raw.map((r, idx) => {
        const errors: string[] = [];
        const sample_number = String(r["Sample #"] ?? "").trim();
        if (!sample_number) errors.push("Missing Sample #");
        const sampled_at = toISO(r["Sampled"]);
        const sample_point_name = String(r["Sample Point"] ?? "").trim();
        const resolvedSamplePointId = sample_point_name
          ? pointByName.get(sample_point_name.toLowerCase()) ?? null
          : null;
        if (!sample_point_name) errors.push("Missing Sample Point");

        const analyst_name = String(r["Analyst"] ?? "").trim();
        const resolvedAnalystId = analyst_name
          ? profileLookup.get(analyst_name.toLowerCase()) ?? null
          : null;
        const analystMissing = !!analyst_name && !resolvedAnalystId;

        const readings: { method_field_id: string; value: number | null }[] = [];
        fieldByHeader.forEach((fieldId, header) => {
          const raw = r[header];
          if (raw === null || raw === undefined || raw === "") return;
          const num = typeof raw === "number" ? raw : Number(String(raw).trim());
          if (Number.isNaN(num)) {
            errors.push(`Non-numeric value in "${header}"`);
          } else {
            readings.push({ method_field_id: fieldId, value: num });
          }
        });

        return {
          rowIndex: idx + 2, // header is row 1
          sample_number,
          sampled_at,
          sample_point_name,
          analyst_name,
          date_analyzed: toDateOnly(r["Analyzed"]),
          color: (r["Color"] as string | null) || null,
          oil_visibility: (r["Oil Vis."] as string | null) || null,
          particulates: (r["Particulates"] as string | null) || null,
          notes: (r["Notes"] as string | null) || null,
          status: (r["Status"] as string | null) || null,
          readings,
          action: errors.length ? "error" : "insert",
          resolvedAnalystId,
          analystMissing,
          resolvedSamplePointId,
          errors,
        };
      });

      // Look up existing samples for (sample_number) — then match exact sampled_at
      const numbers = Array.from(new Set(parsed.map((p) => p.sample_number).filter(Boolean)));
      let existing: { id: string; sample_number: string; sampled_at: string | null }[] = [];
      if (numbers.length > 0) {
        const { data, error } = await supabase
          .from("samples")
          .select("id, sample_number, sampled_at")
          .in("sample_number", numbers);
        if (error) throw error;
        existing = data ?? [];
      }
      const existMap = new Map<string, { id: string; sampled_at: string | null }[]>();
      existing.forEach((e) => {
        const arr = existMap.get(e.sample_number) ?? [];
        arr.push({ id: e.id, sampled_at: e.sampled_at });
        existMap.set(e.sample_number, arr);
      });

      parsed.forEach((p) => {
        if (p.action === "error") return;
        const matches = existMap.get(p.sample_number) ?? [];
        // exact match on sampled_at (ISO compare, both normalized)
        const exact = matches.find((m) => {
          if (!m.sampled_at || !p.sampled_at) return false;
          return new Date(m.sampled_at).getTime() === new Date(p.sampled_at).getTime();
        });
        if (exact) {
          p.action = "update";
          p.matchedSampleId = exact.id;
        } else {
          p.action = "insert";
        }
      });

      setRows(parsed);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to parse file";
      toast.error(msg);
      setRows(null);
    } finally {
      setParsing(false);
    }
  }

  async function commit() {
    if (!rows || !user) return;
    setCommitting(true);
    let inserted = 0;
    let updated = 0;
    let failed = 0;
    try {
      // Auto-create any sample points referenced but not found
      const newPointNames = Array.from(
        new Set(
          rows
            .filter((r) => r.action !== "error" && !r.resolvedSamplePointId && r.sample_point_name)
            .map((r) => r.sample_point_name),
        ),
      );
      const createdPointMap = new Map<string, string>();
      if (newPointNames.length > 0) {
        const { data, error } = await supabase
          .from("sample_points")
          .insert(newPointNames.map((name) => ({ name })))
          .select("id, name");
        if (error) throw error;
        (data ?? []).forEach((p) => createdPointMap.set(p.name.toLowerCase(), p.id as string));
      }

      for (const r of rows) {
        if (r.action === "error") continue;
        try {
          const samplePointId =
            r.resolvedSamplePointId ?? createdPointMap.get(r.sample_point_name.toLowerCase()) ?? null;
          if (!samplePointId) throw new Error("Could not resolve sample point");
          const samplePayload = {
            sample_number: r.sample_number,
            sampled_at: r.sampled_at,
            sample_point_id: samplePointId,
            analyst_id: r.resolvedAnalystId, // null if missing — labelled "!Missing!" in UI
            date_analyzed: r.date_analyzed,
            color: r.color,
            oil_visibility: r.oil_visibility,
            particulates: r.particulates,
            notes: r.notes,
            status: r.status,
          };

          let sampleId: string;
          if (r.action === "update" && r.matchedSampleId) {
            const { error } = await supabase
              .from("samples")
              .update(samplePayload)
              .eq("id", r.matchedSampleId);
            if (error) throw error;
            sampleId = r.matchedSampleId;
            // Wipe existing readings for the fields we're about to write
            if (r.readings.length > 0) {
              const fieldIds = r.readings.map((x) => x.method_field_id);
              await supabase
                .from("sample_readings")
                .delete()
                .eq("sample_id", sampleId)
                .in("method_field_id", fieldIds);
            }
            updated += 1;
          } else {
            const { data, error } = await supabase
              .from("samples")
              .insert(samplePayload)
              .select("id")
              .single();
            if (error) throw error;
            sampleId = data.id as string;
            inserted += 1;
          }

          if (r.readings.length > 0) {
            const payload = r.readings.map((x) => ({
              sample_id: sampleId,
              method_field_id: x.method_field_id,
              value: x.value,
            }));
            const { error } = await supabase.from("sample_readings").insert(payload);
            if (error) throw error;
          }
        } catch (e) {
          failed += 1;
          const msg = e instanceof Error ? e.message : "unknown error";
          r.errors.push(`Import failed: ${msg}`);
          r.action = "error";
        }
      }
      toast.success(`Import complete: ${inserted} added, ${updated} updated${failed ? `, ${failed} failed` : ""}`);
      setRows([...rows]);
    } finally {
      setCommitting(false);
    }
  }

  const summary = rows
    ? {
        insert: rows.filter((r) => r.action === "insert").length,
        update: rows.filter((r) => r.action === "update").length,
        error: rows.filter((r) => r.action === "error").length,
        missingAnalyst: rows.filter((r) => r.analystMissing).length,
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Imports</h1>
        <p className="text-sm text-muted-foreground">
          Download the template, fill it out, then upload to preview and import samples.
        </p>
      </div>

      <Card>
        <CardContent className="p-6 flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={downloadTemplate} disabled={!methods}>
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={parsing || !methods}>
            {parsing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {parsing ? "Parsing…" : "Choose File to Import"}
          </Button>
          {fileName && (
            <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <FileSpreadsheet className="h-3 w-3" />
              {fileName}
            </div>
          )}
        </CardContent>
      </Card>

      {rows && summary && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                  {summary.insert} to insert
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                  {summary.update} to update
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-destructive" />
                  {summary.error} errors
                </span>
                {summary.missingAnalyst > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {summary.missingAnalyst} will use !Missing! analyst
                  </span>
                )}
              </div>
              <Button
                onClick={commit}
                disabled={committing || summary.insert + summary.update === 0}
              >
                {committing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Confirm Import ({summary.insert + summary.update})
              </Button>
            </div>

            <div className="rounded-md border overflow-auto max-h-[60vh]">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-muted/60 sticky top-0">
                  <tr>
                    <th className="text-left font-medium px-2 py-2">Row</th>
                    <th className="text-left font-medium px-2 py-2">Action</th>
                    <th className="text-left font-medium px-2 py-2">Sample #</th>
                    <th className="text-left font-medium px-2 py-2">Sampled</th>
                    <th className="text-left font-medium px-2 py-2">Sample Point</th>
                    <th className="text-left font-medium px-2 py-2">Analyst</th>
                    <th className="text-left font-medium px-2 py-2">Readings</th>
                    <th className="text-left font-medium px-2 py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rowIndex} className="border-t hover:bg-muted/30">
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">{r.rowIndex}</td>
                      <td className="px-2 py-1.5">
                        {r.action === "insert" && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 text-[10px] font-medium uppercase">
                            Insert
                          </span>
                        )}
                        {r.action === "update" && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-300 bg-blue-500/10 text-[10px] font-medium uppercase">
                            Update
                          </span>
                        )}
                        {r.action === "error" && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-destructive bg-destructive/10 text-[10px] font-medium uppercase">
                            Error
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 font-mono">{r.sample_number || "—"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                        {r.sampled_at?.replace("T", " ").slice(0, 16) ?? "—"}
                      </td>
                      <td className="px-2 py-1.5">
                        {r.sample_point_name || "—"}
                        {r.sample_point_name && !r.resolvedSamplePointId && (
                          <span className="ml-1 text-[10px] uppercase font-medium text-emerald-700 dark:text-emerald-300">
                            (new)
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {r.analystMissing ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            !Missing! ({r.analyst_name})
                          </span>
                        ) : (
                          r.analyst_name || <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.readings.length}</td>
                      <td className="px-2 py-1.5">
                        {r.errors.length > 0 && (
                          <span className="text-destructive">{r.errors.join("; ")}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
