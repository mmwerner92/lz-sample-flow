import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { FlaskConical, BeakerIcon, Table2, LogOut, Users, Package, History, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyAdminStatus } from "@/lib/admin-users.functions";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const baseNav = [
  { to: "/samples", label: "Sample Entry", icon: BeakerIcon },
  { to: "/methods", label: "Methods", icon: FlaskConical },
  { to: "/data", label: "Data View", icon: Table2 },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/usage", label: "Inventory Usage", icon: History },
];

const STORAGE_KEY = "lj-sidebar-collapsed";

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, user, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const adminCheck = useServerFn(getMyAdminStatus);
  const me = useQuery({
    queryKey: ["me-admin"],
    queryFn: () => adminCheck(),
    enabled: !!user,
  });

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "1") setCollapsed(true);
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      }
      return next;
    });
  };

  const nav = me.data?.isAdmin
    ? [...baseNav, { to: "/users", label: "Users", icon: Users }]
    : baseNav;

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "relative flex flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className={cn("border-b border-sidebar-border py-6", collapsed ? "px-3" : "px-6")}>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-bold">
              LJ
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="font-semibold tracking-tight">LJ LIMS</div>
                <div className="text-xs text-sidebar-foreground/60">LanzaJet, Inc.</div>
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-7 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground/80 shadow-sm hover:text-sidebar-foreground"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((n) => {
            const active = pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                title={collapsed ? n.label : undefined}
                className={cn(
                  "flex items-center rounded-md py-2 text-sm transition-colors",
                  collapsed ? "justify-center px-0" : "gap-3 px-3",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{n.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className={cn("border-t border-sidebar-border py-3", collapsed ? "px-2" : "px-4")}>
          {!collapsed && (
            <>
              <div className="text-sm font-medium truncate">{profile?.full_name ?? user?.email}</div>
              <div className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</div>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "mt-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              collapsed ? "w-full justify-center px-0" : "w-full justify-start"
            )}
            onClick={signOut}
            title={collapsed ? "Sign out" : undefined}
          >
            <LogOut className={cn("h-4 w-4", !collapsed && "mr-2")} />
            {!collapsed && "Sign out"}
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
