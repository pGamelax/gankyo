import { WifiOff, RefreshCw } from "lucide-react";

interface OfflineBannerProps {
  pendingCount: number;
  isSyncing: boolean;
}

export function OfflineBanner({ pendingCount, isSyncing }: OfflineBannerProps) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 rounded-xl bg-amber-600 text-white px-4 py-3 shadow-xl text-sm">
          {isSyncing
            ? <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
            : <WifiOff className="h-4 w-4 shrink-0" />
          }
          <span className="flex-1 leading-snug">
            {isSyncing
              ? "Sincronizando dados pendentes..."
              : <>
                  Você está <strong>offline</strong>.
                  {pendingCount > 0 && (
                    <> <strong>{pendingCount}</strong> ação{pendingCount > 1 ? "ões" : ""} pendente{pendingCount > 1 ? "s" : ""} para sincronizar.</>
                  )}
                </>
            }
          </span>
        </div>
      </div>
    </div>
  );
}

export function SyncedBanner() {
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 rounded-xl bg-primary text-primary-foreground px-4 py-3 shadow-xl text-sm">
          <RefreshCw className="h-4 w-4 shrink-0" />
          <span>Dados sincronizados com sucesso.</span>
        </div>
      </div>
    </div>
  );
}
