type SendFn = (data: string) => void;

const connections = new Set<SendFn>();

export function addConnection(send: SendFn) {
  connections.add(send);
}

export function removeConnection(send: SendFn) {
  connections.delete(send);
}

/** Emite um evento para todos os clientes conectados.
 *  keys: lista de query keys a invalidar, ex: ["reports", "reports/abc123"]
 */
export function broadcast(keys: string[]) {
  if (connections.size === 0) return;
  const payload = `data: ${JSON.stringify({ keys })}\n\n`;
  for (const send of connections) {
    try {
      send(payload);
    } catch {
      connections.delete(send);
    }
  }
}
