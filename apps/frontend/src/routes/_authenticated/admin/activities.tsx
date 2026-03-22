import { createFileRoute } from "@tanstack/react-router";
import { apiUrl } from "@/lib/api";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Activity,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/activities")({
  component: ActivitiesPage,
});

type ActivityRow = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
};

async function fetchActivities(): Promise<ActivityRow[]> {
  const res = await fetch(apiUrl("/activities"), { credentials: "include" });
  if (!res.ok) throw new Error("Falha ao carregar atividades");
  return res.json();
}

type FormState = { name: string; description: string };
const emptyForm: FormState = { name: "", description: "" };

function ActivitiesPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<ActivityRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["activities"],
    queryFn: fetchActivities,
  });

  const save = useMutation({
    mutationFn: async () => {
      const url = editing ? apiUrl(`/activities/${editing.id}`) : apiUrl("/activities");
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Falha ao salvar atividade");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
      closeDialog();
    },
    onError: (e) => setFormError(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(apiUrl(`/activities/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao remover atividade");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
      setDeleteTarget(null);
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(a: ActivityRow) {
    setEditing(a);
    setForm({ name: a.name, description: a.description ?? "" });
    setFormError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("O nome é obrigatório.");
      return;
    }
    save.mutate();
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Atividades</CardTitle>
            <CardDescription>
              {isLoading
                ? "Carregando..."
                : `${activities.length} atividade(s) cadastrada(s)`}
            </CardDescription>
          </div>
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus />
            Nova Atividade
          </Button>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Activity className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground text-center">
                Nenhuma atividade cadastrada ainda.
                <br />
                Clique em "Nova Atividade" para começar.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {activities.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 shrink-0">
                        <Activity className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <p className="text-sm font-medium truncate">{a.name}</p>
                    </div>
                    {a.description && (
                      <p className="text-xs text-muted-foreground mt-1 ml-9 line-clamp-2">
                        {a.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 ml-9">
                      Criada em {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 sm:shrink-0 ml-9 sm:ml-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(a)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteTarget(a)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog criar / editar */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Atividade" : "Nova Atividade"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Altere os dados da atividade abaixo."
                : "Preencha os dados para cadastrar uma nova atividade no sistema."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="act-name">Nome *</Label>
              <Input
                id="act-name"
                placeholder="Ex: Vistoria, Inspeção, Auditoria..."
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                disabled={save.isPending}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="act-desc">Descrição</Label>
              <Textarea
                id="act-desc"
                placeholder="Descreva brevemente o que esta atividade representa..."
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                disabled={save.isPending}
                rows={3}
              />
            </div>

            {formError && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {formError}
              </p>
            )}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={save.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="animate-spin" />}
                {editing ? "Salvar alterações" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmar remoção */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover atividade</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover a atividade{" "}
              <span className="font-medium text-foreground">
                "{deleteTarget?.name}"
              </span>
              ? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={remove.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
              disabled={remove.isPending}
            >
              {remove.isPending && <Loader2 className="animate-spin" />}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
