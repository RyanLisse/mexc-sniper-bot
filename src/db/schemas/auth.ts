import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ===========================================
// AUTHENTICATION SCHEMA MODULE
// ===========================================

// Kinde Auth Compatible User Table
export const user = sqliteTable("user", {
  id: text("id").primaryKey(), // Kinde user ID
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  username: text("username").unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  // Store mapping to old better-auth ID for migration compatibility
  legacyBetterAuthId: text("legacyBetterAuthId").unique(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Session Management
export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

// External Account Linking
export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt"),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// Email/Phone Verification
export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

// User Preferences Table
export const userPreferences = sqliteTable(
  "user_preferences",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),

    // Trading Configuration
    defaultBuyAmountUsdt: real("default_buy_amount_usdt").notNull().default(100.0),
    maxConcurrentSnipes: integer("max_concurrent_snipes").notNull().default(3),

    // Take Profit Configuration (user configurable)
    takeProfitLevel1: real("take_profit_level_1").notNull().default(5.0), // 5%
    takeProfitLevel2: real("take_profit_level_2").notNull().default(10.0), // 10%
    takeProfitLevel3: real("take_profit_level_3").notNull().default(15.0), // 15%
    takeProfitLevel4: real("take_profit_level_4").notNull().default(25.0), // 25%
    takeProfitCustom: real("take_profit_custom"), // Custom %
    defaultTakeProfitLevel: integer("default_take_profit_level").notNull().default(2), // Use level 2 (10%) by default

    // Risk Management
    stopLossPercent: real("stop_loss_percent").notNull().default(5.0),
    riskTolerance: text("risk_tolerance").notNull().default("medium"), // "low", "medium", "high"

    // Pattern Discovery Settings
    readyStatePattern: text("ready_state_pattern").notNull().default("2,2,4"), // sts:2, st:2, tt:4
    targetAdvanceHours: real("target_advance_hours").notNull().default(3.5),
    autoSnipeEnabled: integer("auto_snipe_enabled", { mode: "boolean" }).notNull().default(true), // Auto-snipe by default

    // Exit Strategy Settings
    selectedExitStrategy: text("selected_exit_strategy").notNull().default("balanced"), // "conservative", "balanced", "aggressive", "custom"
    customExitStrategy: text("custom_exit_strategy"), // JSON string of custom strategy levels
    autoBuyEnabled: integer("auto_buy_enabled", { mode: "boolean" }).notNull().default(true), // Auto-buy on ready state
    autoSellEnabled: integer("auto_sell_enabled", { mode: "boolean" }).notNull().default(true), // Auto-sell at targets

    // Monitoring Intervals
    calendarPollIntervalSeconds: integer("calendar_poll_interval_seconds").notNull().default(300),
    symbolsPollIntervalSeconds: integer("symbols_poll_interval_seconds").notNull().default(30),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("user_preferences_user_id_idx").on(table.userId),
  })
);

// Auth Types
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;

export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;

export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;

export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;