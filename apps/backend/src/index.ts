import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { auth } from "./auth";
import { addConnection, removeConnection } from "./events";
import { reportsRouter } from "./routes/reports";
import { preferencesRouter } from "./routes/preferences";
import { dashboardRouter } from "./routes/dashboard";
import { programacaoRouter, regrasRouter } from "./routes/programacao";
import { adminRouter } from "./routes/admin";
import { activitiesRouter, activitiesAdminRouter } from "./routes/activities";
import {
  fazendasRouter,
  fazendasAdminRouter,
  talhoesRouter,
  talhoesAdminRouter,
} from "./routes/fazendas";

const app = new Elysia()
  .use(
    cors({
      origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
      credentials: true,
    })
  )
  .use(
    swagger({
      documentation: {
        info: { title: "Gankyo API", version: "1.0.0" },
      },
    })
  )
  // Better Auth handler — all /api/auth/* routes
  .all("/api/auth/*", ({ request }) => auth.handler(request))
  .use(reportsRouter)
  .use(preferencesRouter)
  .use(dashboardRouter)
  .use(programacaoRouter)
  .use(regrasRouter)
  .use(activitiesRouter)
  .use(fazendasRouter)
  .use(talhoesRouter)
  .use(adminRouter)
  .use(activitiesAdminRouter)
  .use(fazendasAdminRouter)
  .use(talhoesAdminRouter)
  .get("/health", () => ({ status: "ok" }))
  .get("/events", async ({ request, set }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      set.status = 401;
      return { message: "Unauthorized" };
    }

    let send: ((data: string) => void) | null = null;

    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        send = (data: string) => controller.enqueue(enc.encode(data));
        addConnection(send);

        // Ping inicial
        controller.enqueue(enc.encode("data: {\"ping\":true}\n\n"));

        // Heartbeat a cada 25s para manter conexão viva em proxies
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(enc.encode("data: {\"ping\":true}\n\n"));
          } catch {
            clearInterval(heartbeat);
          }
        }, 25_000);

        request.signal.addEventListener("abort", () => {
          clearInterval(heartbeat);
          if (send) removeConnection(send);
        });
      },
      cancel() {
        if (send) removeConnection(send);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  })
  .listen(process.env.PORT ?? 3001);

console.log(
  `Gankyo backend running at http://localhost:${app.server?.port}`
);

export type App = typeof app;
