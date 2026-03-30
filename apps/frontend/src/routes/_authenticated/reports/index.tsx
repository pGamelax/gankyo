import { createFileRoute, Link } from "@tanstack/react-router";
import { apiUrl } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { FileText, Plus, Tractor, Layers, Activity, ChevronRight, Copy, Check, WifiOff, Calendar, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/reports/")({
  component: ReportsIndexPage,
});

const statusLabel: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  iniciado:            { label: "Iniciado",           variant: "secondary" },
  andamento:           { label: "Em Andamento",        variant: "default"   },
  finalizado:          { label: "Finalizado",          variant: "outline"   },
  iniciado_finalizado: { label: "Iniciado/Finalizado", variant: "outline"   },
};

type ReportSummary = {
  id: string;
  createdAt: string;
  fazenda: { id: string; name: string };
  talhao: { id: string; codigo: string; area: number };
  activity: { id: string; name: string };
  insumos: { id: string; nome: string; unidade: string; recomendacaoHa: number }[];
  lancamentos: { id: string; hectares: number; status: string }[];
  _pending?: boolean;
};

type Fazenda = { id: string; name: string };
type Preferences = { defaultFazendaId: string | null };

async function fetchReports(qc: import("@tanstack/react-query").QueryClient): Promise<ReportSummary[]> {
  const res = await fetch(apiUrl("/reports"), { credentials: "include" });
  if (!res.ok) throw new Error("Falha ao carregar relatórios");
  const fresh = (await res.json()) as ReportSummary[];
  const cached = (qc.getQueryData<ReportSummary[]>(["reports"]) ?? []);
  const pending = cached.filter(r => r._pending && !fresh.some(s => s.id === r.id));
  return pending.length > 0 ? [...pending, ...fresh] : fresh;
}

const fetchFazendas = (): Promise<Fazenda[]> =>
  fetch(apiUrl("/fazendas"), { credentials: "include" }).then(r => r.json());

const fetchPreferences = (): Promise<Preferences> =>
  fetch(apiUrl("/me/preferences"), { credentials: "include" }).then(r => r.json());

function copyReport(r: ReportSummary) {
  const lastLanc = r.lancamentos.at(-1);
  const status = lastLanc ? (statusLabel[lastLanc.status]?.label ?? lastLanc.status) : "Sem lançamento";
  const data = new Date(r.createdAt).toLocaleDateString("pt-BR");

  const totalHa = r.lancamentos.reduce((s, l) => s + l.hectares, 0);

  const lines: string[] = [
    data,
    `Fazenda: ${r.fazenda.name}`,
    "",
    `Atividade: ${r.activity.name}`,
    `Talhão: ${r.talhao.codigo}`,
    `Área: ${r.talhao.area.toLocaleString("pt-BR")} ha`,
    `Realizado: ${totalHa.toLocaleString("pt-BR")} ha`,
    `Status: ${status}`,
  ];

  if (r.insumos.length > 0) {
    lines.push("", "Insumos");
    for (const ins of r.insumos) {
      lines.push(`${ins.nome}: ${ins.recomendacaoHa.toLocaleString("pt-BR")} ${ins.unidade}`);
    }
  }

  navigator.clipboard.writeText(lines.join("\n"));
}

function calcActivityMetrics(reports: ReportSummary[]) {
  const nonPending = reports.filter(r => !r._pending);
  const totalArea = reports.reduce((s, r) => s + r.talhao.area, 0);
  const totalHaDone = reports.reduce((s, r) => s + r.lancamentos.reduce((ls, l) => ls + l.hectares, 0), 0);
  const pct = totalArea > 0 ? Math.min(100, (totalHaDone / totalArea) * 100) : 0;

  if (totalArea === 0 || totalHaDone === 0 || nonPending.length === 0) {
    return { totalArea, totalHaDone, pct, forecast: null, rateHaDay: null };
  }

  if (totalHaDone >= totalArea) {
    return { totalArea, totalHaDone, pct: 100, forecast: "Concluído", rateHaDay: null };
  }

  const dates = nonPending.map(r => new Date(r.createdAt).getTime());
  const firstDate = Math.min(...dates);
  const daysSince = (Date.now() - firstDate) / (1000 * 60 * 60 * 24);

  if (daysSince < 0.5) {
    return { totalArea, totalHaDone, pct, forecast: null, rateHaDay: null };
  }

  const rateHaDay = totalHaDone / daysSince;
  const haRemaining = totalArea - totalHaDone;
  const daysRemaining = haRemaining / rateHaDay;
  const estimatedEnd = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000);

  return {
    totalArea,
    totalHaDone,
    pct,
    forecast: estimatedEnd.toLocaleDateString("pt-BR"),
    rateHaDay,
  };
}

function ReportRow({ r, copiedId, onCopy }: { r: ReportSummary; copiedId: string | null; onCopy: (r: ReportSummary) => void }) {
  const lastLancamento = r.lancamentos.at(-1);
  const totalHa = r.lancamentos.reduce((s, l) => s + l.hectares, 0);
  const pct = r.talhao.area > 0 ? Math.min(100, (totalHa / r.talhao.area) * 100) : 0;
  const status = lastLancamento ? statusLabel[lastLancamento.status] : null;

  return (
    <div className="flex items-center gap-2 py-4 -mx-2 px-2">
      {r._pending ? (
        <Link
          to="/reports/$id"
          params={{ id: r.id }}
          className="flex items-center justify-between gap-4 flex-1 min-w-0 hover:bg-muted/40 rounded-md transition-colors px-2 -mx-2 opacity-70"
        >
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">{r.activity.name}</span>
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-400 flex items-center gap-1">
                <WifiOff className="h-3 w-3" />Aguardando sincronização
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{r.talhao.codigo}</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </Link>
      ) : (
        <Link
          to="/reports/$id"
          params={{ id: r.id }}
          className="flex items-center justify-between gap-4 flex-1 min-w-0 hover:bg-muted/40 rounded-md transition-colors px-2 -mx-2"
        >
          <div className="min-w-0 space-y-1.5 w-full">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">{r.talhao.codigo}</span>
              {status && <Badge variant={status.variant} className="text-xs">{status.label}</Badge>}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><Activity className="h-3 w-3" />{totalHa.toLocaleString("pt-BR")} / {r.talhao.area.toLocaleString("pt-BR")} ha</span>
            </div>
            <div className="w-full max-w-xs h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </Link>
      )}

      {!r._pending && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => onCopy(r)}
        >
          {copiedId === r.id
            ? <Check className="h-3.5 w-3.5 text-primary" />
            : <Copy className="h-3.5 w-3.5" />
          }
        </Button>
      )}
    </div>
  );
}

function FazendaSection({
  fazenda,
  reports,
  copiedId,
  onCopy,
}: {
  fazenda: { id: string; name: string };
  reports: ReportSummary[];
  copiedId: string | null;
  onCopy: (r: ReportSummary) => void;
}) {
  const activitiesMap = new Map<string, { id: string; name: string; reports: ReportSummary[] }>();
  for (const r of reports) {
    if (!activitiesMap.has(r.activity.id)) {
      activitiesMap.set(r.activity.id, { id: r.activity.id, name: r.activity.name, reports: [] });
    }
    activitiesMap.get(r.activity.id)!.reports.push(r);
  }
  const activities = Array.from(activitiesMap.values());

  const [activeTab, setActiveTab] = useState(activities[0]?.id ?? "");

  useEffect(() => {
    if (activities.length > 0 && !activitiesMap.has(activeTab)) {
      setActiveTab(activities[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports.length]);

  const activeActivity = activities.find(a => a.id === activeTab);
  const metrics = activeActivity ? calcActivityMetrics(activeActivity.reports) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Tractor className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-base">{fazenda.name}</h2>
        <span className="text-xs text-muted-foreground">
          ({reports.length} ordem{reports.length !== 1 ? "ns" : ""})
        </span>
      </div>

      <Card>
        {/* Abas de atividade */}
        <div
          className="flex gap-1 border-b overflow-x-auto px-4 pt-2"
          style={{ scrollbarWidth: "none" }}
        >
          {activities.map(a => (
            <button
              key={a.id}
              onClick={() => setActiveTab(a.id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                activeTab === a.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {a.name}
              <span className="ml-1.5 text-xs opacity-60">({a.reports.length})</span>
            </button>
          ))}
        </div>

        {activeActivity && metrics && (
          <CardContent className="pt-4">
            {/* Métricas da atividade */}
            <div className="space-y-2 mb-5 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium">
                  {metrics.totalHaDone.toLocaleString("pt-BR")} / {metrics.totalArea.toLocaleString("pt-BR")} ha
                </span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${metrics.pct}%` }}
                />
              </div>
              <div className="flex items-center gap-4 text-xs flex-wrap pt-0.5">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  {metrics.pct.toFixed(1)}% concluído
                </span>
                {metrics.rateHaDay != null && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Activity className="h-3 w-3" />
                    ~{metrics.rateHaDay.toFixed(1)} ha/dia
                  </span>
                )}
                {metrics.forecast && (
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <Calendar className="h-3 w-3" />
                    Previsão: {metrics.forecast}
                  </span>
                )}
              </div>
            </div>

            {/* Lista de talhões */}
            <div className="divide-y">
              {activeActivity.reports.map(r => (
                <ReportRow key={r.id} r={r} copiedId={copiedId} onCopy={onCopy} />
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function ReportsIndexPage() {
  const qc = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: () => fetchReports(qc),
    select: (data) => Array.isArray(data) ? data as ReportSummary[] : [],
  });

  const { data: fazendas = [] } = useQuery({ queryKey: ["fazendas"], queryFn: fetchFazendas });
  const { data: prefs } = useQuery({ queryKey: ["me", "preferences"], queryFn: fetchPreferences });

  const [selectedFazendaId, setSelectedFazendaId] = useState<string>("none");

  useEffect(() => {
    if (prefs) setSelectedFazendaId(prefs.defaultFazendaId ?? "none");
  }, [prefs]);

  const filtered = selectedFazendaId && selectedFazendaId !== "none"
    ? reports.filter(r => r.fazenda.id === selectedFazendaId)
    : reports;

  // Agrupar por fazenda
  const fazendasMap = new Map<string, { fazenda: { id: string; name: string }; reports: ReportSummary[] }>();
  for (const r of filtered) {
    if (!fazendasMap.has(r.fazenda.id)) {
      fazendasMap.set(r.fazenda.id, { fazenda: r.fazenda, reports: [] });
    }
    fazendasMap.get(r.fazenda.id)!.reports.push(r);
  }
  const fazendaGroups = Array.from(fazendasMap.values());

  function handleCopy(r: ReportSummary) {
    copyReport(r);
    setCopiedId(r.id);
    setTimeout(() => setCopiedId(null), 2500);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground text-sm">Acompanhe e registre as atividades de campo</p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link to="/reports/new">
            <Plus /> Iniciar Atividade
          </Link>
        </Button>
      </div>

      {/* Filtro por fazenda */}
      <div className="flex items-center gap-2">
        <Tractor className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select value={selectedFazendaId} onValueChange={setSelectedFazendaId}>
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
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : fazendaGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <FileText className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground text-center">
            Nenhuma atividade iniciada ainda.<br />
            Clique em "Iniciar Atividade" para começar.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {fazendaGroups.map(({ fazenda, reports: fazReports }) => (
            <FazendaSection
              key={fazenda.id}
              fazenda={fazenda}
              reports={fazReports}
              copiedId={copiedId}
              onCopy={handleCopy}
            />
          ))}
        </div>
      )}
    </div>
  );
}
