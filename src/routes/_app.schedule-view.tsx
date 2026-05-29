import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_app/schedule-view")({
  head: () => ({ meta: [{ title: "Sample Schedule — LJ LIMS" }] }),
  component: SampleScheduleView,
});

type SamplePoint = { id: string; name: string };
type ScheduleRow = {
  id: string;
  sample_point_id: string;
  time_of_day: string;
  status: string;
  next_trigger_at: string;
};

function SampleScheduleView() {
  const { data: samplePoints = [] } = useQuery({
    queryKey: ["sample_points"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sample_points").select("*").order("name");
      if (error) throw error;
      return data as SamplePoint[];
    },
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["sample_schedules_view"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sample_schedules")
        .select("*")
        .order("next_trigger_at");
      if (error) throw error;
      return data as ScheduleRow[];
    },
  });

  const pointName = (id: string) =>
    samplePoints.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Sample Schedule</h1>
        <p className="text-xs text-muted-foreground">Currently scheduled samples.</p>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Scheduled samples</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sample Point</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-6">
                      No scheduled samples.
                    </TableCell>
                  </TableRow>
                )}
                {schedules.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{pointName(s.sample_point_id)}</TableCell>
                    <TableCell className="font-mono">{s.time_of_day.slice(0, 5)}</TableCell>
                    <TableCell>{s.status}</TableCell>
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
