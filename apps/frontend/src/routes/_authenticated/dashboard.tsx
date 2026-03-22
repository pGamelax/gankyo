import { createFileRoute, Link } from "@tanstack/react-router";
import { apiUrl } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
  Tractor, Layers, FileText, TrendingUp, ChevronRight,
  Activity, CheckCircle2, Clock, RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouteContext } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type StatusKey = "iniciado" | "andamento" | "finalizado" | "iniciado_finalizado";

type DashboardData = {
  totais: {
    fazendas: number;
    talhoes: number;
    ordens: number;
    haTotal: number;
    haRealizado: number;
  };
  fazendas: {
    id: string;
    name: string;
    talhoes: number;
    ordens: number;
    haTotal: number;
    haRealizado: number;
    pct: number;
    statusCount: Record<StatusKey, number>;
  }[];
  recentes: {
    id: string;
    fazenda: string;
    talhao: string;
    atividade: string;
    ultimoStatus: StatusKey | null;
    haRealizado: number;
    haTalhao: number;
    createdAt: string;
  }[];
};

const statusMeta: Record<StatusKey, { label: string; icon: React.ElementType; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  iniciado:            { label: "Iniciado",           icon: Clock,        variant: "secondary" },
  andamento:           { label: "Em Andamento",        icon: TrendingUp,   variant: "default"   },
  finalizado:          { label: "Finalizado",          icon: CheckCircle2, variant: "outline"   },
  iniciado_finalizado: { label: "Inic./Finalizado",    icon: RotateCcw,    variant: "outline"   },
};

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch(apiUrl("/dashboard"), { credentials: "include" });
  if (!res.ok) throw new Error("Falha ao carregar dashboard");
  return res.json();
}

function KpiCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
      <div
        className="h-full bg-primary rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function DashboardPage() {
  const { session } = useRouteContext({ from: "/_authenticated" });
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboard });

  const pctGeral = data
    ? data.totais.haTotal > 0
      ? Math.min(100, (data.totais.haRealizado / data.totais.haTotal) * 100)
      : 0
    : 0;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Bem-vindo, {session.user.name} — visão geral de todas as fazendas
        </p>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="h-24 animate-pulse bg-muted rounded-md mt-6" /></Card>
          ))}
        </div>
      ) : data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={Tractor}  label="Fazendas"       value={data.totais.fazendas} sub="cadastradas" />
          <KpiCard icon={Layers}   label="Talhões"        value={data.totais.talhoes}  sub={`${data.totais.haTotal.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ha totais`} />
          <KpiCard icon={FileText} label="Ordens de Serviço" value={data.totais.ordens} sub="em todas as fazendas" />
          <KpiCard
            icon={Activity}
            label="Ha Realizados"
            value={`${data.totais.haRealizado.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ha`}
            sub={`${pctGeral.toFixed(1)}% do total`}
          />
        </div>
      )}

      {/* Progresso geral */}
      {data && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Progresso Geral</CardTitle>
              <span className="text-sm font-semibold text-primary">{pctGeral.toFixed(1)}%</span>
            </div>
            <CardDescription>
              {data.totais.haRealizado.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ha realizados
              de {data.totais.haTotal.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ha totais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProgressBar pct={pctGeral} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Por fazenda */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-semibold">Por Fazenda</h2>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}><CardContent className="h-28 animate-pulse bg-muted rounded-md mt-6" /></Card>
              ))}
            </div>
          ) : data?.fazendas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
                <Tractor className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nenhuma fazenda cadastrada</p>
              </CardContent>
            </Card>
          ) : (
            data?.fazendas.map((f) => (
              <Card key={f.id}>
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{f.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {f.talhoes} talhão(ões) · {f.ordens} ordem(ns)
                      </p>
                    </div>
                    <span className="text-sm font-bold text-primary shrink-0">{f.pct.toFixed(1)}%</span>
                  </div>

                  <ProgressBar pct={f.pct} />

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{f.haRealizado.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ha realizados</span>
                    <span>{f.haTotal.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ha total</span>
                  </div>

                  {/* Status mini-badges */}
                  {f.ordens > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(Object.entries(f.statusCount) as [StatusKey, number][])
                        .filter(([, count]) => count > 0)
                        .map(([key, count]) => {
                          const meta = statusMeta[key];
                          return (
                            <Badge key={key} variant={meta.variant} className="text-xs gap-1">
                              <meta.icon className="h-3 w-3" />
                              {count} {meta.label}
                            </Badge>
                          );
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Atividades recentes */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold">Atividades Recentes</h2>
          <Card>
            <CardContent className="pt-4 divide-y p-0">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-10 animate-pulse bg-muted rounded-md" />
                  ))}
                </div>
              ) : data?.recentes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <FileText className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">Sem atividades</p>
                </div>
              ) : (
                data?.recentes.map((r) => {
                  const meta = r.ultimoStatus ? statusMeta[r.ultimoStatus] : null;
                  const pct = r.haTalhao > 0 ? Math.min(100, (r.haRealizado / r.haTalhao) * 100) : 0;
                  return (
                    <Link
                      key={r.id}
                      to="/reports/$id"
                      params={{ id: r.id }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{r.atividade}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {r.fazenda} · {r.talhao}
                        </p>
                        <div className="mt-1.5 h-1 w-full bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {meta && (
                          <Badge variant={meta.variant} className="text-xs">
                            {meta.label}
                          </Badge>
                        )}
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
