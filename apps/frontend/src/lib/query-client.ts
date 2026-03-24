import { QueryClient, dehydrate, hydrate } from "@tanstack/react-query";

const CACHE_KEY = "gankyo:qcache";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            0,               // sempre obsoleto → refetch ao focar o app
      gcTime:               Infinity,        // nunca remove do cache → disponível offline
      networkMode:          "offlineFirst",  // serve cache mesmo offline
      refetchOnWindowFocus: true,            // refetch quando PWA volta ao foreground
      retry: (count) => navigator.onLine && count < 1,
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});

// ── Rehydrate on startup ──────────────────────────────────────────────────────
try {
  const raw = localStorage.getItem(CACHE_KEY);
  if (raw) hydrate(queryClient, JSON.parse(raw));
} catch {}

// ── Persist on changes (debounced 500 ms) ────────────────────────────────────
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
queryClient.getQueryCache().subscribe(() => {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(dehydrate(queryClient)));
    } catch {}
  }, 500);
});
