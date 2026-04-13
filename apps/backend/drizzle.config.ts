import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Tabelas gerenciadas pelo better-auth — não tocar no push
  tablesFilter: ["!user", "!session", "!account", "!verification"],
});
