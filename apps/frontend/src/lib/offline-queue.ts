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

export type OfflineActionType = "create-report" | "add-lancamento";

export type OfflineAction = {
  id:        string;
  type:      OfflineActionType;
  url:       string;
  body:      object;
  /** Dados extras para uso após sincronização (ex: reportId para invalidar queries) */
  meta?:     Record<string, string>;
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
 * Tenta enviar todas as ações pendentes ao servidor.
 * Chame isso no evento `online` ou ao montar o app quando online.
 *
 * @param onSynced Callback chamado para cada ação sincronizada com sucesso.
 * @returns Número de ações sincronizadas.
 */
export async function flushQueue(
  onSynced?: (action: OfflineAction) => void
): Promise<number> {
  const queue = await getQueue();
  let synced = 0;

  for (const action of queue) {
    try {
      const res = await fetch(action.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(action.body),
      });

      if (res.ok) {
        await dequeue(action.id);
        onSynced?.(action);
        synced++;
      }
    } catch {
      // Ainda offline ou erro de rede — mantém na fila
    }
  }

  return synced;
}
