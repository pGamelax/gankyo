import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Só gerencia tabelas da app — better-auth cuida das suas próprias
  tablesFilter: ["fazenda", "talhao", "activity", "report", "report_insumo", "lancamento", "lancamento_insumo", "regra_programacao", "user_preferences"],
});
