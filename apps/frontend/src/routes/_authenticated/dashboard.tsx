import { createFileRoute, Link } from "@tanstack/react-router";
import { apiUrl } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import {
  Tractor, Layers, FileText, Activity, CheckCircle2,
  Clock, RotateCcw, TrendingUp, ArrowRight, Target,
  AlertTriangle, Wheat,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
    ordensSemLancamento: number;
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
  porAtividade: {
    id: string;
    nome: string;
    ordens: number;
    haRealizado: number;
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

const statusMeta: Record<StatusKey, {
  label: string;
  short: string;
  icon: React.ElementType;
  variant: "default" | "secondary" | "outline" | "destructive";
  bar: string;
  text: string;
  bg: string;
}> = {
  iniciado:            { label: "Iniciado",     short: "Inic.",   icon: Clock,        variant: "secondary", bar: "bg-amber-400",  text: "text-amber-600",  bg: "bg-amber-50 dark:bg-amber-950/30"  },
  andamento:           { label: "Em Andamento", short: "Andamento", icon: TrendingUp, variant: "default",   bar: "bg-blue-500",   text: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-950/30"    },
  finalizado:          { label: "Finalizado",   short: "Final.",  icon: CheckCircle2, variant: "outline",   bar: "bg-emerald-500",text: "text-emerald-600",bg: "bg-emerald-50 dark:bg-emerald-950/30"},
  iniciado_finalizado: { label: "Inic./Final.", short: "I/F",     icon: RotateCcw,    variant: "outline",   bar: "bg-emerald-400",text: "text-emerald-600",bg: "bg-emerald-50 dark:bg-emerald-950/30"},
};

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch(apiUrl("/dashboard"), { credentials: "include" });
  if (!res.ok) throw new Error("Falha ao carregar dashboard");
  return res.json();
}

function ha(n: number, decimals = 1) {
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: decimals })} ha`;
}

function pctBarColor(pct: number) {
  if (pct >= 75) return "bg-emerald-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-red-500";
}
function pctTextColor(pct: number) {
  if (pct >= 75) return "text-emerald-600";
  if (pct >= 40) return "text-amber-600";
  return "text-red-600";
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

// ── Componente KPI strip ──────────────────────────────────────────────────────
function StatItem({
  label, value, sub, accent = false,
}: {
  label: string; value: React.ReactNode; sub?: string; accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-6 py-5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold tracking-tight leading-none mt-1 ${accent ? "text-primary" : ""}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ── Componente Fazenda row ────────────────────────────────────────────────────
function FazendaRow({
  f, rank,
}: {
  f: DashboardData["fazendas"][0];
  rank: number;
}) {
  const finalizadas = f.statusCount.finalizado + f.statusCount.iniciado_finalizado;

  return (
    <div className="grid grid-cols-[2rem_1fr_auto] gap-x-4 items-center px-5 py-3.5 hover:bg-muted/40 transition-colors group">
      {/* Rank */}
      <span className="text-xs text-muted-foreground font-mono tabular-nums text-center">{rank}</span>

      {/* Info + bar */}
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold truncate leading-none">{f.name}</p>
          <span className="text-xs text-muted-foreground shrink-0">
            {ha(f.haRealizado, 0)} / {ha(f.haTotal, 0)}
          </span>
        </div>

        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pctBarColor(f.pct)}`}
            style={{ width: `${f.pct}%` }}
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{f.talhoes} talhão(ões)</span>
          <span>·</span>
          <span>{f.ordens} ordem(ns)</span>
          {f.statusCount.andamento > 0 && (
            <>
              <span>·</span>
              <span className="text-blue-600 font-medium">{f.statusCount.andamento} em andamento</span>
            </>
          )}
          {finalizadas > 0 && (
            <>
              <span>·</span>
              <span className="text-emerald-600 font-medium">{finalizadas} finalizada(s)</span>
            </>
          )}
        </div>
      </div>

      {/* Pct */}
      <div className="text-right shrink-0 w-16">
        <p className={`text-xl font-bold tabular-nums leading-none ${pctTextColor(f.pct)}`}>
          {f.pct.toFixed(1)}%
        </p>
        {f.pct < 50 && f.ordens > 0 && (
          <p className="text-xs text-amber-500 mt-0.5 font-medium">atenção</p>
        )}
      </div>
    </div>
  );
}

// ── Componente Atividade row ──────────────────────────────────────────────────
function AtividadeRow({ a, maxOrdens }: { a: DashboardData["porAtividade"][0]; maxOrdens: number }) {
  const finalizadas = a.statusCount.finalizado + a.statusCount.iniciado_finalizado;
  const widthPct = maxOrdens > 0 ? (a.ordens / maxOrdens) * 100 : 0;

  return (
    <div className="px-4 py-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium truncate leading-none">{a.nome}</p>
        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{a.ordens} ordem(ns)</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary/70 rounded-full transition-all" style={{ width: `${widthPct}%` }} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {a.statusCount.andamento > 0 && (
          <span className="text-xs text-blue-600 font-medium">{a.statusCount.andamento} and.</span>
        )}
        {finalizadas > 0 && (
          <span className="text-xs text-emerald-600 font-medium">{finalizadas} final.</span>
        )}
        {a.statusCount.iniciado > 0 && (
          <span className="text-xs text-amber-600 font-medium">{a.statusCount.iniciado} inic.</span>
        )}
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
function DashboardPage() {
  const { session } = useRouteContext({ from: "/_authenticated" });
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboard });

  const statusTotais = data
    ? data.fazendas.reduce(
        (acc, f) => {
          acc.iniciado           += f.statusCount.iniciado;
          acc.andamento          += f.statusCount.andamento;
          acc.finalizado         += f.statusCount.finalizado;
          acc.iniciado_finalizado+= f.statusCount.iniciado_finalizado;
          return acc;
        },
        { iniciado: 0, andamento: 0, finalizado: 0, iniciado_finalizado: 0 }
      )
    : null;

  const ordensFinalizadas  = statusTotais ? statusTotais.finalizado + statusTotais.iniciado_finalizado : 0;
  const ordensEmAndamento  = statusTotais?.andamento ?? 0;
  const pctGeral           = data?.totais.haTotal
    ? Math.min(100, (data.totais.haRealizado / data.totais.haTotal) * 100) : 0;
  const pctConclusao       = data?.totais.ordens
    ? (ordensFinalizadas / data.totais.ordens) * 100 : 0;
  const haRestante         = data ? Math.max(0, data.totais.haTotal - data.totais.haRealizado) : 0;

  const fazendasOrdenadas  = data ? [...data.fazendas].sort((a, b) => a.pct - b.pct) : [];
  const fazendasAlerta     = fazendasOrdenadas.filter((f) => f.pct < 50 && f.ordens > 0).length;
  const maxAtivOrdens      = data ? Math.max(...data.porAtividade.map((a) => a.ordens), 1) : 1;

  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="space-y-5">

      {/* ── Cabeçalho ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Painel Gerencial</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {session.user.name} · {hoje}
          </p>
        </div>

        {!isLoading && data && (
          <div className="flex flex-wrap gap-2">
            {ordensEmAndamento > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                {ordensEmAndamento} em andamento
              </div>
            )}
            {data.totais.ordensSemLancamento > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-3 w-3" />
                {data.totais.ordensSemLancamento} sem lançamento
              </div>
            )}
            {fazendasAlerta > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 border border-red-200 dark:border-red-800">
                <AlertTriangle className="h-3 w-3" />
                {fazendasAlerta} fazenda(s) abaixo de 50%
              </div>
            )}
            {ordensFinalizadas > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="h-3 w-3" />
                {ordensFinalizadas} finalizada(s)
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── KPI Strip ─────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-6 py-5 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        ) : data && (
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0">
            <StatItem
              label="Ha Realizados"
              value={ha(data.totais.haRealizado, 1)}
              sub={`de ${ha(data.totais.haTotal, 0)} cadastrados`}
              accent
            />
            <StatItem
              label="Ha Restantes"
              value={ha(haRestante, 1)}
              sub={`${pctGeral.toFixed(1)}% do total concluído`}
            />
            <StatItem
              label="Ordens de Serviço"
              value={data.totais.ordens}
              sub={`${ordensFinalizadas} finalizada(s) · ${data.totais.talhoes} talhão(ões)`}
            />
            <StatItem
              label="Taxa de Conclusão"
              value={`${pctConclusao.toFixed(0)}%`}
              sub={`${data.totais.fazendas} fazenda(s) · ${ordensEmAndamento} em andamento`}
            />
          </div>
        )}
      </Card>

      {/* ── Barra de progresso geral + distribuição ───────────────── */}
      {data && statusTotais && (
        <Card>
          <CardContent className="pt-5 pb-4 space-y-3">
            {/* Progresso geral */}
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Progresso Geral de Área</span>
              <span className={`font-bold tabular-nums ${pctTextColor(pctGeral)}`}>
                {pctGeral.toFixed(1)}%
              </span>
            </div>
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pctBarColor(pctGeral)}`}
                style={{ width: `${pctGeral}%` }}
              />
            </div>

            {data.totais.ordens > 0 && (
              <>
                <Separator className="my-1" />

                {/* Distribuição de status */}
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">Distribuição por Status</span>
                  <span className="text-xs text-muted-foreground">{data.totais.ordens} ordens</span>
                </div>
                <div className="flex h-2.5 w-full rounded-full overflow-hidden gap-0.5">
                  {statusTotais.andamento > 0 && (
                    <div className="bg-blue-500" style={{ width: `${(statusTotais.andamento / data.totais.ordens) * 100}%` }} />
                  )}
                  {statusTotais.iniciado > 0 && (
                    <div className="bg-amber-400" style={{ width: `${(statusTotais.iniciado / data.totais.ordens) * 100}%` }} />
                  )}
                  {(statusTotais.finalizado + statusTotais.iniciado_finalizado) > 0 && (
                    <div className="bg-emerald-500" style={{ width: `${((statusTotais.finalizado + statusTotais.iniciado_finalizado) / data.totais.ordens) * 100}%` }} />
                  )}
                  {data.totais.ordensSemLancamento > 0 && (
                    <div className="bg-muted-foreground/30" style={{ width: `${(data.totais.ordensSemLancamento / data.totais.ordens) * 100}%` }} />
                  )}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  {([
                    ["andamento",  statusTotais.andamento,  "bg-blue-500",    "Em Andamento"],
                    ["iniciado",   statusTotais.iniciado,   "bg-amber-400",   "Iniciado"],
                    ["finalizado", statusTotais.finalizado + statusTotais.iniciado_finalizado, "bg-emerald-500", "Finalizados"],
                    ...(data.totais.ordensSemLancamento > 0
                      ? [["sem", data.totais.ordensSemLancamento, "bg-muted-foreground/30", "Sem lançamento"]] as const
                      : []),
                  ] as const).filter(([, count]) => count > 0).map(([key, count, color, label]) => (
                    <div key={key} className="flex items-center gap-1.5 text-xs">
                      <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${color}`} />
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold tabular-nums">{count}</span>
                      <span className="text-muted-foreground">({((count / data.totais.ordens) * 100).toFixed(0)}%)</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Grid principal ─────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">

        {/* ── Fazendas ─────────────────────────────────────── 2/3 ── */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-sm font-semibold">Desempenho por Fazenda</h2>
            <span className="text-xs text-muted-foreground">
              Ordenado por progresso ↑
            </span>
          </div>

          <Card className="overflow-hidden">
            {/* Cabeçalho da tabela */}
            <div className="grid grid-cols-[2rem_1fr_4rem] gap-x-4 px-5 py-2.5 bg-muted/60 border-b text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span className="text-center">#</span>
              <span>Fazenda</span>
              <span className="text-right">Progresso</span>
            </div>

            {isLoading ? (
              <div className="p-5 space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : fazendasOrdenadas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <Tractor className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Nenhuma fazenda cadastrada</p>
              </div>
            ) : (
              <div className="divide-y">
                {fazendasOrdenadas.map((f, i) => (
                  <FazendaRow key={f.id} f={f} rank={i + 1} />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── Coluna direita ───────────────────────────────── 1/3 ── */}
        <div className="space-y-5">

          {/* Por atividade */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-sm font-semibold">Por Atividade</h2>
              {data && (
                <span className="text-xs text-muted-foreground">
                  {data.porAtividade.length} tipo(s)
                </span>
              )}
            </div>

            <Card>
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <Skeleton className="h-3.5 w-36" />
                      <Skeleton className="h-1.5 w-full" />
                    </div>
                  ))}
                </div>
              ) : data?.porAtividade.length === 0 ? (
                <CardContent className="flex flex-col items-center justify-center py-10 gap-2">
                  <Wheat className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">Sem atividades</p>
                </CardContent>
              ) : (
                <div className="divide-y">
                  {data?.porAtividade.map((a) => (
                    <AtividadeRow key={a.id} a={a} maxOrdens={maxAtivOrdens} />
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Atividades recentes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-sm font-semibold">Últimas Atividades</h2>
              <Link
                to="/reports"
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                Ver todas <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <Card>
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-1.5 w-full" />
                      </div>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : data?.recentes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <FileText className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">Sem atividades</p>
                </div>
              ) : (
                <div className="divide-y">
                  {data?.recentes.slice(0, 8).map((r) => {
                    const meta   = r.ultimoStatus ? statusMeta[r.ultimoStatus] : null;
                    const pct    = r.haTalhao > 0 ? Math.min(100, (r.haRealizado / r.haTalhao) * 100) : 0;
                    const dias   = Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 86_400_000);
                    const diasLbl = dias === 0 ? "Hoje" : dias === 1 ? "Ontem" : `${dias}d`;

                    return (
                      <Link
                        key={r.id}
                        to="/reports/$id"
                        params={{ id: r.id }}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-xs font-semibold leading-tight truncate">{r.atividade}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.fazenda} · {r.talhao}</p>
                          <div className="flex items-center gap-2 pt-0.5">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pctBarColor(pct)}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0 tabular-nums w-7 text-right">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1 pt-0.5">
                          {meta && (
                            <Badge variant={meta.variant} className="text-xs h-5 px-1.5">
                              {meta.short}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground tabular-nums">{diasLbl}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
