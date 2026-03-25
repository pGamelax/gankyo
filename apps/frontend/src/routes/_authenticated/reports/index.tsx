import { createFileRoute, Link } from "@tanstack/react-router";
import { apiUrl } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { FileText, Plus, Tractor, Layers, Activity, ChevronRight, Copy, Check, WifiOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/reports/")({
  component: ReportsIndexPage,
});

const statusLabel: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  iniciado:           { label: "Iniciado",           variant: "secondary" },
  andamento:          { label: "Em Andamento",        variant: "default"   },
  finalizado:         { label: "Finalizado",          variant: "outline"   },
  iniciado_finalizado:{ label: "Iniciado/Finalizado", variant: "outline"   },
};

type ReportSummary = {
  id: string;
  createdAt: string;
  fazenda: { id: string; name: string };
  talhao: { id: string; codigo: string; area: number };
  activity: { id: string; name: string };
  insumos: { id: string; nome: string; recomendacaoHa: number }[];
  lancamentos: { id: string; hectares: number; status: string }[];
  _pending?: boolean;
};

type Fazenda = { id: string; name: string };
type Preferences = { defaultFazendaId: string | null };

async function fetchReports(): Promise<ReportSummary[]> {
  const res = await fetch(apiUrl("/reports"), { credentials: "include" });
  if (!res.ok) throw new Error("Falha ao carregar relatórios");
  return res.json();
}

const fetchFazendas = (): Promise<Fazenda[]> =>
  fetch(apiUrl("/fazendas"), { credentials: "include" }).then(r => r.json());

const fetchPreferences = (): Promise<Preferences> =>
  fetch(apiUrl("/me/preferences"), { credentials: "include" }).then(r => r.json());

function copyReport(r: ReportSummary) {
  const lastLanc = r.lancamentos.at(-1);
  const status = lastLanc ? (statusLabel[lastLanc.status]?.label ?? lastLanc.status) : "Sem lançamento";
  const data = new Date(r.createdAt).toLocaleDateString("pt-BR");

  const lines: string[] = [
    data,
    `Fazenda: ${r.fazenda.name}`,
    "",
    r.activity.name,
    `Talhão: ${r.talhao.codigo}`,
    `Área: ${r.talhao.area.toLocaleString("pt-BR")} ha`,
    `Status: ${status}`,
  ];

  if (r.insumos.length > 0) {
    lines.push("", "Insumos");
    for (const ins of r.insumos) {
      lines.push(`${ins.nome} — ${ins.recomendacaoHa.toLocaleString("pt-BR")} / ha`);
    }
  }

  navigator.clipboard.writeText(lines.join("\n"));
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
              <span className="flex items-center gap-1"><Tractor className="h-3 w-3" />{r.fazenda.name}</span>
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
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">{r.talhao.codigo}</span>
              {status && <Badge variant={status.variant} className="text-xs">{status.label}</Badge>}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><Tractor className="h-3 w-3" />{r.fazenda.name}</span>
              <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{r.talhao.codigo}</span>
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

function ReportsIndexPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: fetchReports,
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

  // Group by activity
  const activitiesMap = new Map<string, { id: string; name: string; reports: ReportSummary[] }>();
  for (const r of filtered) {
    const key = r.activity.id;
    if (!activitiesMap.has(key)) {
      activitiesMap.set(key, { id: r.activity.id, name: r.activity.name, reports: [] });
    }
    activitiesMap.get(key)!.reports.push(r);
  }
  const activities = Array.from(activitiesMap.values());

  // Set default tab when activities load
  useEffect(() => {
    if (activities.length > 0 && (!activeTab || !activitiesMap.has(activeTab))) {
      setActiveTab(activities[0].id);
    }
  }, [filtered.length, selectedFazendaId]);

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
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <FileText className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground text-center">
            Nenhuma atividade iniciada ainda.<br />
            Clique em "Iniciar Atividade" para começar.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-1 border-b overflow-x-auto scrollbar-none" style={{ scrollbarWidth: "none" }}>
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

          {activities.filter(a => a.id === activeTab).map(a => (
            <Card key={a.id}>
              <CardHeader>
                <CardTitle>{a.name}</CardTitle>
                <CardDescription>{a.reports.length} ordem(ns) registrada(s)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {a.reports.map(r => (
                    <ReportRow key={r.id} r={r} copiedId={copiedId} onCopy={handleCopy} />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
