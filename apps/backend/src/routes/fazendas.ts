import { Elysia, t } from "elysia";
import { db } from "../db";
import { fazenda, talhao } from "../db/schema";
import { eq } from "drizzle-orm";
import { auth } from "../auth";
import { generateCodigoTalhao } from "../lib/codigo";

function authDerive(app: Elysia) {
  return app.derive(async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    return { session };
  });
}

// GET /fazendas — qualquer usuário autenticado
export const fazendasRouter = new Elysia({ prefix: "/fazendas" })
  .use(authDerive)
  .onBeforeHandle(({ session, set }) => {
    if (!session) {
      set.status = 401;
      return { message: "Unauthorized" };
    }
  })
  .get("/", () =>
    db.query.fazenda.findMany({ orderBy: (f, { asc }) => [asc(f.name)] })
  )
  .get("/:id/talhoes", ({ params }) =>
    db.query.talhao.findMany({
      where: eq(talhao.fazendaId, params.id),
      orderBy: (t, { asc }) => [asc(t.numero)],
    })
  );

// Admin CRUD
export const fazendasAdminRouter = new Elysia({ prefix: "/fazendas" })
  .use(authDerive)
  .onBeforeHandle(({ session, set }) => {
    if (!session) {
      set.status = 401;
      return { message: "Unauthorized" };
    }
    if (session.user.role !== "admin") {
      set.status = 403;
      return { message: "Forbidden: admin only" };
    }
  })
  .post(
    "/",
    async ({ body, session }) => {
      const [created] = await db
        .insert(fazenda)
        .values({ name: body.name, createdBy: session!.user.id })
        .returning();
      return created;
    },
    { body: t.Object({ name: t.String({ minLength: 1 }) }) }
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const [updated] = await db
        .update(fazenda)
        .set({ name: body.name, updatedAt: new Date() })
        .where(eq(fazenda.id, params.id))
        .returning();
      if (!updated) {
        set.status = 404;
        return { message: "Fazenda não encontrada" };
      }
      return updated;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ name: t.String({ minLength: 1 }) }),
    }
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const [deleted] = await db
        .delete(fazenda)
        .where(eq(fazenda.id, params.id))
        .returning();
      if (!deleted) {
        set.status = 404;
        return { message: "Fazenda não encontrada" };
      }
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) }
  );

// GET /talhoes — qualquer autenticado; admin CRUD
export const talhoesRouter = new Elysia({ prefix: "/talhoes" })
  .use(authDerive)
  .onBeforeHandle(({ session, set }) => {
    if (!session) {
      set.status = 401;
      return { message: "Unauthorized" };
    }
  })
  .get("/", () =>
    db.query.talhao.findMany({
      with: { fazenda: { columns: { id: true, name: true } } },
      orderBy: (t, { asc }) => [asc(t.codigo)],
    })
  );

export const talhoesAdminRouter = new Elysia({ prefix: "/talhoes" })
  .use(authDerive)
  .onBeforeHandle(({ session, set }) => {
    if (!session) {
      set.status = 401;
      return { message: "Unauthorized" };
    }
    if (session.user.role !== "admin") {
      set.status = 403;
      return { message: "Forbidden: admin only" };
    }
  })
  .post(
    "/",
    async ({ body, set }) => {
      const farm = await db.query.fazenda.findFirst({
        where: eq(fazenda.id, body.fazendaId),
      });
      if (!farm) {
        set.status = 404;
        return { message: "Fazenda não encontrada" };
      }
      const codigo = generateCodigoTalhao(farm.name, body.numero);
      const [created] = await db
        .insert(talhao)
        .values({ fazendaId: body.fazendaId, numero: body.numero, codigo, area: body.area })
        .returning();
      return { ...created, fazenda: { id: farm.id, name: farm.name } };
    },
    {
      body: t.Object({
        fazendaId: t.String(),
        numero: t.Integer({ minimum: 1 }),
        area: t.Number({ minimum: 0 }),
      }),
    }
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const existing = await db.query.talhao.findFirst({
        where: eq(talhao.id, params.id),
        with: { fazenda: true },
      });
      if (!existing) {
        set.status = 404;
        return { message: "Talhão não encontrado" };
      }

      let farmName = existing.fazenda.name;
      if (body.fazendaId) {
        const newFarm = await db.query.fazenda.findFirst({
          where: eq(fazenda.id, body.fazendaId),
        });
        if (newFarm) farmName = newFarm.name;
      }

      const numero = body.numero ?? existing.numero;
      const codigo = generateCodigoTalhao(farmName, numero);

      const [updated] = await db
        .update(talhao)
        .set({
          ...(body.fazendaId ? { fazendaId: body.fazendaId } : {}),
          ...(body.numero !== undefined ? { numero: body.numero } : {}),
          ...(body.area !== undefined ? { area: body.area } : {}),
          codigo,
          updatedAt: new Date(),
        })
        .where(eq(talhao.id, params.id))
        .returning();
      return updated;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        fazendaId: t.Optional(t.String()),
        numero: t.Optional(t.Integer({ minimum: 1 })),
        area: t.Optional(t.Number({ minimum: 0 })),
      }),
    }
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const [deleted] = await db
        .delete(talhao)
        .where(eq(talhao.id, params.id))
        .returning();
      if (!deleted) {
        set.status = 404;
        return { message: "Talhão não encontrado" };
      }
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) }
  );
