import { createFileRoute } from "@tanstack/react-router";
import { DataViewTable } from "@/components/DataViewTable";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_app/data")({
  head: () => ({ meta: [{ title: "Data View — LJ LIMS" }] }),
  component: DataView,
});

function DataView() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Data View</h1>
          <p className="text-sm text-muted-foreground">All samples across all methods. Sort, filter, search.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.open("/data-popup", "_blank")}>
          <ExternalLink className="h-4 w-4 mr-2" />Pop-Out
        </Button>
      </div>
      <DataViewTable />
    </div>
  );
}
