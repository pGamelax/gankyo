import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { apiUrl } from "@/lib/api";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2, ArrowLeft, AlertTriangle, WifiOff } from "lucide-react";
import { enqueue } from "@/lib/offline-queue";

export const Route = createFileRoute("/_authenticated/reports/new")({
  component: NewReportPage,
});

type Fazenda  = { id: string; name: string };
type Talhao   = { id: string; codigo: string; area: number; fazendaId: string };
type Activity = { id: string; name: string };
type Insumo   = { nome: string; recomendacaoHa: string };
type ReportExistente = { talhao: { id: string }; activity: { id: string } };

const fetchFazendas   = () => fetch(apiUrl("/fazendas"),   { credentials: "include" }).then(r => r.json()) as Promise<Fazenda[]>;
const fetchTalhoes    = () => fetch(apiUrl("/talhoes"),    { credentials: "include" }).then(r => r.json()) as Promise<(Talhao & { fazenda: Fazenda })[]>;
const fetchActivities = () => fetch(apiUrl("/activities"), { credentials: "include" }).then(r => r.json()) as Promise<Activity[]>;
const fetchReports    = () => fetch(apiUrl("/reports"),    { credentials: "include" }).then(r => r.json()) as Promise<ReportExistente[]>;

function NewReportPage() {
  const navigate  = useNavigate();
  const qc = useQueryClient();

  const { data: fazendas        = [] } = useQuery({ queryKey: ["fazendas"],   queryFn: fetchFazendas   });
  const { data: allTalhoes      = [] } = useQuery({ queryKey: ["talhoes"],    queryFn: fetchTalhoes    });
  const { data: activities      = [] } = useQuery({ queryKey: ["activities"], queryFn: fetchActivities });
  const { data: reportsExistentes = [] } = useQuery({ queryKey: ["reports"],  queryFn: fetchReports    });

  const [fazendaId,  setFazendaId ] = useState("");
  const [talhaoId,   setTalhaoId  ] = useState("");
  const [activityId, setActivityId] = useState("");
  const [insumos,       setInsumos      ] = useState<Insumo[]>([]);
  const [formError,     setFormError    ] = useState<string | null>(null);
  const [offlineQueued, setOfflineQueued] = useState(false);

  const talhoesFiltrados = allTalhoes.filter(t => t.fazendaId === fazendaId);
  const talhaoSelecionado = allTalhoes.find(t => t.id === talhaoId);

  const isRetrabalho = !!(talhaoId && activityId && reportsExistentes.some(
    r => r.talhao.id === talhaoId && r.activity.id === activityId
  ));

  function handleFazendaChange(id: string) {
    setFazendaId(id);
    setTalhaoId(""); // reset talhão ao trocar fazenda
  }

  function addInsumo() {
    setInsumos(prev => [...prev, { nome: "", recomendacaoHa: "" }]);
  }

  function updateInsumo(idx: number, field: keyof Insumo, value: string) {
    setInsumos(prev => prev.map((ins, i) => i === idx ? { ...ins, [field]: value } : ins));
  }

  function removeInsumo(idx: number) {
    setInsumos(prev => prev.filter((_, i) => i !== idx));
  }

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl("/reports"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fazendaId,
          talhaoId,
          activityId,
          insumos: insumos.map(ins => ({
            nome: ins.nome.trim(),
            recomendacaoHa: parseFloat(ins.recomendacaoHa),
          })),
        }),
      });
      if (!res.ok) throw new Error("Falha ao criar atividade");
      return res.json() as Promise<{ id: string }>;
    },
    onSuccess: (data) => navigate({ to: "/reports/$id", params: { id: data.id } }),
    onError: (e) => setFormError(e.message),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setOfflineQueued(false);
    if (!fazendaId)  { setFormError("Selecione a fazenda.");   return; }
    if (!talhaoId)   { setFormError("Selecione o talhão.");    return; }
    if (!activityId) { setFormError("Selecione a atividade."); return; }
    const invalidInsumo = insumos.find(ins => !ins.nome.trim() || isNaN(parseFloat(ins.recomendacaoHa)));
    if (invalidInsumo) { setFormError("Preencha nome e recomendação de todos os insumos."); return; }

    // Se offline: salva na fila + insere item optimista no cache
    if (!navigator.onLine) {
      const tempId  = crypto.randomUUID();
      const parsedInsumos = insumos.map(ins => ({
        nome: ins.nome.trim(),
        recomendacaoHa: parseFloat(ins.recomendacaoHa),
      }));
      const selectedFazenda  = fazendas.find(f => f.id === fazendaId)!;
      const selectedTalhao   = allTalhoes.find(t => t.id === talhaoId)!;
      const selectedActivity = activities.find(a => a.id === activityId)!;

      const now = new Date().toISOString();
      const pendingReport = {
        id:          tempId,
        userId:      "",
        _pending:    true,
        createdAt:   now,
        fazenda:     { id: selectedFazenda.id,  name: selectedFazenda.name   },
        talhao:      { id: selectedTalhao.id,   codigo: selectedTalhao.codigo, area: selectedTalhao.area },
        activity:    { id: selectedActivity.id, name: selectedActivity.name  },
        insumos:     parsedInsumos.map((ins, i) => ({ id: `tmp-ins-${i}`, ...ins })),
        lancamentos: [],
      };

      await enqueue({
        type:     "create-report",
        method:   "POST",
        url:      apiUrl("/reports"),
        body:     { fazendaId, talhaoId, activityId, insumos: parsedInsumos },
        meta:     { tempId },
        snapshot: pendingReport,
      });

      // Optimistic insert: aparece na lista imediatamente
      qc.setQueryData(["reports"], (old: unknown[] | undefined) => [
        pendingReport,
        ...(old ?? []),
      ]);

      // Popula cache de detalhe para navegação offline
      qc.setQueryData(["reports", tempId], pendingReport);

      (window as unknown as Record<string, () => void>).__gankyoRefreshPendingCount?.();
      navigate({ to: "/reports" });
      return;
    }

    create.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/reports"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Iniciar Atividade</h1>
          <p className="text-sm text-muted-foreground">Selecione o local e a atividade a ser realizada</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Localização */}
        <Card>
          <CardHeader><CardTitle className="text-base">Localização</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Fazenda *</Label>
              <Select value={fazendaId} onValueChange={handleFazendaChange} disabled={create.isPending}>
                <SelectTrigger><SelectValue placeholder="Selecione a fazenda" /></SelectTrigger>
                <SelectContent>
                  {fazendas.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Talhão *</Label>
              <Select
                value={talhaoId}
                onValueChange={setTalhaoId}
                disabled={!fazendaId || create.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder={fazendaId ? "Selecione o talhão" : "Selecione a fazenda primeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {talhoesFiltrados.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.codigo} — {t.area.toLocaleString("pt-BR")} ha
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {talhaoSelecionado && (
                <p className="text-xs text-muted-foreground">
                  Área total: <strong>{talhaoSelecionado.area.toLocaleString("pt-BR")} ha</strong>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Atividade */}
        <Card>
          <CardHeader><CardTitle className="text-base">Atividade</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Atividade *</Label>
              <Select value={activityId} onValueChange={setActivityId} disabled={create.isPending}>
                <SelectTrigger><SelectValue placeholder="Selecione a atividade" /></SelectTrigger>
                <SelectContent>
                  {activities.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {isRetrabalho && (
              <div className="flex items-start gap-3 rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                    Retrabalho
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    Esta atividade já foi iniciada neste talhão anteriormente. Você está registrando um retrabalho.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Insumos */}
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Insumos</CardTitle>
              <CardDescription>Opcional — adicione caso a atividade utilize insumos</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addInsumo} disabled={create.isPending} className="w-full sm:w-auto">
              <Plus /> Adicionar Insumo
            </Button>
          </CardHeader>
          {insumos.length > 0 && (
            <CardContent className="space-y-3">
              {insumos.map((ins, idx) => (
                <div key={idx} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs">Nome do insumo</Label>
                    <Input
                      placeholder="Ex: Ureia, Herbicida..."
                      value={ins.nome}
                      onChange={e => updateInsumo(idx, "nome", e.target.value)}
                      disabled={create.isPending}
                    />
                  </div>
                  <div className="w-full sm:w-44 space-y-1.5">
                    <Label className="text-xs">Recomendação (por ha)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Ex: 2.50"
                      value={ins.recomendacaoHa}
                      onChange={e => updateInsumo(idx, "recomendacaoHa", e.target.value)}
                      disabled={create.isPending}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeInsumo(idx)}
                    disabled={create.isPending}
                    className="shrink-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          )}
        </Card>

        {formError && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{formError}</p>
        )}

        {offlineQueued && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
            <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <strong>Salvo offline.</strong> A atividade será enviada automaticamente quando você voltar a ficar online.
            </p>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" asChild disabled={create.isPending}>
            <Link to="/reports">Cancelar</Link>
          </Button>
          <Button
            type="submit"
            disabled={create.isPending || offlineQueued}
            variant={isRetrabalho ? "destructive" : "default"}
          >
            {create.isPending && <Loader2 className="animate-spin" />}
            {isRetrabalho ? "Confirmar Retrabalho" : "Iniciar Atividade"}
          </Button>
        </div>
      </form>
    </div>
  );
}
