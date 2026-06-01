import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyAdminStatus } from "@/lib/admin-users.functions";
import { useAuth } from "@/lib/auth-context";

export type AppRole = "admin" | "editor" | "operations" | "user";

// Paths each role may access. Admin has access to all.
const ACCESS: Record<Exclude<AppRole, "admin">, string[]> = {
  editor: ["/samples", "/methods", "/data", "/inventory", "/usage", "/schedule", "/schedule-view", "/imports"],
  operations: ["/data"],
  user: ["/samples", "/data", "/schedule-view"],
};

export function canAccess(role: AppRole | undefined, path: string): boolean {
  if (!role) return false;
  if (role === "admin") return true;
  return ACCESS[role].includes(path);
}

export function useMyRole() {
  const { user } = useAuth();
  const fn = useServerFn(getMyAdminStatus);
  return useQuery({
    queryKey: ["me-admin"],
    queryFn: () => fn(),
    enabled: !!user,
  });
}
