import { createFileRoute, Link } from "@tanstack/react-router";
import { apiUrl } from "@/lib/api";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  CalendarDays, Plus, Tractor, Layers, AlertCircle,
  CheckCircle2, Clock, Trash2, Loader2, ArrowRight, Settings2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/programacao/")({
  component: ProgramacaoPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Activity = { id: string; name: string };

type Regra = {
  id: string;
  activityId: string;
  activityName: string;
  baseActivityId: string;
  baseActivityName: string;
  baseStatus: string;
  diasApos: number;
};

type ScheduleItem = {
  reportOrigemId: string;
  fazendaId: string;
  fazendaName: string;
  talhaoId: string;
  talhaoCode: string;
  triggerDate: string;
  scheduledDate: string;
  jaConcluida: boolean;
  existingReportId: string | null;
};

type RegraComItems = {
  regra: Regra;
  items: ScheduleItem[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "iniciado",            label: "Iniciado"           },
  { value: "andamento",           label: "Em Andamento"       },
  { value: "finalizado",          label: "Finalizado"         },
  { value: "iniciado_finalizado", label: "Iniciado/Finalizado"},
] as const;

const STATUS_LABEL: Record<string, string> = {
  iniciado: "Iniciado", andamento: "Em Andamento",
  finalizado: "Finalizado", iniciado_finalizado: "Iniciado/Finalizado",
};

function classifyDate(scheduledDate: string): "atrasada" | "hoje" | "futura" {
  const hoje = new Date().toISOString().slice(0, 10);
  if (scheduledDate < hoje) return "atrasada";
  if (scheduledDate === hoje) return "hoje";
  return "futura";
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function diffDays(scheduledDate: string): number {
  const hoje = new Date().toISOString().slice(0, 10);
  const diff = (new Date(scheduledDate + "T12:00:00").getTime() - new Date(hoje + "T12:00:00").getTime());
  return Math.round(diff / 86400000);
}

const fetchAll = <T,>(path: string): Promise<T> =>
  fetch(apiUrl(path), { credentials: "include" }).then(r => r.json());

// ─── Component ────────────────────────────────────────────────────────────────

function ProgramacaoPage() {
  const qc = useQueryClient();

  const { data: schedule = [], isLoading } = useQuery<RegraComItems[]>({
    queryKey: ["programacao"],
    queryFn: () => fetchAll("/programacao"),
    refetchInterval: 60_000,
  });

  const { data: regras = [] } = useQuery<(Regra & { activity: Activity; baseActivity: Activity })[]>({
    queryKey: ["regras-programacao"],
    queryFn: () => fetchAll("/regras-programacao"),
  });

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ["activities"],
    queryFn: () => fetchAll("/activities"),
  });

  // Filtro por fazenda (preferência do usuário)
  const { data: prefs } = useQuery<{ defaultFazendaId: string | null }>({
    queryKey: ["me", "preferences"],
    queryFn: () => fetchAll("/me/preferences"),
  });
  const { data: fazendas = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["fazendas"],
    queryFn: () => fetchAll("/fazendas"),
  });

  const [fazendaFilter, setFazendaFilter] = useState<string>("none");
  const effectiveFazenda = fazendaFilter !== "none" ? fazendaFilter : (prefs?.defaultFazendaId ?? "none");

  // Aba ativa
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  // Tab ativa: primeira regra por padrão
  const tabs = schedule;
  const activeRegra = activeTab
    ? tabs.find(t => t.regra.id === activeTab)
    : tabs[0];

  // Aplica filtro de fazenda
  const visibleItems = (activeRegra?.items ?? []).filter(item =>
    effectiveFazenda === "none" || item.fazendaId === effectiveFazenda
  );

  const pendentes  = visibleItems.filter(i => !i.jaConcluida);
  const concluidas = visibleItems.filter(i =>  i.jaConcluida);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Programação</h1>
          <p className="text-sm text-muted-foreground">
            Atividades calculadas automaticamente com base nas regras configuradas
          </p>
        </div>
        <Button variant="outline" onClick={() => setRulesOpen(true)} className="w-full sm:w-auto gap-2">
          <Settings2 className="h-4 w-4" />
          Gerenciar Regras
          {regras.length > 0 && (
            <Badge variant="secondary" className="ml-1">{regras.length}</Badge>
          )}
        </Button>
      </div>

      {/* Filtro global por fazenda */}
      <div className="flex items-center gap-2">
        <Tractor className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select value={effectiveFazenda} onValueChange={setFazendaFilter}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Todas as fazendas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Todas as fazendas</SelectItem>
            {fazendas.map(f => (
              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Calculando...</p>
      ) : tabs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <CalendarDays className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground text-center">
            Nenhuma regra configurada ainda.<br />
            Clique em "Gerenciar Regras" para criar a primeira.
          </p>
          <Button variant="outline" onClick={() => setRulesOpen(true)}>
            <Plus /> Criar Regra
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tabs por regra */}
          <div className="flex gap-1 border-b flex-wrap">
            {tabs.map(t => {
              const isActive = (activeTab ?? tabs[0].regra.id) === t.regra.id;
              const pendCount = t.items.filter(i => !i.jaConcluida).length;
              const atrasadas = t.items.filter(i => !i.jaConcluida && classifyDate(i.scheduledDate) === "atrasada").length;
              return (
                <button
                  key={t.regra.id}
                  onClick={() => setActiveTab(t.regra.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                    isActive
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.regra.activityName}
                  {atrasadas > 0 && (
                    <Badge variant="destructive" className="text-xs px-1.5 py-0">{atrasadas}</Badge>
                  )}
                  {atrasadas === 0 && pendCount > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">{pendCount}</Badge>
                  )}
                </button>
              );
            })}
          </div>

          {/* Info da regra ativa */}
          {activeRegra && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">{activeRegra.regra.baseActivityName}</span>
              {" "}com status{" "}
              <span className="font-medium">{STATUS_LABEL[activeRegra.regra.baseStatus]}</span>
              {" → "}
              <span className="font-medium">{activeRegra.regra.activityName}</span>
              {" "}após{" "}
              <span className="font-medium">{activeRegra.regra.diasApos} dias</span>
            </p>
          )}

          {/* Lista de itens */}
          {visibleItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <CalendarDays className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground text-center">
                Nenhum talhão encontrado para esta regra{fazendaFilter !== "none" ? " com a fazenda selecionada" : ""}.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pendentes */}
              {pendentes.length > 0 && (
                <div className="space-y-2">
                  {pendentes.map(item => (
                    <ScheduleCard key={item.reportOrigemId} item={item} />
                  ))}
                </div>
              )}

              {/* Concluídas */}
              {concluidas.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Atividade já iniciada
                  </p>
                  {concluidas.map(item => (
                    <ScheduleCard key={item.reportOrigemId} item={item} done />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dialog gerenciar regras */}
      <RulesDialog
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        regras={regras}
        activities={activities}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["regras-programacao"] }); qc.invalidateQueries({ queryKey: ["programacao"] }); }}
      />
    </div>
  );
}

// ─── Card de item da programação ──────────────────────────────────────────────

function ScheduleCard({ item, done = false }: { item: ScheduleItem; done?: boolean }) {
  const classify = classifyDate(item.scheduledDate);
  const diff = diffDays(item.scheduledDate);

  const tagProps = done
    ? { label: "Iniciada",  cls: "bg-muted text-muted-foreground",            icon: <CheckCircle2 className="h-3 w-3" /> }
    : classify === "atrasada"
    ? { label: `${Math.abs(diff)}d atrasada`, cls: "bg-destructive/10 text-destructive border-destructive/30", icon: <AlertCircle className="h-3 w-3" /> }
    : classify === "hoje"
    ? { label: "Hoje",      cls: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400", icon: <Clock className="h-3 w-3" /> }
    : { label: `em ${diff}d`, cls: "",                                         icon: <CalendarDays className="h-3 w-3" /> };

  return (
    <Card className={classify === "atrasada" && !done ? "border-destructive/30" : ""}>
      <CardContent className="py-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-xs flex items-center gap-1 ${tagProps.cls}`}>
              {tagProps.icon}{tagProps.label}
            </Badge>
            <span className="text-sm font-medium">{fmtDate(item.scheduledDate)}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><Tractor className="h-3 w-3" />{item.fazendaName}</span>
            <span className="flex items-center gap-1"><Layers  className="h-3 w-3" />{item.talhaoCode}</span>
            <span className="flex items-center gap-1 text-muted-foreground/70">
              Gatilho: {fmtDate(item.triggerDate)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {done && item.existingReportId ? (
            <Button variant="ghost" size="sm" asChild className="text-xs h-7">
              <Link to="/reports/$id" params={{ id: item.existingReportId }}>
                Ver relatório <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" asChild className="text-xs h-7">
              <Link to="/reports/$id" params={{ id: item.reportOrigemId }}>
                Ver origem <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Dialog gerenciar regras ──────────────────────────────────────────────────

type RegraFull = Regra & { activity: Activity; baseActivity: Activity };

function RulesDialog({
  open, onClose, regras, activities, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  regras: RegraFull[];
  activities: Activity[];
  onSaved: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    activityId: "", baseActivityId: "", baseStatus: "iniciado", diasApos: "15",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl("/regras-programacao"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          activityId:     form.activityId,
          baseActivityId: form.baseActivityId,
          baseStatus:     form.baseStatus,
          diasApos:       parseInt(form.diasApos),
        }),
      });
      if (!res.ok) throw new Error("Falha ao criar regra");
      return res.json();
    },
    onSuccess: () => {
      onSaved();
      setCreating(false);
      setForm({ activityId: "", baseActivityId: "", baseStatus: "iniciado", diasApos: "15" });
      setFormError(null);
    },
    onError: (e) => setFormError(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      fetch(apiUrl(`/regras-programacao/${id}`), { method: "DELETE", credentials: "include" }),
    onSuccess: onSaved,
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.activityId)     { setFormError("Selecione a atividade alvo.");  return; }
    if (!form.baseActivityId) { setFormError("Selecione a atividade base.");  return; }
    if (form.activityId === form.baseActivityId) { setFormError("As atividades não podem ser iguais."); return; }
    if (!form.diasApos || parseInt(form.diasApos) < 1) { setFormError("Informe os dias (mínimo 1)."); return; }
    save.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Regras de Programação</DialogTitle>
          <DialogDescription>
            Defina quando uma atividade deve ser realizada com base no status de outra.
          </DialogDescription>
        </DialogHeader>

        {/* Lista de regras existentes */}
        {regras.length > 0 && (
          <div className="divide-y border rounded-lg">
            {regras.map(r => (
              <div key={r.id} className="flex items-start justify-between gap-3 px-3 py-3">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-medium">{r.activity.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.baseActivity.name} com{" "}
                    <span className="font-medium">{STATUS_LABEL[r.baseStatus]}</span>
                    {" → "}após{" "}
                    <span className="font-medium">{r.diasApos} dias</span>
                  </p>
                </div>
                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => remove.mutate(r.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Formulário nova regra */}
        {creating ? (
          <form onSubmit={handleCreate} className="space-y-3 border rounded-lg p-4 bg-muted/30">
            <p className="text-sm font-semibold">Nova regra</p>

            <div className="space-y-1.5">
              <Label className="text-xs">Atividade base (disparo)</Label>
              <Select value={form.baseActivityId} onValueChange={v => setForm(f => ({ ...f, baseActivityId: v }))} disabled={save.isPending}>
                <SelectTrigger><SelectValue placeholder="Ex: Plantio Manual" /></SelectTrigger>
                <SelectContent>
                  {activities.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Status que dispara</Label>
              <Select value={form.baseStatus} onValueChange={v => setForm(f => ({ ...f, baseStatus: v }))} disabled={save.isPending}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Dias após o disparo</Label>
              <Input
                type="number" min={1} placeholder="Ex: 15"
                value={form.diasApos}
                onChange={e => setForm(f => ({ ...f, diasApos: e.target.value }))}
                disabled={save.isPending}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Atividade alvo (a ser realizada)</Label>
              <Select value={form.activityId} onValueChange={v => setForm(f => ({ ...f, activityId: v }))} disabled={save.isPending}>
                <SelectTrigger><SelectValue placeholder="Ex: 1º Pré Emergente" /></SelectTrigger>
                <SelectContent>
                  {activities.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {formError && (
              <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md">{formError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => { setCreating(false); setFormError(null); }} disabled={save.isPending}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={save.isPending}>
                {save.isPending && <Loader2 className="animate-spin h-3 w-3" />}
                Salvar regra
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => setCreating(true)}>
            <Plus /> Nova regra
          </Button>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
