import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { FlaskConical, BeakerIcon, Table2, LogOut, Users, Package, History, ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
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

  // Desktop: collapsed-to-rail toggle persisted in localStorage
  const [collapsed, setCollapsed] = useState(false);
  // Mobile: off-canvas drawer open state
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "1") setCollapsed(true);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = () => {
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
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-200",
          // Mobile: fixed off-canvas
          "fixed inset-y-0 left-0 z-40 w-64 md:relative md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          // Desktop width
          collapsed ? "md:w-16" : "md:w-64"
        )}
      >
        <div className={cn("border-b border-sidebar-border py-6", collapsed ? "md:px-3 px-6" : "px-6")}>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-bold">
              LJ
            </div>
            <div className={cn("min-w-0", collapsed && "md:hidden")}>
              <div className="font-semibold tracking-tight">LJ LIMS</div>
              <div className="text-xs text-sidebar-foreground/60">LanzaJet, Inc.</div>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="ml-auto rounded-md p-1 text-sidebar-foreground/70 hover:text-sidebar-foreground md:hidden"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        {/* Desktop collapse handle */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-7 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground/80 shadow-sm hover:text-sidebar-foreground md:flex"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {nav.map((n) => {
            const active = pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                title={collapsed ? n.label : undefined}
                className={cn(
                  "flex items-center rounded-md py-2 text-sm transition-colors gap-3 px-3",
                  collapsed && "md:justify-center md:gap-0 md:px-0",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={cn(collapsed && "md:hidden")}>{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className={cn("border-t border-sidebar-border py-3 px-4", collapsed && "md:px-2")}>
          <div className={cn(collapsed && "md:hidden")}>
            <div className="text-sm font-medium truncate">{profile?.full_name ?? user?.email}</div>
            <div className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "mt-2 w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              collapsed && "md:justify-center md:px-0"
            )}
            onClick={signOut}
            title={collapsed ? "Sign out" : undefined}
          >
            <LogOut className={cn("h-4 w-4", collapsed ? "md:mr-0 mr-2" : "mr-2")} />
            <span className={cn(collapsed && "md:hidden")}>Sign out</span>
          </Button>
        </div>
      </aside>

      <main className="flex flex-1 min-w-0 flex-col overflow-auto">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar text-sidebar-primary-foreground text-xs font-bold">
              LJ
            </div>
            <span className="text-sm font-semibold">LJ LIMS</span>
          </div>
        </header>
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
