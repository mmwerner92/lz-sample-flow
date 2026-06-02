import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DataViewTable } from "@/components/DataViewTable";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";

export const Route = createFileRoute("/_app/data")({
  head: () => ({ meta: [{ title: "Data View — LJ LIMS" }] }),
  component: DataView,
});

function DataView() {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center justify-between border-b px-3 py-1.5">
          <h1 className="text-sm font-semibold tracking-tight">Data View</h1>
          <Button variant="outline" size="sm" onClick={() => setExpanded(false)}>
            <Minimize2 className="h-4 w-4 mr-1.5" />Collapse
          </Button>
        </div>
        <div className="flex-1 overflow-hidden p-2">
          <DataViewTable fillHeight />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Data View</h1>
        <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
          <Maximize2 className="h-4 w-4 mr-1.5" />Expand
        </Button>
      </div>
      <DataViewTable />
    </div>
  );
}
