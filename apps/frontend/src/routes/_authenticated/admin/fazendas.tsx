import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Tractor, Loader2 } from "lucide-react";
import { apiUrl } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/admin/fazendas")({
  component: FazendasPage,
});

type Fazenda = { id: string; name: string; createdAt: string };

async function fetchFazendas(): Promise<Fazenda[]> {
  const res = await fetch(apiUrl("/fazendas"), { credentials: "include" });
  if (!res.ok) throw new Error("Falha ao carregar fazendas");
  return res.json();
}

function FazendasPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Fazenda | null>(null);
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Fazenda | null>(null);

  const { data: fazendas = [], isLoading } = useQuery({
    queryKey: ["fazendas"],
    queryFn: fetchFazendas,
  });

  const save = useMutation({
    mutationFn: async () => {
      const url = editing ? apiUrl(`/fazendas/${editing.id}`) : apiUrl("/fazendas");
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error("Falha ao salvar fazenda");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fazendas"] }); closeDialog(); },
    onError: (e) => setFormError(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(apiUrl(`/fazendas/${id}`), { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Falha ao remover fazenda");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fazendas"] }); setDeleteTarget(null); },
  });

  function openCreate() { setEditing(null); setName(""); setFormError(null); setDialogOpen(true); }
  function openEdit(f: Fazenda) { setEditing(f); setName(f.name); setFormError(null); setDialogOpen(true); }
  function closeDialog() { setDialogOpen(false); setEditing(null); setName(""); setFormError(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setFormError("O nome é obrigatório."); return; }
    save.mutate();
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Fazendas</CardTitle>
            <CardDescription>
              {isLoading ? "Carregando..." : `${fazendas.length} fazenda(s) cadastrada(s)`}
            </CardDescription>
          </div>
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus /> Nova Fazenda
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : fazendas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Tractor className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground text-center">
                Nenhuma fazenda cadastrada.<br />Clique em "Nova Fazenda" para começar.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {fazendas.map((f) => (
                <div key={f.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 shrink-0">
                      <Tractor className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Cadastrada em {new Date(f.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-11 sm:ml-0 sm:shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEdit(f)}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(f)}>
                      <Trash2 className="h-3.5 w-3.5" /> Remover
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Fazenda" : "Nova Fazenda"}</DialogTitle>
            <DialogDescription>
              {editing ? "Altere o nome da fazenda." : "Informe o nome da nova fazenda."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fazenda-name">Nome *</Label>
              <Input
                id="fazenda-name"
                placeholder="Ex: Água Boa, Santa Maria..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={save.isPending}
                autoFocus
              />
            </div>
            {formError && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{formError}</p>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={closeDialog} disabled={save.isPending}>Cancelar</Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="animate-spin" />}
                {editing ? "Salvar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog remover */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover fazenda</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover <span className="font-medium text-foreground">"{deleteTarget?.name}"</span>?
              Todos os talhões vinculados também serão removidos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={remove.isPending}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteTarget && remove.mutate(deleteTarget.id)} disabled={remove.isPending}>
              {remove.isPending && <Loader2 className="animate-spin" />} Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
