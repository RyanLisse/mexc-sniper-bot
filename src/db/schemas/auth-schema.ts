import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/**
 * Authentication and User Management Schema
 * Contains tables for user accounts, sessions, verification, and preferences
 */

export const user = pgTable(
  "user",
  {
    id: text().primaryKey().notNull(),
    email: text().notNull(),
    name: text().notNull(),
    username: text(),
    emailVerified: boolean().default(false).notNull(),
    image: text(),
    legacyBetterAuthId: text(),
    createdAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    unique("user_email_unique").on(table.email),
    unique("user_username_unique").on(table.username),
    unique("user_legacyBetterAuthId_unique").on(table.legacyBetterAuthId),
  ]
);

export const account = pgTable(
  "account",
  {
    id: text().primaryKey().notNull(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text().notNull(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: integer(),
    refreshTokenExpiresAt: integer(),
    scope: text(),
    password: text(),
    createdAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "account_userId_user_id_fk",
    }).onDelete("cascade"),
  ]
);

export const session = pgTable(
  "session",
  {
    id: text().primaryKey().notNull(),
    expiresAt: integer().notNull(),
    token: text().notNull(),
    createdAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    ipAddress: text(),
    userAgent: text(),
    userId: text().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "session_userId_user_id_fk",
    }).onDelete("cascade"),
    unique("session_token_unique").on(table.token),
  ]
);

export const verification = pgTable("verification", {
  id: text().primaryKey().notNull(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: integer().notNull(),
  createdAt: timestamp({ mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp({ mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const userPreferences = pgTable(
  "user_preferences",
  {
    id: serial().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    defaultBuyAmountUsdt: real("default_buy_amount_usdt")
      .default(100)
      .notNull(),
    maxConcurrentSnipes: integer("max_concurrent_snipes").default(3).notNull(),
    takeProfitLevel1: real("take_profit_level_1").default(5).notNull(),
    takeProfitLevel2: real("take_profit_level_2").default(10).notNull(),
    takeProfitLevel3: real("take_profit_level_3").default(15).notNull(),
    takeProfitLevel4: real("take_profit_level_4").default(25).notNull(),
    takeProfitCustom: real("take_profit_custom"),
    defaultTakeProfitLevel: integer("default_take_profit_level")
      .default(2)
      .notNull(),
    stopLossPercent: real("stop_loss_percent").default(5).notNull(),
    riskTolerance: text("risk_tolerance").default("medium").notNull(),
    readyStatePattern: text("ready_state_pattern").default("2,2,4").notNull(),
    targetAdvanceHours: real("target_advance_hours").default(3.5).notNull(),
    autoSnipeEnabled: boolean("auto_snipe_enabled").default(true).notNull(),
    selectedExitStrategy: text("selected_exit_strategy")
      .default("balanced")
      .notNull(),
    customExitStrategy: text("custom_exit_strategy"),
    notificationsEnabled: boolean("notifications_enabled")
      .default(true)
      .notNull(),
    emailNotifications: boolean("email_notifications").default(true).notNull(),
    webhookUrl: text("webhook_url"),
    slackWebhookUrl: text("slack_webhook_url"),
    discordWebhookUrl: text("discord_webhook_url"),
    telegramChatId: text("telegram_chat_id"),
    riskLimits: text("risk_limits").default("{}"),
    advancedSettings: text("advanced_settings").default("{}"),
    createdAt: timestamp("created_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "userPreferences_userId_user_id_fk",
    }).onDelete("cascade"),
    unique("user_preferences_user_id_unique").on(table.userId),
  ]
);
