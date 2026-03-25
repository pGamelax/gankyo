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
        username: user.username,
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
  })
  .delete("/users/:id", async ({ params, set }) => {
    const [deleted] = await db
      .delete(user)
      .where(eq(user.id, params.id))
      .returning({ id: user.id });
    if (!deleted) {
      set.status = 404;
      return { message: "Usuário não encontrado" };
    }
    return { id: deleted.id };
  })
  .post("/users", async ({ body, set }) => {
    const { name, username, password, role } = body as {
      name: string;
      username: string;
      password: string;
      role?: string;
    };

    if (!name?.trim() || !username?.trim() || !password) {
      set.status = 400;
      return { message: "Nome, usuário e senha são obrigatórios" };
    }
    if (role && !["user", "admin"].includes(role)) {
      set.status = 400;
      return { message: "Role inválida" };
    }

    const slug = username.trim().toLowerCase();
    const email = `${slug}@gankyo.local`;

    try {
      const result = await auth.api.createUser({
        body: { name: name.trim(), email, password, role: role ?? "user" },
      });

      // better-auth ignora o campo username em createUser — setar manualmente
      await db.update(user)
        .set({ username: slug })
        .where(eq(user.id, result.user.id));

      return { ...result.user, username: slug };
    } catch (e: unknown) {
      set.status = 400;
      return { message: e instanceof Error ? e.message : "Erro ao criar usuário" };
    }
  });
