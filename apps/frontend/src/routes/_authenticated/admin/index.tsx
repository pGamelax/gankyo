import { createFileRoute } from "@tanstack/react-router";
import { apiUrl } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { UserX, UserCheck, Crown, User, UserPlus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: UsersPage,
});

type UserRow = {
  id: string;
  name: string;
  username: string | null;
  role: string;
  banned: boolean | null;
  banReason: string | null;
  createdAt: string;
};

async function fetchUsers(): Promise<UserRow[]> {
  const res = await fetch(apiUrl("/admin/users"), { credentials: "include" });
  if (!res.ok) throw new Error("Falha ao carregar usuários");
  return res.json();
}

function UsersPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({ name: "", username: "", password: "", role: "user" });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchUsers,
  });

  const createUser = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch(apiUrl("/admin/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Erro ao criar usuário");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setDialogOpen(false);
      setForm({ name: "", username: "", password: "", role: "user" });
      setFormError(null);
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const setRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: "user" | "admin" }) => {
      const res = await fetch(apiUrl(`/admin/users/${id}/role`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar role");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(apiUrl(`/admin/users/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao excluir usuário");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const toggleBan = useMutation({
    mutationFn: async ({ id, banned }: { id: string; banned: boolean }) => {
      const res = await fetch(apiUrl(`/admin/users/${id}/ban`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ banned }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar status");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  function handleOpenDialog() {
    setForm({ name: "", username: "", password: "", role: "user" });
    setFormError(null);
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    createUser.mutate(form);
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Usuários</CardTitle>
            <CardDescription>
              {isLoading ? "Carregando..." : `${users.length} usuário(s) cadastrado(s)`}
            </CardDescription>
          </div>
          <Button size="sm" onClick={handleOpenDialog} className="shrink-0">
            <UserPlus className="h-4 w-4" />
            Criar Usuário
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="divide-y">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 py-3">
                  {/* Avatar */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                    {u.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium truncate">{u.name}</span>
                      {u.role === "admin" && <Badge className="text-xs">Admin</Badge>}
                      {u.banned && <Badge variant="destructive" className="text-xs">Banido</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">@{u.username ?? "—"}</p>
                  </div>

                  {/* Ações */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      disabled={setRole.isPending}
                      onClick={() => setRole.mutate({ id: u.id, role: u.role === "admin" ? "user" : "admin" })}
                      title={u.role === "admin" ? "Tornar usuário" : "Tornar admin"}
                    >
                      {u.role === "admin" ? <User className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`h-8 px-2 text-xs ${u.banned ? "" : "text-destructive hover:text-destructive"}`}
                      disabled={toggleBan.isPending}
                      onClick={() => toggleBan.mutate({ id: u.id, banned: !u.banned })}
                      title={u.banned ? "Desbanir" : "Banir"}
                    >
                      {u.banned ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-destructive hover:text-destructive"
                      disabled={deleteUser.isPending}
                      onClick={() => setDeleteConfirm({ id: u.id, name: u.name })}
                      title="Excluir usuário"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Excluir usuário"
        description={`Tem certeza que deseja excluir "${deleteConfirm?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        isPending={deleteUser.isPending}
        onConfirm={() => {
          if (deleteConfirm) {
            deleteUser.mutate(deleteConfirm.id, { onSuccess: () => setDeleteConfirm(null) });
          }
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar novo usuário</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="new-name">Nome</Label>
              <Input
                id="new-name"
                placeholder="João Silva"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-username">Usuário</Label>
              <Input
                id="new-username"
                type="text"
                placeholder="pedro.gamela"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
                autoCapitalize="none"
                autoCorrect="off"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-password">Senha</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                minLength={8}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Perfil</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={createUser.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending ? "Criando..." : "Criar usuário"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
