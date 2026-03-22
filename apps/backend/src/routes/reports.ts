import { Elysia, t } from "elysia";
import { db } from "../db";
import { report, reportInsumo, lancamento, talhao } from "../db/schema";
import { eq, sum } from "drizzle-orm";
import { auth } from "../auth";

export const reportsRouter = new Elysia({ prefix: "/reports" })
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
  // Listar ordens do usuário
  .get("/", async ({ session }) => {
    return db.query.report.findMany({
      where: eq(report.userId, session!.user.id),
      with: {
        fazenda: { columns: { id: true, name: true } },
        talhao: { columns: { id: true, codigo: true, area: true } },
        activity: { columns: { id: true, name: true } },
        insumos: { columns: { id: true, nome: true, recomendacaoHa: true } },
        lancamentos: { columns: { id: true, hectares: true, status: true } },
      },
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });
  })
  // Detalhe de uma ordem
  .get("/:id", async ({ params, session, set }) => {
    const r = await db.query.report.findFirst({
      where: eq(report.id, params.id),
      with: {
        fazenda: true,
        talhao: true,
        activity: true,
        insumos: true,
        lancamentos: { orderBy: (l, { asc }) => [asc(l.createdAt)] },
      },
    });
    if (!r) { set.status = 404; return { message: "Relatório não encontrado" }; }
    if (r.userId !== session!.user.id) { set.status = 403; return { message: "Forbidden" }; }
    return r;
  }, { params: t.Object({ id: t.String() }) })
  // Criar ordem de serviço (Iniciar Atividade)
  .post(
    "/",
    async ({ body, session }) => {
      const [created] = await db
        .insert(report)
        .values({
          fazendaId: body.fazendaId,
          talhaoId: body.talhaoId,
          activityId: body.activityId,
          userId: session!.user.id,
        })
        .returning();

      if (body.insumos.length > 0) {
        await db.insert(reportInsumo).values(
          body.insumos.map((ins) => ({
            reportId: created.id,
            nome: ins.nome,
            recomendacaoHa: ins.recomendacaoHa,
          }))
        );
      }
      return created;
    },
    {
      body: t.Object({
        fazendaId: t.String(),
        talhaoId: t.String(),
        activityId: t.String(),
        insumos: t.Array(
          t.Object({
            nome: t.String({ minLength: 1 }),
            recomendacaoHa: t.Number({ minimum: 0 }),
          })
        ),
      }),
    }
  )
  // Lançar relatório (progresso)
  .post(
    "/:id/lancamentos",
    async ({ params, body, session, set }) => {
      const r = await db.query.report.findFirst({
        where: eq(report.id, params.id),
        with: { talhao: true, lancamentos: true },
      });
      if (!r) { set.status = 404; return { message: "Relatório não encontrado" }; }
      if (r.userId !== session!.user.id) { set.status = 403; return { message: "Forbidden" }; }

      const today = new Date().toISOString().slice(0, 10);
      const [created] = await db
        .insert(lancamento)
        .values({ reportId: params.id, hectares: body.hectares, status: body.status, data: body.data ?? today })
        .returning();
      return created;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        hectares: t.Number({ minimum: 0 }),
        status: t.Union([
          t.Literal("iniciado"),
          t.Literal("andamento"),
          t.Literal("finalizado"),
          t.Literal("iniciado_finalizado"),
        ]),
        data: t.Optional(t.String()),
      }),
    }
  )
  // Remover ordem
  .delete(
    "/:id",
    async ({ params, session, set }) => {
      const r = await db.query.report.findFirst({ where: eq(report.id, params.id) });
      if (!r) { set.status = 404; return { message: "Não encontrado" }; }
      if (r.userId !== session!.user.id) { set.status = 403; return { message: "Forbidden" }; }
      await db.delete(report).where(eq(report.id, params.id));
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) }
  );
