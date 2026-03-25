import { Elysia } from "elysia";
import { db } from "../db";
import { auth } from "../auth";

type StatusKey = "iniciado" | "andamento" | "finalizado" | "iniciado_finalizado";

export const dashboardRouter = new Elysia({ prefix: "/dashboard" })
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    return { session };
  })
  .onBeforeHandle(({ session, set }) => {
    if (!session) {
      set.status = 401;
      return { message: "Unauthorized" };
    }
  })
  .get("/", async () => {
    const [fazendas, reports] = await Promise.all([
      db.query.fazenda.findMany({
        with: { talhoes: { columns: { id: true, area: true } } },
        orderBy: (f, { asc }) => [asc(f.name)],
      }),
      db.query.report.findMany({
        with: {
          fazenda: { columns: { id: true, name: true } },
          talhao: { columns: { id: true, codigo: true, area: true } },
          activity: { columns: { id: true, name: true } },
          lancamentos: {
            columns: { id: true, hectares: true, status: true, createdAt: true },
            orderBy: (l, { asc }) => [asc(l.createdAt)],
          },
        },
        orderBy: (r, { desc }) => [desc(r.createdAt)],
      }),
    ]);

    // ── Por fazenda ──────────────────────────────────────────────
    const porFazenda = fazendas.map((f) => {
      const ordensF = reports.filter((r) => r.fazendaId === f.id);
      const haTotal = f.talhoes.reduce((s, t) => s + t.area, 0);
      const haRealizado = ordensF
        .flatMap((r) => r.lancamentos)
        .reduce((s, l) => s + l.hectares, 0);

      const statusCount: Record<StatusKey, number> = {
        iniciado: 0, andamento: 0, finalizado: 0, iniciado_finalizado: 0,
      };
      for (const r of ordensF) {
        const last = r.lancamentos.at(-1);
        if (last) statusCount[last.status as StatusKey]++;
      }

      return {
        id: f.id,
        name: f.name,
        talhoes: f.talhoes.length,
        ordens: ordensF.length,
        haTotal,
        haRealizado,
        pct: haTotal > 0 ? Math.min(100, (haRealizado / haTotal) * 100) : 0,
        statusCount,
      };
    });

    // ── Por atividade ────────────────────────────────────────────
    const atividadeMap = new Map<string, {
      id: string;
      nome: string;
      ordens: number;
      haRealizado: number;
      statusCount: Record<StatusKey, number>;
    }>();

    for (const r of reports) {
      const key = r.activity.id;
      if (!atividadeMap.has(key)) {
        atividadeMap.set(key, {
          id: r.activity.id,
          nome: r.activity.name,
          ordens: 0,
          haRealizado: 0,
          statusCount: { iniciado: 0, andamento: 0, finalizado: 0, iniciado_finalizado: 0 },
        });
      }
      const entry = atividadeMap.get(key)!;
      entry.ordens++;
      entry.haRealizado += r.lancamentos.reduce((s, l) => s + l.hectares, 0);
      const last = r.lancamentos.at(-1);
      if (last) entry.statusCount[last.status as StatusKey]++;
    }

    const porAtividade = [...atividadeMap.values()].sort((a, b) => b.ordens - a.ordens);

    // ── Totais ───────────────────────────────────────────────────
    const ordensSemLancamento = reports.filter((r) => r.lancamentos.length === 0).length;

    const totais = {
      fazendas: fazendas.length,
      talhoes: fazendas.reduce((s, f) => s + f.talhoes.length, 0),
      ordens: reports.length,
      ordensSemLancamento,
      haTotal: fazendas.reduce(
        (s, f) => s + f.talhoes.reduce((ts, t) => ts + t.area, 0),
        0
      ),
      haRealizado: reports
        .flatMap((r) => r.lancamentos)
        .reduce((s, l) => s + l.hectares, 0),
    };

    // ── Recentes ─────────────────────────────────────────────────
    const recentes = reports.slice(0, 15).map((r) => ({
      id: r.id,
      fazenda: r.fazenda.name,
      talhao: r.talhao.codigo,
      atividade: r.activity.name,
      ultimoStatus: (r.lancamentos.at(-1)?.status ?? null) as StatusKey | null,
      haRealizado: r.lancamentos.reduce((s, l) => s + l.hectares, 0),
      haTalhao: r.talhao.area,
      createdAt: r.createdAt,
    }));

    return { totais, fazendas: porFazenda, porAtividade, recentes };
  });
