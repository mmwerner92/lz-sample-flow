import { createFileRoute, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/AppLayout";
import { canAccess, useMyRole, type AppRole } from "@/lib/use-my-role";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

// Landing path per role when their requested page is blocked
const HOME_FOR_ROLE: Record<AppRole, string> = {
  admin: "/samples",
  editor: "/samples",
  operations: "/data",
  user: "/samples",
};

function AppShell() {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const me = useMyRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;

  // While role is loading, render the shell without inner content to avoid flashing protected pages
  const role = (me.data?.role ?? null) as AppRole | null;
  if (role && !canAccess(role, pathname)) {
    return <Navigate to={HOME_FOR_ROLE[role]} />;
  }

  return (
    <AppLayout>
      {me.isLoading && !me.data ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <Outlet />
      )}
    </AppLayout>
  );
}
