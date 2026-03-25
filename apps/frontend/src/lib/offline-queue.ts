/**
 * Fila offline baseada em IndexedDB.
 *
 * NÃO usa Background Sync API — essa API não existe no iOS Safari.
 * A sincronização é feita manualmente no evento `online` do browser,
 * garantindo compatibilidade total com iOS 16.4+.
 */

const DB_NAME = "gankyo-offline";
const STORE   = "queue";
const DB_VER  = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      (e.target as IDBOpenDBRequest).result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export type OfflineActionType =
  | "create-report"
  | "add-lancamento"
  | "edit-lancamento"
  | "delete-lancamento";

export type OfflineAction = {
  id:        string;
  type:      OfflineActionType;
  method:    "POST" | "PATCH" | "DELETE";
  url:       string;
  body?:     object;
  /** Extra data used post-sync (e.g. reportId to invalidate, tempId mapping) */
  meta?:     Record<string, string>;
  /** Full optimistic object — used to rehydrate React Query cache on app restart */
  snapshot?: unknown;
  createdAt: number;
};

export async function enqueue(
  action: Omit<OfflineAction, "id" | "createdAt">
): Promise<OfflineAction> {
  const db = await openDb();
  const item: OfflineAction = {
    ...action,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror    = () => reject(tx.error);
  });
}

export async function getQueue(): Promise<OfflineAction[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as OfflineAction[]);
    req.onerror   = () => reject(req.error);
  });
}

export async function dequeue(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

/**
 * Tenta enviar todas as ações pendentes ao servidor em ordem.
 * Resolve IDs temporários: se um create-report retornar um ID real,
 * as ações seguintes que referenciam o tempId terão a URL corrigida.
 *
 * @param onSynced Callback para cada ação sincronizada com sucesso.
 * @returns Número de ações sincronizadas.
 */
export async function flushQueue(
  onSynced?: (action: OfflineAction, serverData?: unknown) => void
): Promise<number> {
  const queue = await getQueue();
  let synced = 0;
  // tempId → realId mapping built as create-reports are resolved
  const idMap: Record<string, string> = {};

  for (const action of queue) {
    try {
      // Replace any temp IDs in the URL with real server IDs
      let url = action.url;
      for (const [tempId, realId] of Object.entries(idMap)) {
        url = url.replaceAll(tempId, realId);
      }

      const isDelete = action.method === "DELETE";
      const res = await fetch(url, {
        method:      action.method,
        headers:     isDelete ? undefined : { "Content-Type": "application/json" },
        credentials: "include",
        body:        action.body ? JSON.stringify(action.body) : undefined,
      });

      if (res.ok) {
        let data: unknown;
        try { data = await res.json(); } catch {}

        // Store tempId → realId so downstream actions can resolve their URLs
        if (action.type === "create-report" && action.meta?.tempId) {
          const realId = (data as { id?: string })?.id;
          if (realId) idMap[action.meta.tempId] = realId;
        }

        await dequeue(action.id);
        onSynced?.(action, data);
        synced++;
      }
    } catch {
      // Still offline or network error — keep in queue
    }
  }

  return synced;
}
