import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAccounts,
  createAccount,
  setAccountRole,
  resetAccountPassword,
  deleteAccount,
  getMyAdminStatus,
} from "@/lib/admin-users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, KeyRound, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_app/users")({
  head: () => ({ meta: [{ title: "Users — LJ LIMS" }] }),
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const adminCheck = useServerFn(getMyAdminStatus);
  const list = useServerFn(listAccounts);
  const create = useServerFn(createAccount);
  const setRole = useServerFn(setAccountRole);
  const resetPw = useServerFn(resetAccountPassword);
  const del = useServerFn(deleteAccount);

  const me = useQuery({ queryKey: ["me-admin"], queryFn: () => adminCheck() });
  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: () => list(),
    enabled: !!me.data?.isAdmin,
  });

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setNewRole] = useState<"admin" | "editor" | "operations" | "user">("user");


  const createMut = useMutation({
    mutationFn: () =>
      create({ data: { email, full_name: fullName, password, role } }),
    onSuccess: () => {
      toast.success("Account created");
      setEmail(""); setFullName(""); setPassword(""); setNewRole("user");
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMut = useMutation({
    mutationFn: (v: { user_id: string; role: "admin" | "user" }) =>
      setRole({ data: v }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (user_id: string) => del({ data: { user_id } }),
    onSuccess: () => {
      toast.success("Account deleted");
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMut = useMutation({
    mutationFn: (v: { user_id: string; password: string }) =>
      resetPw({ data: v }),
    onSuccess: () => toast.success("Password reset"),
    onError: (e: Error) => toast.error(e.message),
  });

  if (me.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!me.data?.isAdmin) return <Navigate to="/samples" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">User accounts</h1>
        <p className="text-sm text-muted-foreground">
          Create accounts and assign roles. Users cannot self-register.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Create new account</h2>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}
            className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
          >
            <div className="space-y-1">
              <Label>Full name</Label>
              <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <Input required type="text" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 chars" />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setNewRole(v as "admin" | "user")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={createMut.isPending}>
              <UserPlus className="h-4 w-4 mr-2" />Create
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Accounts</h2>
        </CardHeader>
        <CardContent>
          {accounts.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading accounts…</p>
          ) : (
            <div className="divide-y">
              {(accounts.data ?? []).map((a) => (
                <div key={a.id} className="py-3 flex flex-wrap gap-3 items-center">
                  <div className="flex-1 min-w-[240px]">
                    <div className="font-medium">{a.full_name ?? "—"}</div>
                    <div className="text-sm text-muted-foreground">{a.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.roles.map((r) => (
                      <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>{r}</Badge>
                    ))}
                  </div>
                  <Select
                    value={a.roles.includes("admin") ? "admin" : "user"}
                    onValueChange={(v) => roleMut.mutate({ user_id: a.id, role: v as "admin" | "user" })}
                  >
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const pw = window.prompt(`Set new password for ${a.email}:`);
                      if (pw && pw.length >= 8) resetMut.mutate({ user_id: a.id, password: pw });
                      else if (pw) toast.error("Password must be at least 8 characters");
                    }}
                  >
                    <KeyRound className="h-4 w-4 mr-1" />Reset password
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(`Delete ${a.email}? This cannot be undone.`)) {
                        delMut.mutate(a.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {accounts.data?.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">No accounts yet.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
