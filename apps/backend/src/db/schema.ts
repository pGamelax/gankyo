import {
  pgTable,
  text,
  timestamp,
  date,
  boolean,
  uuid,
  integer,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Better Auth tables ───────────────────────────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  username: text("username").unique(),
  image: text("image"),
  role: text("role").notNull().default("user"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── App tables ───────────────────────────────────────────────────────────────

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  defaultFazendaId: uuid("default_fazenda_id"), // FK set after fazenda is defined
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const fazenda = pgTable("fazenda", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const talhao = pgTable("talhao", {
  id: uuid("id").primaryKey().defaultRandom(),
  fazendaId: uuid("fazenda_id")
    .notNull()
    .references(() => fazenda.id, { onDelete: "cascade" }),
  numero: integer("numero").notNull(),
  codigo: text("codigo").notNull(),
  area: doublePrecision("area").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const activity = pgTable("activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Ordem de serviço — criada ao "Iniciar Atividade" */
export const report = pgTable("report", {
  id: uuid("id").primaryKey().defaultRandom(),
  fazendaId: uuid("fazenda_id")
    .notNull()
    .references(() => fazenda.id),
  talhaoId: uuid("talhao_id")
    .notNull()
    .references(() => talhao.id),
  activityId: uuid("activity_id")
    .notNull()
    .references(() => activity.id),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Insumos definidos ao criar a ordem de serviço */
export const reportInsumo = pgTable("report_insumo", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => report.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  recomendacaoHa: doublePrecision("recomendacao_ha").notNull(),
});

/** Cada lançamento de relatório (progresso) */
export const lancamento = pgTable("lancamento", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => report.id, { onDelete: "cascade" }),
  hectares: doublePrecision("hectares").notNull(),
  /** iniciado | andamento | finalizado | iniciado_finalizado */
  status: text("status").notNull(),
  /** Data real do serviço (pode ser retroativa). YYYY-MM-DD */
  data: date("data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Quantidades reais de insumos por lançamento (sobrescreve o cálculo automático) */
export const lancamentoInsumo = pgTable("lancamento_insumo", {
  id: uuid("id").primaryKey().defaultRandom(),
  lancamentoId: uuid("lancamento_id")
    .notNull()
    .references(() => lancamento.id, { onDelete: "cascade" }),
  reportInsumoId: uuid("report_insumo_id")
    .notNull()
    .references(() => reportInsumo.id, { onDelete: "cascade" }),
  quantidade: doublePrecision("quantidade").notNull(),
});

/**
 * Regras de programação automática.
 * Ex: "1º Pré Emergente" deve ser feito 15 dias após "Plantio Manual" atingir status "iniciado".
 */
export const regraProgramacao = pgTable("regra_programacao", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Atividade que deve ser realizada (alvo) */
  activityId: uuid("activity_id")
    .notNull()
    .references(() => activity.id, { onDelete: "cascade" }),
  /** Atividade que dispara a contagem */
  baseActivityId: uuid("base_activity_id")
    .notNull()
    .references(() => activity.id, { onDelete: "cascade" }),
  /** Status do lancamento que dispara a contagem */
  baseStatus: text("base_status").notNull(),
  /** Dias após o disparo para realizar a atividade alvo */
  diasApos: integer("dias_apos").notNull(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const fazendaRelations = relations(fazenda, ({ many }) => ({
  talhoes: many(talhao),
  reports: many(report),
}));

export const talhaoRelations = relations(talhao, ({ one, many }) => ({
  fazenda: one(fazenda, { fields: [talhao.fazendaId], references: [fazenda.id] }),
  reports: many(report),
}));

export const activityRelations = relations(activity, ({ many }) => ({
  reports: many(report),
}));

export const reportRelations = relations(report, ({ one, many }) => ({
  fazenda: one(fazenda, { fields: [report.fazendaId], references: [fazenda.id] }),
  talhao: one(talhao, { fields: [report.talhaoId], references: [talhao.id] }),
  activity: one(activity, { fields: [report.activityId], references: [activity.id] }),
  user: one(user, { fields: [report.userId], references: [user.id] }),
  insumos: many(reportInsumo),
  lancamentos: many(lancamento),
}));

export const reportInsumoRelations = relations(reportInsumo, ({ one }) => ({
  report: one(report, { fields: [reportInsumo.reportId], references: [report.id] }),
}));

export const lancamentoRelations = relations(lancamento, ({ one, many }) => ({
  report: one(report, { fields: [lancamento.reportId], references: [report.id] }),
  insumos: many(lancamentoInsumo),
}));

export const lancamentoInsumoRelations = relations(lancamentoInsumo, ({ one }) => ({
  lancamento: one(lancamento, { fields: [lancamentoInsumo.lancamentoId], references: [lancamento.id] }),
  reportInsumo: one(reportInsumo, { fields: [lancamentoInsumo.reportInsumoId], references: [reportInsumo.id] }),
}));

export const regraProgramacaoRelations = relations(regraProgramacao, ({ one }) => ({
  activity:     one(activity, { fields: [regraProgramacao.activityId],     references: [activity.id], relationName: "targetActivity" }),
  baseActivity: one(activity, { fields: [regraProgramacao.baseActivityId], references: [activity.id], relationName: "baseActivity"   }),
  createdBy:    one(user,     { fields: [regraProgramacao.createdBy],      references: [user.id]      }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(user, { fields: [userPreferences.userId], references: [user.id] }),
  defaultFazenda: one(fazenda, {
    fields: [userPreferences.defaultFazendaId],
    references: [fazenda.id],
  }),
}));

// ─── Types ────────────────────────────────────────────────────────────────────

export type Fazenda = typeof fazenda.$inferSelect;
export type NewFazenda = typeof fazenda.$inferInsert;
export type Talhao = typeof talhao.$inferSelect;
export type NewTalhao = typeof talhao.$inferInsert;
export type Activity = typeof activity.$inferSelect;
export type NewActivity = typeof activity.$inferInsert;
export type Report = typeof report.$inferSelect;
export type NewReport = typeof report.$inferInsert;
export type ReportInsumo = typeof reportInsumo.$inferSelect;
export type Lancamento = typeof lancamento.$inferSelect;
export type LancamentoInsumo = typeof lancamentoInsumo.$inferSelect;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
