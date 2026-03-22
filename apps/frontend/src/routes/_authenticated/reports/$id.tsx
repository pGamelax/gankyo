import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { apiUrl } from "@/lib/api";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Tractor, Layers, Activity, Plus,
  Loader2, Droplets, CheckCircle2, Clock, AlertCircle, Copy, Check, WifiOff,
  Trash2, Pencil,
} from "lucide-react";
import { enqueue } from "@/lib/offline-queue";
import { useSession } from "@/lib/auth-client";

export const Route = createFileRoute("/_authenticated/reports/$id")({
  component: ReportDetailPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Insumo     = { id: string; nome: string; recomendacaoHa: number };
type Lancamento = { id: string; hectares: number; status: string; data: string; createdAt: string };
type ReportDetail = {
  id: string;
  userId: string;
  createdAt: string;
  fazenda:  { id: string; name: string };
  talhao:   { id: string; codigo: string; area: number };
  activity: { id: string; name: string; description?: string };
  insumos:  Insumo[];
  lancamentos: Lancamento[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "iniciado",            label: "Iniciado"           },
  { value: "andamento",           label: "Em Andamento"       },
  { value: "finalizado",          label: "Finalizado"         },
  { value: "iniciado_finalizado", label: "Iniciado/Finalizado"},
] as const;

type StatusValue = typeof STATUS_OPTIONS[number]["value"];

const statusMeta: Record<string, { label: string; variant: "default" | "secondary" | "outline"; icon: React.ElementType }> = {
  iniciado:            { label: "Iniciado",            variant: "secondary", icon: Clock         },
  andamento:           { label: "Em Andamento",        variant: "default",   icon: AlertCircle   },
  finalizado:          { label: "Finalizado",          variant: "outline",   icon: CheckCircle2  },
  iniciado_finalizado: { label: "Iniciado/Finalizado", variant: "outline",   icon: CheckCircle2  },
};

async function fetchReport(id: string): Promise<ReportDetail> {
  const res = await fetch(apiUrl(`/reports/${id}`), { credentials: "include" });
  if (!res.ok) throw new Error("Relatório não encontrado");
  return res.json();
}

// ─── Component ────────────────────────────────────────────────────────────────

function ReportDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: session } = useSession();

  const { data: report, isLoading, error } = useQuery({
    queryKey: ["reports", id],
    queryFn: () => fetchReport(id),
  });

  const todayStr = () => new Date().toISOString().slice(0, 10);

  const [dialogOpen,      setDialogOpen     ] = useState(false);
  const [editingLanc,     setEditingLanc    ] = useState<Lancamento | null>(null);
  const [copiedId,        setCopiedId       ] = useState<string | null>(null);
  const [hectares,        setHectares       ] = useState("");
  const [status,          setStatus         ] = useState<StatusValue>("iniciado");
  const [data,            setData           ] = useState(todayStr());
  const [formError,       setFormError      ] = useState<string | null>(null);
  const [offlineQueued,   setOfflineQueued  ] = useState(false);

  // ── Cálculos derivados ─────────────────────────────────────────────────────
  const totalHaLancado = report?.lancamentos.reduce((s, l) => s + l.hectares, 0) ?? 0;
  const areaTotal      = report?.talhao.area ?? 0;
  const haRestante     = Math.max(0, areaTotal - totalHaLancado);
  const pct            = areaTotal > 0 ? Math.min(100, (totalHaLancado / areaTotal) * 100) : 0;

  // ── Quando status muda para finalizado/iniciado_finalizado, preenche ha restante
  useEffect(() => {
    if (status === "finalizado" || status === "iniciado_finalizado") {
      setHectares(haRestante > 0 ? String(haRestante) : "0");
    }
  }, [status, haRestante]);

  const haNum = parseFloat(hectares) || 0;

  // ── Mutação lançar ─────────────────────────────────────────────────────────
  const lancar = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl(`/reports/${id}/lancamentos`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ hectares: haNum, status, data }),
      });
      if (!res.ok) throw new Error("Falha ao lançar relatório");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports", id] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      closeDialog();
    },
    onError: (e) => setFormError(e.message),
  });

  // Permissão: dono ou admin
  const canEdit = !!report && (
    session?.user?.id === report.userId || session?.user?.role === "admin"
  );

  // ── Deletar relatório ──────────────────────────────────────────────────────
  const navigate = useNavigate();
  const deleteReport = useMutation({
    mutationFn: () =>
      fetch(apiUrl(`/reports/${id}`), { method: "DELETE", credentials: "include" })
        .then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      navigate({ to: "/reports" });
    },
  });

  // ── Deletar lançamento ─────────────────────────────────────────────────────
  const deleteLanc = useMutation({
    mutationFn: (lancId: string) =>
      fetch(apiUrl(`/reports/${id}/lancamentos/${lancId}`), { method: "DELETE", credentials: "include" })
        .then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports", id] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  // ── Editar lançamento ──────────────────────────────────────────────────────
  const editLanc = useMutation({
    mutationFn: async (lancId: string) => {
      const res = await fetch(apiUrl(`/reports/${id}/lancamentos/${lancId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ hectares: haNum, status, data }),
      });
      if (!res.ok) throw new Error("Falha ao editar lançamento");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports", id] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      closeDialog();
    },
    onError: (e) => setFormError(e.message),
  });

  function openEdit(l: Lancamento) {
    setEditingLanc(l);
    setHectares(String(l.hectares));
    setStatus(l.status as StatusValue);
    setData(l.data);
    setFormError(null);
    setOfflineQueued(false);
    setDialogOpen(true);
  }

  function copyLancamento(l: Lancamento) {
    if (!report) return;
    const data = new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR");
    const statusLbl = statusMeta[l.status]?.label ?? l.status;

    const lines: string[] = [
      data,
      `Fazenda: ${report.fazenda.name}`,
      "",
      report.activity.name,
      `Talhão: ${report.talhao.codigo}`,
      `Área: ${l.hectares.toLocaleString("pt-BR")} ha`,
      `Status: ${statusLbl}`,
    ];

    if (report.insumos.length > 0) {
      lines.push("", "Insumos");
      for (const ins of report.insumos) {
        const qty = (l.hectares * ins.recomendacaoHa).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
        lines.push(`${ins.nome}: ${qty}`);
      }
    }

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopiedId(l.id);
      setTimeout(() => setCopiedId(null), 2500);
    });
  }

  function openDialog()  { setEditingLanc(null); setHectares(""); setStatus("iniciado"); setData(todayStr()); setFormError(null); setOfflineQueued(false); setDialogOpen(true); }
  function closeDialog() { setDialogOpen(false); setEditingLanc(null); setHectares(""); setStatus("iniciado"); setData(todayStr()); setFormError(null); setOfflineQueued(false); }

  async function handleLancar(e: React.FormEvent) {
    e.preventDefault();
    setOfflineQueued(false);
    if (!hectares || haNum <= 0) { setFormError("Informe a quantidade de hectares."); return; }

    // Se offline: enfileira e fecha o dialog com feedback
    if (!navigator.onLine) {
      await enqueue({
        type: "add-lancamento",
        url:  apiUrl(`/reports/${id}/lancamentos`),
        body: { hectares: haNum, status, data },
        meta: { reportId: id },
      });
      (window as unknown as Record<string, () => void>).__gankyoRefreshPendingCount?.();
      setOfflineQueued(true);
      return;
    }

    if (editingLanc) { editLanc.mutate(editingLanc.id); return; }
    lancar.mutate();
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;
  if (error || !report) return (
    <div className="space-y-4">
      <Button variant="ghost" asChild><Link to="/reports"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Link></Button>
      <p className="text-destructive">Relatório não encontrado.</p>
    </div>
  );

  const lastStatus = report.lancamentos.at(-1)?.status;
  const meta = lastStatus ? statusMeta[lastStatus] : null;
  const StatusIcon = meta?.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild className="mt-0.5 shrink-0">
          <Link to="/reports"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{report.activity.name}</h1>
            {meta && StatusIcon && (
              <Badge variant={meta.variant} className="flex items-center gap-1">
                <StatusIcon className="h-3 w-3" />{meta.label}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Iniciada em {new Date(report.createdAt).toLocaleDateString("pt-BR")}
          </p>
        </div>
        {canEdit && (
          <Button
            variant="ghost" size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive mt-0.5"
            title="Excluir relatório"
            onClick={() => { if (confirm("Excluir este relatório e todos os seus lançamentos?")) deleteReport.mutate(); }}
            disabled={deleteReport.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Localização + progresso */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <Tractor className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Fazenda</p>
                <p className="text-sm font-medium">{report.fazenda.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Talhão</p>
                <p className="text-sm font-medium">{report.talhao.codigo}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Área total</p>
                <p className="text-sm font-medium">{areaTotal.toLocaleString("pt-BR")} ha</p>
              </div>
            </div>
          </div>

          {/* Barra progresso */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{totalHaLancado.toLocaleString("pt-BR")} ha realizados</span>
              <span>{haRestante.toLocaleString("pt-BR")} ha restantes</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">{pct.toFixed(1)}% concluído</p>
          </div>
        </CardContent>
      </Card>

      {/* Insumos */}
      {report.insumos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Droplets className="h-4 w-4 text-primary" /> Insumos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {report.insumos.map(ins => (
                <div key={ins.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm font-medium">{ins.nome}</span>
                  <span className="text-sm text-muted-foreground">
                    {ins.recomendacaoHa.toLocaleString("pt-BR")} / ha
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lançamentos */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Lançamentos</CardTitle>
            <CardDescription>{report.lancamentos.length} lançamento(s) registrado(s)</CardDescription>
          </div>
          <Button onClick={openDialog} className="w-full sm:w-auto">
            <Plus /> Lançar Relatório
          </Button>
        </CardHeader>
        <CardContent>
          {report.lancamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum lançamento ainda.</p>
          ) : (
            <div className="divide-y">
              {report.lancamentos.map((l, idx) => {
                const m = statusMeta[l.status];
                const Icon = m?.icon;
                return (
                  <div key={l.id} className="py-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                        {m && Icon && (
                          <Badge variant={m.variant} className="text-xs flex items-center gap-1">
                            <Icon className="h-3 w-3" />{m.label}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground mr-1">
                          {new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR")}
                        </span>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => copyLancamento(l)}
                        >
                          {copiedId === l.id
                            ? <Check className="h-3.5 w-3.5 text-primary" />
                            : <Copy className="h-3.5 w-3.5" />
                          }
                        </Button>
                        {canEdit && (
                          <>
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => openEdit(l)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => { if (confirm("Excluir este lançamento?")) deleteLanc.mutate(l.id); }}
                              disabled={deleteLanc.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span><strong>{l.hectares.toLocaleString("pt-BR")}</strong> ha realizados</span>
                    </div>
                    {/* Insumos calculados para este lançamento */}
                    {report.insumos.length > 0 && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {report.insumos.map(ins => (
                          <span key={ins.id} className="text-xs text-muted-foreground">
                            {ins.nome}: <strong>{(l.hectares * ins.recomendacaoHa).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Lançar Relatório */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLanc ? "Editar Lançamento" : "Lançar Relatório"}</DialogTitle>
            <DialogDescription>
              Informe os hectares realizados neste lançamento.
              {haRestante > 0 && (
                <span className="block mt-1 text-foreground font-medium">
                  Restam {haRestante.toLocaleString("pt-BR")} ha para completar o talhão.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleLancar} className="space-y-4">
            {/* Data */}
            <div className="space-y-1.5">
              <Label htmlFor="lancamento-data">Data do serviço *</Label>
              <Input
                id="lancamento-data"
                type="date"
                value={data}
                max={todayStr()}
                onChange={e => setData(e.target.value)}
                disabled={lancar.isPending}
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label>Status *</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as StatusValue)} disabled={lancar.isPending}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(status === "finalizado" || status === "iniciado_finalizado") && (
                <p className="text-xs text-muted-foreground">
                  Hectares preenchidos automaticamente com o restante do talhão.
                </p>
              )}
            </div>

            {/* Hectares */}
            <div className="space-y-1.5">
              <Label htmlFor="lancamento-ha">Hectares realizados *</Label>
              <Input
                id="lancamento-ha"
                type="number"
                min={0}
                step="0.01"
                placeholder="Ex: 5.00"
                value={hectares}
                onChange={e => setHectares(e.target.value)}
                disabled={lancar.isPending}
              />
            </div>

            {/* Preview insumos calculados */}
            {report.insumos.length > 0 && haNum > 0 && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Insumos utilizados ({haNum.toLocaleString("pt-BR")} ha)
                </p>
                {report.insumos.map(ins => (
                  <div key={ins.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{ins.nome}</span>
                    <span className="font-semibold">
                      {(haNum * ins.recomendacaoHa).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {formError && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{formError}</p>
            )}

            {offlineQueued && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5">
                <WifiOff className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  <strong>Salvo offline.</strong> Será enviado quando você voltar a ficar online.
                </p>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={closeDialog} disabled={lancar.isPending}>
                {offlineQueued ? "Fechar" : "Cancelar"}
              </Button>
              {!offlineQueued && (
                <Button type="submit" disabled={lancar.isPending}>
                  {lancar.isPending && <Loader2 className="animate-spin" />}
                  Lançar
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
