import { createFileRoute } from "@tanstack/react-router";
import { apiUrl } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserX, UserCheck, Crown, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: UsersPage,
});

type UserRow = {
  id: string;
  name: string;
  email: string;
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
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchUsers,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuários</CardTitle>
        <CardDescription>
          {isLoading ? "Carregando..." : `${users.length} usuário(s) cadastrado(s)`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="divide-y">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    {u.role === "admin" && (
                      <Badge className="text-xs">Admin</Badge>
                    )}
                    {u.banned && (
                      <Badge variant="destructive" className="text-xs">
                        Banido
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Desde {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={setRole.isPending}
                    onClick={() =>
                      setRole.mutate({
                        id: u.id,
                        role: u.role === "admin" ? "user" : "admin",
                      })
                    }
                  >
                    {u.role === "admin" ? (
                      <><User className="h-3.5 w-3.5" />Tornar User</>
                    ) : (
                      <><Crown className="h-3.5 w-3.5" />Tornar Admin</>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant={u.banned ? "outline" : "destructive"}
                    disabled={toggleBan.isPending}
                    onClick={() =>
                      toggleBan.mutate({ id: u.id, banned: !u.banned })
                    }
                  >
                    {u.banned ? (
                      <><UserCheck className="h-3.5 w-3.5" />Desbanir</>
                    ) : (
                      <><UserX className="h-3.5 w-3.5" />Banir</>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
