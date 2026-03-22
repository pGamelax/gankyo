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

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
    return { session };
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

  // Quando voltar online: sincroniza a fila
  useEffect(() => {
    refreshCount();

    if (!isOnline) return;

    let cancelled = false;

    async function sync() {
      const count = await getQueue().then((q) => q.length);
      if (count === 0 || cancelled) return;

      setIsSyncing(true);
      const synced = await flushQueue((action) => {
        // Invalida queries afetadas para atualizar a UI após sync
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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
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
        <header className="flex items-center gap-3 px-4 h-14 border-b bg-background shrink-0 md:hidden">
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

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-5xl mx-auto w-full">
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
