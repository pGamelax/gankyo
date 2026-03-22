import { Elysia, t } from "elysia";
import { db } from "../db";
import { activity } from "../db/schema";
import { eq } from "drizzle-orm";
import { auth } from "../auth";

// Listagem pública — qualquer usuário autenticado pode ver as atividades
export const activitiesRouter = new Elysia({ prefix: "/activities" })
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
    return db.query.activity.findMany({
      orderBy: (a, { asc }) => [asc(a.name)],
    });
  });

// Rotas de gestão — somente admin
export const activitiesAdminRouter = new Elysia({ prefix: "/activities" })
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    return { session };
  })
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
        .insert(activity)
        .values({ ...body, createdBy: session!.user.id })
        .returning();
      return created;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        description: t.Optional(t.String()),
      }),
    }
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const [updated] = await db
        .update(activity)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(activity.id, params.id))
        .returning();
      if (!updated) {
        set.status = 404;
        return { message: "Atividade não encontrada" };
      }
      return updated;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        description: t.Optional(t.String()),
      }),
    }
  )
  .delete(
    "/:id",
    async ({ params, set }) => {
      const [deleted] = await db
        .delete(activity)
        .where(eq(activity.id, params.id))
        .returning();
      if (!deleted) {
        set.status = 404;
        return { message: "Atividade não encontrada" };
      }
      return { success: true };
    },
    { params: t.Object({ id: t.String() }) }
  );
