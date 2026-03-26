import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { routeTree } from "./routeTree.gen";
import { queryClient } from "./lib/query-client";
import { getQueue } from "./lib/offline-queue";
import "./globals.css";

const router = createRouter({
  routeTree,
  context: { queryClient },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function render() {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </React.StrictMode>
  );
}

// Popular o cache com snapshots da fila offline ANTES do primeiro render.
// Isso garante que relatórios pendentes aparecem imediatamente, sem flash de loading.
getQueue().then((queue) => {
  for (const action of queue) {
    if (action.type === "create-report" && action.snapshot && action.meta?.tempId) {
      const pending = action.snapshot as { id: string };
      queryClient.setQueryData(["reports"], (old: unknown) => {
        const list = (Array.isArray(old) ? old : []) as Array<{ id: string }>;
        if (list.some((r) => r.id === pending.id)) return list;
        return [pending, ...list];
      });
      queryClient.setQueryData(["reports", pending.id], (old: unknown) => old ?? pending);
    }

    if (action.type === "add-lancamento" && action.snapshot && action.meta?.reportId) {
      const lanc = action.snapshot as { id: string };
      const reportId = action.meta.reportId;
      queryClient.setQueryData(["reports", reportId], (old: unknown) => {
        if (!old) return old;
        const r = old as { lancamentos: Array<{ id: string }> };
        if (r.lancamentos.some((l) => l.id === lanc.id)) return old;
        return { ...r, lancamentos: [...r.lancamentos, lanc] };
      });
    }
  }
}).finally(() => {
  render();
});
