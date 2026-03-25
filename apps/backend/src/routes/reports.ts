import { Elysia, t } from "elysia";
import { db } from "../db";
import { report, reportInsumo, lancamento, talhao } from "../db/schema";
import { eq } from "drizzle-orm";
import { auth } from "../auth";
import { broadcast } from "../events";

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
  .get("/", async () => {
    return db.query.report.findMany({
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
        lancamentos: { orderBy: (l, { asc }) => [asc(l.data), asc(l.createdAt)] },
      },
    });
    if (!r) { set.status = 404; return { message: "Relatório não encontrado" }; }
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
      broadcast(["reports", "dashboard"]);
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

      // Regra 1: atividade finalizada não aceita novos lançamentos
      const isClosed = r.lancamentos.some(
        l => l.status === "finalizado" || l.status === "iniciado_finalizado"
      );
      if (isClosed) {
        set.status = 422;
        return { message: "Atividade já finalizada. Não é possível adicionar novos lançamentos." };
      }

      // Regra 2: só pode haver um lançamento com status "iniciado"
      if (body.status === "iniciado" && r.lancamentos.some(l => l.status === "iniciado")) {
        set.status = 422;
        return { message: "Já existe um lançamento com status 'Iniciado'." };
      }

      const today = new Date().toISOString().slice(0, 10);
      const [created] = await db
        .insert(lancamento)
        .values({ reportId: params.id, hectares: body.hectares, status: body.status, data: body.data ?? today })
        .returning();
      broadcast(["reports", `reports/${params.id}`, "dashboard"]);
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
  // Editar lançamento
  .patch(
    "/:id/lancamentos/:lancId",
    async ({ params, body, session, set }) => {
      const lanc = await db.query.lancamento.findFirst({ where: eq(lancamento.id, params.lancId) });
      if (!lanc) { set.status = 404; return { message: "Lançamento não encontrado" }; }
      const r = await db.query.report.findFirst({ where: eq(report.id, lanc.reportId) });
      if (!r) { set.status = 404; return { message: "Relatório não encontrado" }; }
      const isOwner = r.userId === session!.user.id;
      const isAdmin = session!.user.role === "admin";
      if (!isOwner && !isAdmin) { set.status = 403; return { message: "Forbidden" }; }
      const [updated] = await db
        .update(lancamento)
        .set({
          ...(body.hectares !== undefined ? { hectares: body.hectares } : {}),
          ...(body.status   !== undefined ? { status:   body.status   } : {}),
          ...(body.data     !== undefined ? { data:     body.data     } : {}),
        })
        .where(eq(lancamento.id, params.lancId))
        .returning();
      broadcast(["reports", `reports/${params.id}`, "dashboard"]);
      return updated;
    },
    {
      params: t.Object({ id: t.String(), lancId: t.String() }),
      body: t.Object({
        hectares: t.Optional(t.Number({ minimum: 0 })),
        status:   t.Optional(t.Union([
          t.Literal("iniciado"), t.Literal("andamento"),
          t.Literal("finalizado"), t.Literal("iniciado_finalizado"),
        ])),
        data: t.Optional(t.String()),
      }),
    }
  )
  // Deletar lançamento
  .delete(
    "/:id/lancamentos/:lancId",
    async ({ params, session, set }) => {
      const lanc = await db.query.lancamento.findFirst({ where: eq(lancamento.id, params.lancId) });
      if (!lanc) { set.status = 404; return { message: "Lançamento não encontrado" }; }
      const r = await db.query.report.findFirst({ where: eq(report.id, lanc.reportId) });
      if (!r) { set.status = 404; return { message: "Relatório não encontrado" }; }
      const isOwner = r.userId === session!.user.id;
      const isAdmin = session!.user.role === "admin";
      if (!isOwner && !isAdmin) { set.status = 403; return { message: "Forbidden" }; }
      await db.delete(lancamento).where(eq(lancamento.id, params.lancId));
      broadcast(["reports", `reports/${params.id}`, "dashboard"]);
      return { success: true };
    },
    { params: t.Object({ id: t.String(), lancId: t.String() }) }
  )
  // Remover ordem
  .delete(
    "/:id",
    async ({ params, session, set }) => {
      const r = await db.query.report.findFirst({ where: eq(report.id, params.id) });
      if (!r) { set.status = 404; return { message: "Não encontrado" }; }
      const isOwner = r.userId === session!.user.id;
      const isAdmin = session!.user.role === "admin";
      if (!isOwner && !isAdmin) { set.status = 403; return { message: "Forbidden" }; }
      await db.delete(report).where(eq(report.id, params.id));
      broadcast(["reports", "dashboard"]);
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) }
  );
