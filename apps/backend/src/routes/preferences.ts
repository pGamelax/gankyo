import { Elysia, t } from "elysia";
import { db } from "../db";
import { userPreferences } from "../db/schema";
import { eq } from "drizzle-orm";
import { auth } from "../auth";

export const preferencesRouter = new Elysia({ prefix: "/me" })
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
  .get("/preferences", async ({ session }) => {
    const prefs = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, session!.user.id),
      with: {
        defaultFazenda: { columns: { id: true, name: true } },
      },
    });
    return prefs ?? { userId: session!.user.id, defaultFazendaId: null, defaultFazenda: null };
  })
  .patch(
    "/preferences",
    async ({ body, session }) => {
      const userId = session!.user.id;
      const existing = await db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, userId),
      });

      if (existing) {
        const [updated] = await db
          .update(userPreferences)
          .set({ defaultFazendaId: body.defaultFazendaId, updatedAt: new Date() })
          .where(eq(userPreferences.userId, userId))
          .returning();
        return updated;
      } else {
        const [created] = await db
          .insert(userPreferences)
          .values({ userId, defaultFazendaId: body.defaultFazendaId })
          .returning();
        return created;
      }
    },
    {
      body: t.Object({
        defaultFazendaId: t.Nullable(t.String()),
      }),
    }
  );
