import { Elysia } from "elysia";
import { auth } from "../auth";
import { db } from "../db";
import { user } from "../db/schema";
import { eq } from "drizzle-orm";

export const adminRouter = new Elysia({ prefix: "/admin" })
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
  .get("/users", async () => {
    const users = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        banned: user.banned,
        banReason: user.banReason,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(user.createdAt);
    return users;
  })
  .patch("/users/:id/role", async ({ params, body, set }) => {
    const { role } = body as { role: string };
    if (!["user", "admin"].includes(role)) {
      set.status = 400;
      return { message: "Role inválida. Use 'user' ou 'admin'." };
    }
    const [updated] = await db
      .update(user)
      .set({ role, updatedAt: new Date() })
      .where(eq(user.id, params.id))
      .returning({ id: user.id, role: user.role });
    if (!updated) {
      set.status = 404;
      return { message: "Usuário não encontrado" };
    }
    return updated;
  })
  .patch("/users/:id/ban", async ({ params, body }) => {
    const { banned, banReason } = body as {
      banned: boolean;
      banReason?: string;
    };
    const [updated] = await db
      .update(user)
      .set({ banned, banReason: banReason ?? null, updatedAt: new Date() })
      .where(eq(user.id, params.id))
      .returning({ id: user.id, banned: user.banned });
    return updated;
  });
