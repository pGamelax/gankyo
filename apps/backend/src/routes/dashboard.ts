import { Elysia } from "elysia";
import { db } from "../db";
import { auth } from "../auth";

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

    const porFazenda = fazendas.map((f) => {
      const ordensF = reports.filter((r) => r.fazendaId === f.id);
      const haTotal = f.talhoes.reduce((s, t) => s + t.area, 0);
      const haRealizado = ordensF
        .flatMap((r) => r.lancamentos)
        .reduce((s, l) => s + l.hectares, 0);

      const statusCount = { iniciado: 0, andamento: 0, finalizado: 0, iniciado_finalizado: 0 };
      for (const r of ordensF) {
        const last = r.lancamentos.at(-1);
        if (last) statusCount[last.status as keyof typeof statusCount]++;
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

    const totais = {
      fazendas: fazendas.length,
      talhoes: fazendas.reduce((s, f) => s + f.talhoes.length, 0),
      ordens: reports.length,
      haTotal: fazendas.reduce(
        (s, f) => s + f.talhoes.reduce((ts, t) => ts + t.area, 0),
        0
      ),
      haRealizado: reports
        .flatMap((r) => r.lancamentos)
        .reduce((s, l) => s + l.hectares, 0),
    };

    const recentes = reports.slice(0, 15).map((r) => ({
      id: r.id,
      fazenda: r.fazenda.name,
      talhao: r.talhao.codigo,
      atividade: r.activity.name,
      ultimoStatus: r.lancamentos.at(-1)?.status ?? null,
      haRealizado: r.lancamentos.reduce((s, l) => s + l.hectares, 0),
      haTalhao: r.talhao.area,
      createdAt: r.createdAt,
    }));

    return { totais, fazendas: porFazenda, recentes };
  });
