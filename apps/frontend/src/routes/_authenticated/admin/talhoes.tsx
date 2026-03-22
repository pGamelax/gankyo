import { createFileRoute } from "@tanstack/react-router";
import { apiUrl } from "@/lib/api";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Layers, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/talhoes")({
  component: TalhoesPage,
});

type Fazenda = { id: string; name: string };
type Talhao = {
  id: string;
  fazendaId: string;
  numero: number;
  codigo: string;
  area: number;
  createdAt: string;
  fazenda: { id: string; name: string };
};

/** Gera o código do talhão: iniciais (sem acentos) + número zero-padded */
function generateCodigo(fazendaName: string, numero: number | string): string {
  const n = Number(numero);
  if (!fazendaName || isNaN(n) || n < 1) return "";
  const initials = fazendaName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w[0].toUpperCase())
    .join("");
  return `${initials}${String(n).padStart(2, "0")}`;
}

async function fetchFazendas(): Promise<Fazenda[]> {
  const res = await fetch(apiUrl("/fazendas"), { credentials: "include" });
  if (!res.ok) throw new Error();
  return res.json();
}
async function fetchTalhoes(): Promise<Talhao[]> {
  const res = await fetch(apiUrl("/talhoes"), { credentials: "include" });
  if (!res.ok) throw new Error("Falha ao carregar talhões");
  return res.json();
}

type FormState = { fazendaId: string; numero: string; area: string };
const emptyForm: FormState = { fazendaId: "", numero: "", area: "" };

function TalhoesPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Talhao | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Talhao | null>(null);

  const { data: fazendas = [] } = useQuery({ queryKey: ["fazendas"], queryFn: fetchFazendas });
  const { data: talhoes = [], isLoading } = useQuery({ queryKey: ["talhoes"], queryFn: fetchTalhoes });

  const selectedFazenda = fazendas.find((f) => f.id === form.fazendaId);
  const codigoPreview = useMemo(
    () => generateCodigo(selectedFazenda?.name ?? "", form.numero),
    [selectedFazenda, form.numero]
  );

  const save = useMutation({
    mutationFn: async () => {
      const url = editing ? apiUrl(`/talhoes/${editing.id}`) : apiUrl("/talhoes");
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fazendaId: form.fazendaId,
          numero: Number(form.numero),
          area: parseFloat(form.area),
        }),
      });
      if (!res.ok) throw new Error("Falha ao salvar talhão");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["talhoes"] }); closeDialog(); },
    onError: (e) => setFormError(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(apiUrl(`/talhoes/${id}`), { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["talhoes"] }); setDeleteTarget(null); },
  });

  function openCreate() { setEditing(null); setForm(emptyForm); setFormError(null); setDialogOpen(true); }
  function openEdit(t: Talhao) {
    setEditing(t);
    setForm({ fazendaId: t.fazendaId, numero: String(t.numero), area: String(t.area) });
    setFormError(null);
    setDialogOpen(true);
  }
  function closeDialog() { setDialogOpen(false); setEditing(null); setForm(emptyForm); setFormError(null); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fazendaId) { setFormError("Selecione uma fazenda."); return; }
    if (!form.numero || Number(form.numero) < 1) { setFormError("Informe um número válido."); return; }
    if (!form.area || parseFloat(form.area) <= 0) { setFormError("Informe uma área válida."); return; }
    save.mutate();
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Talhões</CardTitle>
            <CardDescription>
              {isLoading ? "Carregando..." : `${talhoes.length} talhão(ões) cadastrado(s)`}
            </CardDescription>
          </div>
          <Button onClick={openCreate} className="w-full sm:w-auto" disabled={fazendas.length === 0}>
            <Plus /> Novo Talhão
          </Button>
        </CardHeader>
        <CardContent>
          {fazendas.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground mb-4 p-3 bg-muted rounded-md">
              Cadastre ao menos uma fazenda antes de adicionar talhões.
            </p>
          )}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : talhoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Layers className="h-12 w-12 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground text-center">
                Nenhum talhão cadastrado.<br />Clique em "Novo Talhão" para começar.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {talhoes.map((t) => (
                <div key={t.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 shrink-0">
                      <Layers className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="font-mono text-xs">{t.codigo}</Badge>
                        <span className="text-sm font-medium">{t.fazenda.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Nº {t.numero} · {t.area.toLocaleString("pt-BR")} ha
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-11 sm:ml-0 sm:shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(t)}>
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
            <DialogTitle>{editing ? "Editar Talhão" : "Novo Talhão"}</DialogTitle>
            <DialogDescription>
              O código é gerado automaticamente a partir das iniciais da fazenda e do número.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Fazenda */}
            <div className="space-y-1.5">
              <Label>Fazenda *</Label>
              <Select
                value={form.fazendaId}
                onValueChange={(v) => setForm((f) => ({ ...f, fazendaId: v }))}
                disabled={save.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a fazenda" />
                </SelectTrigger>
                <SelectContent>
                  {fazendas.map((faz) => (
                    <SelectItem key={faz.id} value={faz.id}>{faz.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Número */}
            <div className="space-y-1.5">
              <Label htmlFor="talhao-numero">Número *</Label>
              <Input
                id="talhao-numero"
                type="number"
                min={1}
                placeholder="Ex: 1, 2, 3..."
                value={form.numero}
                onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
                disabled={save.isPending}
              />
            </div>

            {/* Preview do código */}
            {codigoPreview && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted">
                <span className="text-xs text-muted-foreground">Código gerado:</span>
                <Badge variant="secondary" className="font-mono">{codigoPreview}</Badge>
              </div>
            )}

            {/* Área */}
            <div className="space-y-1.5">
              <Label htmlFor="talhao-area">Área (ha) *</Label>
              <Input
                id="talhao-area"
                type="number"
                min={0}
                step="0.01"
                placeholder="Ex: 12.50"
                value={form.area}
                onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                disabled={save.isPending}
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
            <DialogTitle>Remover talhão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover o talhão{" "}
              <span className="font-medium text-foreground">"{deleteTarget?.codigo}"</span>?
              Esta ação não pode ser desfeita.
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
