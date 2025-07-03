import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// ===========================================
// AUTHENTICATION SCHEMA MODULE
// ===========================================

// Kinde Auth Compatible User Table
export const user = pgTable("user", {
  id: text("id").primaryKey(), // Kinde user ID
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  username: text("username").unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  // Store mapping to old better-auth ID for migration compatibility
  legacyBetterAuthId: text("legacyBetterAuthId").unique(),
  createdAt: timestamp("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updatedAt").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Session Management
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updatedAt").notNull().default(sql`CURRENT_TIMESTAMP`),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

// External Account Linking
export const account = pgTable("account", {
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
  createdAt: timestamp("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updatedAt").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Email/Phone Verification
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updatedAt").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// User Preferences Table
export const userPreferences = pgTable(
  "user_preferences",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),

    // Trading Configuration
    defaultBuyAmountUsdt: real("default_buy_amount_usdt")
      .notNull()
      .default(100.0),
    maxConcurrentSnipes: integer("max_concurrent_snipes").notNull().default(3),

    // Take Profit Configuration (user configurable)
    takeProfitLevel1: real("take_profit_level_1").notNull().default(5.0), // 5%
    takeProfitLevel2: real("take_profit_level_2").notNull().default(10.0), // 10%
    takeProfitLevel3: real("take_profit_level_3").notNull().default(15.0), // 15%
    takeProfitLevel4: real("take_profit_level_4").notNull().default(25.0), // 25%
    takeProfitCustom: real("take_profit_custom"), // Custom %
    defaultTakeProfitLevel: integer("default_take_profit_level")
      .notNull()
      .default(2), // Use level 2 (10%) by default

    // Enhanced Take Profit Strategy Configuration
    takeProfitStrategy: text("take_profit_strategy")
      .notNull()
      .default("balanced"), // "conservative", "balanced", "aggressive", "custom"
    takeProfitLevelsConfig: text("take_profit_levels_config"), // JSON string for multi-level configuration

    // Sell Quantity Configuration for each level (percentage of position to sell)
    sellQuantityLevel1: real("sell_quantity_level_1").notNull().default(25.0), // 25% of position
    sellQuantityLevel2: real("sell_quantity_level_2").notNull().default(25.0), // 25% of position
    sellQuantityLevel3: real("sell_quantity_level_3").notNull().default(25.0), // 25% of position
    sellQuantityLevel4: real("sell_quantity_level_4").notNull().default(25.0), // 25% of position
    sellQuantityCustom: real("sell_quantity_custom").default(100.0), // 100% for custom level

    // Risk Management
    stopLossPercent: real("stop_loss_percent").notNull().default(5.0),
    riskTolerance: text("risk_tolerance").notNull().default("medium"), // "low", "medium", "high"

    // Pattern Discovery Settings
    readyStatePattern: text("ready_state_pattern").notNull().default("2,2,4"), // sts:2, st:2, tt:4
    targetAdvanceHours: real("target_advance_hours").notNull().default(3.5),
    autoSnipeEnabled: boolean("auto_snipe_enabled").notNull().default(true), // Auto-snipe by default

    // Exit Strategy Settings
    selectedExitStrategy: text("selected_exit_strategy")
      .notNull()
      .default("balanced"), // "conservative", "balanced", "aggressive", "custom"
    customExitStrategy: text("custom_exit_strategy"), // JSON string of custom strategy levels
    autoBuyEnabled: boolean("auto_buy_enabled").notNull().default(true), // Auto-buy on ready state
    autoSellEnabled: boolean("auto_sell_enabled").notNull().default(true), // Auto-sell at targets

    // Monitoring Intervals
    calendarPollIntervalSeconds: integer("calendar_poll_interval_seconds")
      .notNull()
      .default(300),
    symbolsPollIntervalSeconds: integer("symbols_poll_interval_seconds")
      .notNull()
      .default(30),

    // Timestamps
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
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
