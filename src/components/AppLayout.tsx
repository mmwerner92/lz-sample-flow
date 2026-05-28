import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { FlaskConical, BeakerIcon, Table2, LogOut } from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { to: "/samples", label: "Sample Entry", icon: BeakerIcon },
  { to: "/methods", label: "Methods", icon: FlaskConical },
  { to: "/data", label: "Data View", icon: Table2 },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, user, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-64 flex-col bg-sidebar text-sidebar-foreground">
        <div className="px-6 py-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-bold">
              LJ
            </div>
            <div>
              <div className="font-semibold tracking-tight">LJ LIMS</div>
              <div className="text-xs text-sidebar-foreground/60">LanzaJet, Inc.</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((n) => {
            const active = pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border px-4 py-3">
          <div className="text-sm font-medium truncate">{profile?.full_name ?? user?.email}</div>
          <div className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</div>
          <Button variant="ghost" size="sm" className="mt-2 w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
