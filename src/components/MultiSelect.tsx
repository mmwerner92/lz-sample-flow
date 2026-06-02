import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";

export function MultiSelect({
  label,
  items,
  selected,
  onChange,
  onOpenChange,
  triggerClassName,
}: {
  label: string;
  items: { id: string; name: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  onOpenChange?: (open: boolean) => void;
  triggerClassName?: string;
}) {
  const allSelected = items.length > 0 && selected.size === items.length;
  const summary =
    selected.size === 0 ? "None" : allSelected ? "All" : `${selected.size} selected`;
  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={
            triggerClassName ??
            "justify-between gap-2 min-w-[220px] border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary text-foreground shadow-sm"
          }
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
