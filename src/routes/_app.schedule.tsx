import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  FREQUENCIES,
  SAMPLE_STATUSES,
  type Frequency,
  type SampleStatus,
  computeNextTrigger,
  formatNextTrigger,
} from "@/lib/schedule";

export const Route = createFileRoute("/_app/schedule")({
  head: () => ({ meta: [{ title: "Schedule Samples — LJ LIMS" }] }),
  component: ScheduleSamples,
});

type SamplePoint = { id: string; name: string };
type ScheduleRow = {
  id: string;
  sample_point_id: string;
  time_of_day: string;
  frequency: Frequency;
  status: SampleStatus;
  next_trigger_at: string;
};

function ScheduleSamples() {
  const qc = useQueryClient();
  const { data: samplePoints = [] } = useQuery({
    queryKey: ["sample_points"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sample_points")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as SamplePoint[];
    },
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["sample_schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sample_schedules")
        .select("*")
        .order("next_trigger_at");
      if (error) throw error;
      return data as ScheduleRow[];
    },
  });

  const [samplePointId, setSamplePointId] = useState("");
  const [time, setTime] = useState("08:00");
  const [frequency, setFrequency] = useState<Frequency>("Weekly");
  const [status, setStatus] = useState<SampleStatus>("Open");

  const pointName = (id: string) =>
    samplePoints.find((p) => p.id === id)?.name ?? "—";

  async function createSchedule() {
    if (!samplePointId || !time) {
      toast.error("Sample point and time are required.");
      return;
    }
    const next = computeNextTrigger(time, frequency);
    const { error } = await supabase.from("sample_schedules").insert({
      sample_point_id: samplePointId,
      time_of_day: time,
      frequency,
      status,
      next_trigger_at: next.toISOString(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Schedule created");
    qc.invalidateQueries({ queryKey: ["sample_schedules"] });
    setSamplePointId("");
  }

  async function deleteSchedule(id: string) {
    if (!confirm("Delete this schedule?")) return;
    const { error } = await supabase.from("sample_schedules").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["sample_schedules"] });
    qc.invalidateQueries({ queryKey: ["sample_schedules_view"] });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Schedule Samples</h1>
        <p className="text-sm text-muted-foreground">
          Create recurring sample schedules and view what is upcoming.
        </p>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">New schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Sample Point</Label>
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
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Time</Label>
              <Input
                type="time"
                className="h-9"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as SampleStatus)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
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
            <div className="md:col-span-5 flex justify-end">
              <Button size="sm" onClick={createSchedule}>
                <Plus className="h-4 w-4 mr-1" /> Add schedule
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Existing schedules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sample Point</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next trigger</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-6">
                      No schedules yet.
                    </TableCell>
                  </TableRow>
                )}
                {schedules.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{pointName(s.sample_point_id)}</TableCell>
                    <TableCell className="font-mono">{s.time_of_day.slice(0, 5)}</TableCell>
                    <TableCell>{s.frequency}</TableCell>
                    <TableCell>{s.status}</TableCell>
                    <TableCell>{formatNextTrigger(s.next_trigger_at)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteSchedule(s.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
