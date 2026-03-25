import {
  createFileRoute,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Menu, TreePine } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import AppSidebar from "@/components/layout/app-sidebar";
import { OfflineBanner, SyncedBanner } from "@/components/offline-banner";
import { useOnline } from "@/hooks/use-online";
import { flushQueue, getQueue } from "@/lib/offline-queue";
import { apiUrl } from "@/lib/api";

const SESSION_CACHE_KEY = "gankyo:session";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    // Tenta buscar a sessão da rede
    const { data: session } = await authClient.getSession().catch(() => ({ data: null }));

    if (session) {
      // Salva no localStorage para uso offline
      try { localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(session)); } catch {}
      return { session };
    }

    // Sem sessão — tenta cache local (offline ou PWA cold start)
    try {
      const cached = localStorage.getItem(SESSION_CACHE_KEY);
      if (cached) return { session: JSON.parse(cached) };
    } catch {}

    throw redirect({ to: "/login" });
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isOnline = useOnline();
  const qc = useQueryClient();

  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing,   setIsSyncing   ] = useState(false);
  const [showSynced,  setShowSynced  ] = useState(false);

  // Atualiza contagem de pendentes
  const refreshCount = useCallback(() => {
    getQueue().then((q) => setPendingCount(q.length));
  }, []);

  // Reidrata cache do React Query a partir dos snapshots da fila (necessário ao reiniciar o app)
  const rehydrateQueue = useCallback(async () => {
    const queue = await getQueue();
    for (const action of queue) {
      if (action.type === "create-report" && action.snapshot && action.meta?.tempId) {
        const pending = action.snapshot as { id: string };
        qc.setQueryData(["reports"], (old: unknown[] | undefined) => {
          const list = (old ?? []) as Array<{ id: string }>;
          if (list.some(r => r.id === pending.id)) return list;
          return [pending, ...list];
        });
        qc.setQueryData(["reports", pending.id], (old: unknown) => old ?? pending);
      }
      if (action.type === "add-lancamento" && action.snapshot && action.meta?.reportId) {
        const lanc = action.snapshot as { id: string };
        const reportId = action.meta.reportId;
        qc.setQueryData(["reports", reportId], (old: unknown) => {
          if (!old) return old;
          const r = old as { lancamentos: Array<{ id: string }> };
          if (r.lancamentos.some(l => l.id === lanc.id)) return old;
          return { ...r, lancamentos: [...r.lancamentos, lanc] };
        });
      }
    }
  }, [qc]);

  // Na montagem: reidrata imediatamente (cobre o caso offline)
  useEffect(() => {
    rehydrateQueue();
  }, [rehydrateQueue]);

  // Quando voltar online: sincroniza a fila
  useEffect(() => {
    refreshCount();

    if (!isOnline) return;

    let cancelled = false;

    async function sync() {
      const count = await getQueue().then((q) => q.length);
      if (count === 0 || cancelled) return;

      setIsSyncing(true);
      const synced = await flushQueue((action, serverData) => {
        // Remove optimistic (temp) entry and let invalidation fetch the real data
        if (action.type === "create-report" && action.meta?.tempId) {
          const tempId = action.meta.tempId;
          const realId = (serverData as { id?: string })?.id;
          // Swap tempId → realId in the reports list cache
          qc.setQueryData(["reports"], (old: unknown[] | undefined) =>
            (old ?? []).map((r: unknown) => {
              const report = r as { id: string; _pending?: boolean };
              if (report.id !== tempId) return r;
              return { ...report, id: realId ?? report.id, _pending: false };
            })
          );
        }
        qc.invalidateQueries({ queryKey: ["reports"] });
        if (action.meta?.reportId) {
          qc.invalidateQueries({ queryKey: ["reports", action.meta.reportId] });
        }
      });

      if (cancelled) return;
      setIsSyncing(false);
      setPendingCount(0);

      if (synced > 0) {
        setShowSynced(true);
        setTimeout(() => setShowSynced(false), 3000);
      }
    }

    sync();
    return () => { cancelled = true; };
  }, [isOnline, qc, refreshCount]);

  // Expõe refreshCount globalmente para as mutations usarem após enqueue
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__gankyoRefreshPendingCount = refreshCount;
  }, [refreshCount]);

  // SSE — sincronização real-time quando online
  useEffect(() => {
    if (!isOnline) return;

    let es: EventSource | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 1000;
    let cancelled = false;

    function connect() {
      if (cancelled) return;

      es = new EventSource(apiUrl("/events"), { withCredentials: true });

      es.onmessage = (e) => {
        retryDelay = 1000; // reset backoff on successful message
        try {
          const { keys, ping } = JSON.parse(e.data) as { keys?: string[]; ping?: boolean };
          if (ping || !keys) return;
          // Não refaz fetch enquanto há itens pendentes offline — evita apagar dados optimistas
          if (pendingCount > 0) return;
          for (const key of keys) {
            qc.refetchQueries({ queryKey: key.split("/"), type: "active" });
          }
        } catch { /* ignore */ }
      };

      es.onerror = () => {
        es?.close();
        es = null;
        if (cancelled) return;
        // Reconecta com backoff exponencial (máx 30s)
        retryTimeout = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 30_000);
          connect();
        }, retryDelay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      es?.close();
    };
  }, [isOnline, qc]);

  // Ao abrir o app online: sincroniza todos os relatórios dos últimos 60 dias
  useEffect(() => {
    if (!isOnline) return;

    let cancelled = false;

    async function prefetchRecent() {
      const get = (path: string) =>
        fetch(apiUrl(path), { credentials: "include" }).then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.json();
        });

      // 1. Dados base — sempre atualizados ao abrir
      type ReportItem = { id: string; createdAt: string; _pending?: boolean };
      let reports: ReportItem[] = [];
      try {
        [reports] = await Promise.all([
          qc.fetchQuery<ReportItem[]>({ queryKey: ["reports"],          queryFn: () => get("/reports")         }),
          qc.fetchQuery({              queryKey: ["fazendas"],          queryFn: () => get("/fazendas")        }),
          qc.fetchQuery({              queryKey: ["talhoes"],           queryFn: () => get("/talhoes")         }),
          qc.fetchQuery({              queryKey: ["activities"],        queryFn: () => get("/activities")      }),
          qc.fetchQuery({              queryKey: ["me", "preferences"], queryFn: () => get("/me/preferences") }),
        ]);
      } catch {
        return; // offline ou erro — ignora silenciosamente
      }

      if (cancelled) return;

      // 2. Detalhes de relatórios dos últimos 60 dias (exclui pendentes offline)
      const since = Date.now() - 60 * 24 * 60 * 60 * 1000;
      const recent = reports.filter(
        (r) => !r._pending && new Date(r.createdAt).getTime() >= since
      );

      // 3. Pré-carrega detalhes em lotes de 5
      const BATCH = 5;
      for (let i = 0; i < recent.length; i += BATCH) {
        if (cancelled) break;
        await Promise.all(
          recent.slice(i, i + BATCH).map((r) =>
            qc.prefetchQuery({
              queryKey: ["reports", r.id],
              queryFn:  () => get(`/reports/${r.id}`),
            })
          )
        );
      }
    }

    prefetchRecent().then(() => { if (!cancelled) rehydrateQueue(); });
    return () => { cancelled = true; };
  }, [isOnline, qc, rehydrateQueue]);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Backdrop mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <AppSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header mobile */}
        <header
          className="flex items-center gap-3 px-4 border-b bg-background shrink-0 md:hidden"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            height: "calc(3.5rem + env(safe-area-inset-top))",
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary text-primary-foreground">
              <TreePine size={14} />
            </div>
            <span className="font-semibold text-sm">Gankyo</span>
          </div>
          {/* Indicador offline no header mobile */}
          {!isOnline && (
            <span className="ml-auto text-xs font-medium text-amber-600 flex items-center gap-1">
              Offline
            </span>
          )}
        </header>

        <main
          className="flex-1 overflow-y-auto pt-4 md:pt-6"
          style={{
            paddingLeft: "max(1rem, env(safe-area-inset-left))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
            paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
          }}
        >
          <div className="max-w-5xl mx-auto w-full min-w-0">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Banner offline (apenas quando offline) */}
      {!isOnline && (
        <OfflineBanner pendingCount={pendingCount} isSyncing={isSyncing} />
      )}

      {/* Banner de sincronização concluída (aparece brevemente ao voltar online) */}
      {isOnline && showSynced && <SyncedBanner />}
    </div>
  );
}
