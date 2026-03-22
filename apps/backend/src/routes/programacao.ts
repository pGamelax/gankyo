import { Elysia, t } from "elysia";
import { db } from "../db";
import { regraProgramacao, report } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "../auth";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const STATUS_OPTIONS = ["iniciado", "andamento", "finalizado", "iniciado_finalizado"] as const;

function authDerive(app: Elysia) {
  return app
    .derive(async ({ request }) => {
      const session = await auth.api.getSession({ headers: request.headers });
      return { session };
    })
    .onBeforeHandle(({ session, set }) => {
      if (!session) { set.status = 401; return { message: "Unauthorized" }; }
    });
}

// ─── CRUD de regras (/regras-programacao) ────────────────────────────────────

export const regrasRouter = new Elysia({ prefix: "/regras-programacao" })
  .use(authDerive)

  .get("/", () =>
    db.query.regraProgramacao.findMany({
      with: {
        activity:     { columns: { id: true, name: true } },
        baseActivity: { columns: { id: true, name: true } },
      },
      orderBy: (r, { asc }) => [asc(r.createdAt)],
    })
  )

  .post(
    "/",
    async ({ body, session }) => {
      const [created] = await db
        .insert(regraProgramacao)
        .values({
          activityId:     body.activityId,
          baseActivityId: body.baseActivityId,
          baseStatus:     body.baseStatus,
          diasApos:       body.diasApos,
          createdBy:      session!.user.id,
        })
        .returning();
      return created;
    },
    {
      body: t.Object({
        activityId:     t.String(),
        baseActivityId: t.String(),
        baseStatus:     t.Union(STATUS_OPTIONS.map(s => t.Literal(s)) as [ReturnType<typeof t.Literal>, ...ReturnType<typeof t.Literal>[]]),
        diasApos:       t.Integer({ minimum: 1 }),
      }),
    }
  )

  .delete(
    "/:id",
    async ({ params, set }) => {
      const [deleted] = await db
        .delete(regraProgramacao)
        .where(eq(regraProgramacao.id, params.id))
        .returning();
      if (!deleted) { set.status = 404; return { message: "Não encontrado" }; }
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) }
  );

// ─── Schedule calculado (/programacao) ───────────────────────────────────────

export const programacaoRouter = new Elysia({ prefix: "/programacao" })
  .use(authDerive)

  /**
   * Para cada regra, busca os relatórios que satisfazem a condição
   * (base activity + base status) e calcula a data sugerida para a atividade alvo.
   * Também verifica se a atividade alvo já foi iniciada no mesmo talhão.
   */
  .get("/", async () => {
    const regras = await db.query.regraProgramacao.findMany({
      with: {
        activity:     { columns: { id: true, name: true } },
        baseActivity: { columns: { id: true, name: true } },
      },
      orderBy: (r, { asc }) => [asc(r.createdAt)],
    });

    if (regras.length === 0) return [];

    const results = await Promise.all(
      regras.map(async (regra) => {
        // Busca relatórios da atividade base com todos os lançamentos
        const baseReports = await db.query.report.findMany({
          where: eq(report.activityId, regra.baseActivityId),
          with: {
            fazenda:    { columns: { id: true, name: true } },
            talhao:     { columns: { id: true, codigo: true } },
            lancamentos: { orderBy: (l, { asc }) => [asc(l.createdAt)] },
          },
        });

        // Filtra: o ÚLTIMO lançamento deve ter o status que dispara a regra
        const disparados = baseReports.filter((r) => {
          if (r.lancamentos.length === 0) return false;
          return r.lancamentos[r.lancamentos.length - 1].status === regra.baseStatus;
        });

        // Calcula a data sugerida e verifica se a atividade alvo já existe no talhão
        const items = await Promise.all(
          disparados.map(async (r) => {
            // Data de disparo = primeiro lançamento que atingiu o status
            const triggerLanc = r.lancamentos.find(
              (l) => l.status === regra.baseStatus
            )!;
            const triggerDate   = triggerLanc.data;
            const scheduledDate = addDays(triggerDate, regra.diasApos);

            // Verifica se a atividade alvo já existe neste talhão
            const existingTarget = await db.query.report.findFirst({
              where: and(
                eq(report.talhaoId,   r.talhaoId),
                eq(report.activityId, regra.activityId)
              ),
            });

            return {
              reportOrigemId:   r.id,
              fazendaId:        r.fazendaId,
              fazendaName:      r.fazenda.name,
              talhaoId:         r.talhaoId,
              talhaoCode:       r.talhao.codigo,
              triggerDate,
              scheduledDate,
              jaConcluida:      !!existingTarget,
              existingReportId: existingTarget?.id ?? null,
            };
          })
        );

        return {
          regra: {
            id:               regra.id,
            activityId:       regra.activityId,
            activityName:     regra.activity.name,
            baseActivityId:   regra.baseActivityId,
            baseActivityName: regra.baseActivity.name,
            baseStatus:       regra.baseStatus,
            diasApos:         regra.diasApos,
          },
          items,
        };
      })
    );

    return results;
  });
