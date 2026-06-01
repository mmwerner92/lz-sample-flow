import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useMyRole, canAccess, type AppRole } from "@/lib/use-my-role";
import { DataViewTable } from "@/components/DataViewTable";
import { X } from "lucide-react";

const HOME_FOR_ROLE: Record<AppRole, string> = {
  admin: "/samples",
  editor: "/samples",
  operations: "/data",
  user: "/samples",
};

export const Route = createFileRoute("/data-popup")({
  head: () => ({ meta: [{ title: "Data View — LJ LIMS" }] }),
  component: DataPopupPage,
});

function DataPopupPage() {
  const { user, loading } = useAuth();
  const me = useMyRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;

  const role = (me.data?.role ?? null) as AppRole | null;
  if (role && !canAccess(role, "/data")) {
    return <Navigate to={HOME_FOR_ROLE[role]} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Data View</h1>
          <p className="text-xs text-muted-foreground">All samples across all methods. Sort, filter, search.</p>
        </div>
        <Link
          to="/data"
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          <X className="h-4 w-4" />
          Close
        </Link>
      </header>
      <main className="p-4">
        {me.isLoading && !me.data ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <DataViewTable />
        )}
      </main>
    </div>
  );
}
