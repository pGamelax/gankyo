import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { auth } from "./auth";
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
  .listen(process.env.PORT ?? 3001);

console.log(
  `Gankyo backend running at http://localhost:${app.server?.port}`
);

export type App = typeof app;
