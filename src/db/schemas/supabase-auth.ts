import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";

// ===========================================
// SUPABASE AUTH COMPATIBLE SCHEMA MODULE
// ===========================================

// Users table - compatible with Supabase Auth
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  username: text("username"),
  emailVerified: boolean("email_verified").default(false),
  image: text("image"),
  // Store mapping to old Kinde ID for migration compatibility
  legacyKindeId: text("legacy_kinde_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// User roles table
export const userRoles = pgTable("user_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("user"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Workflow system status table
export const workflowSystemStatus = pgTable("workflow_system_status", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  systemStatus: text("system_status").notNull().default("idle"),
  lastUpdate: timestamp("last_update", { withTimezone: true }).defaultNow(),
  activeWorkflows: integer("active_workflows").default(0),
  readyTokens: integer("ready_tokens").default(0),
  totalDetections: integer("total_detections").default(0),
  successfulSnipes: integer("successful_snipes").default(0),
  totalProfit: real("total_profit").default(0),
  successRate: real("success_rate").default(0),
  averageRoi: real("average_roi").default(0),
  bestTrade: real("best_trade").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Workflow activity table
export const workflowActivity = pgTable("workflow_activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  activityId: text("activity_id").notNull(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  workflowId: text("workflow_id"),
  symbolName: text("symbol_name"),
  vcoinId: text("vcoin_id"),
  level: text("level").default("info"),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Coin activities table
export const coinActivities = pgTable("coin_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  vcoinId: text("vcoin_id").notNull(),
  currency: text("currency").notNull(),
  activityId: text("activity_id").notNull(),
  currencyId: text("currency_id"),
  activityType: text("activity_type").notNull(),
  isActive: boolean("is_active").default(true),
  confidenceBoost: real("confidence_boost").default(0),
  priorityScore: real("priority_score").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Snipe targets table
export const snipeTargets = pgTable("snipe_targets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  vcoinId: text("vcoin_id"),
  entryStrategy: text("entry_strategy").notNull().default("market"),
  positionSizeUsdt: real("position_size_usdt").notNull(),
  stopLossPercent: real("stop_loss_percent"),
  takeProfitLevels: jsonb("take_profit_levels"),
  status: text("status").notNull().default("pending"),
  confidenceScore: real("confidence_score"),
  patternType: text("pattern_type"),
  priorityScore: real("priority_score").default(5),
  maxSlippagePercent: real("max_slippage_percent").default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  executionTime: timestamp("execution_time", { withTimezone: true }),
  completionTime: timestamp("completion_time", { withTimezone: true }),
});

// User preferences table - Supabase compatible
export const userPreferences = pgTable("user_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).unique(),
  
  // Trading Configuration
  defaultBuyAmountUsdt: real("default_buy_amount_usdt").notNull().default(100.0),
  maxConcurrentSnipes: integer("max_concurrent_snipes").notNull().default(3),

  // Take Profit Configuration
  takeProfitLevel1: real("take_profit_level_1").notNull().default(5.0),
  takeProfitLevel2: real("take_profit_level_2").notNull().default(10.0),
  takeProfitLevel3: real("take_profit_level_3").notNull().default(15.0),
  takeProfitLevel4: real("take_profit_level_4").notNull().default(25.0),
  takeProfitCustom: real("take_profit_custom"),
  defaultTakeProfitLevel: integer("default_take_profit_level").notNull().default(2),

  // Enhanced Take Profit Strategy Configuration
  takeProfitStrategy: text("take_profit_strategy").notNull().default("balanced"),
  takeProfitLevelsConfig: text("take_profit_levels_config"),

  // Sell Quantity Configuration
  sellQuantityLevel1: real("sell_quantity_level_1").notNull().default(25.0),
  sellQuantityLevel2: real("sell_quantity_level_2").notNull().default(25.0),
  sellQuantityLevel3: real("sell_quantity_level_3").notNull().default(25.0),
  sellQuantityLevel4: real("sell_quantity_level_4").notNull().default(25.0),
  sellQuantityCustom: real("sell_quantity_custom").default(100.0),

  // Risk Management
  stopLossPercent: real("stop_loss_percent").notNull().default(5.0),
  riskTolerance: text("risk_tolerance").notNull().default("medium"),

  // Pattern Discovery Settings
  readyStatePattern: text("ready_state_pattern").notNull().default("2,2,4"),
  targetAdvanceHours: real("target_advance_hours").notNull().default(3.5),
  autoSnipeEnabled: boolean("auto_snipe_enabled").notNull().default(true),

  // Exit Strategy Settings
  selectedExitStrategy: text("selected_exit_strategy").notNull().default("balanced"),
  customExitStrategy: text("custom_exit_strategy"),
  autoBuyEnabled: boolean("auto_buy_enabled").notNull().default(true),
  autoSellEnabled: boolean("auto_sell_enabled").notNull().default(true),

  // Monitoring Intervals
  calendarPollIntervalSeconds: integer("calendar_poll_interval_seconds").notNull().default(300),
  symbolsPollIntervalSeconds: integer("symbols_poll_interval_seconds").notNull().default(30),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Create indexes for performance
export const userIdxUsers = index("idx_users_email").on(users.email);
export const userIdxUserRoles = index("idx_user_roles_user_id").on(userRoles.userId);
export const userIdxWorkflowStatus = index("idx_workflow_system_status_user_id").on(workflowSystemStatus.userId);
export const userIdxWorkflowActivity = index("idx_workflow_activity_user_id").on(workflowActivity.userId);
export const timestampIdxWorkflowActivity = index("idx_workflow_activity_timestamp").on(workflowActivity.timestamp);
export const currencyIdxCoinActivities = index("idx_coin_activities_currency").on(coinActivities.currency);
export const vcoinIdxCoinActivities = index("idx_coin_activities_vcoin_id").on(coinActivities.vcoinId);
export const userIdxSnipeTargets = index("idx_snipe_targets_user_id").on(snipeTargets.userId);
export const statusIdxSnipeTargets = index("idx_snipe_targets_status").on(snipeTargets.status);
export const symbolIdxSnipeTargets = index("idx_snipe_targets_symbol").on(snipeTargets.symbol);
export const userIdxUserPreferences = index("idx_user_preferences_user_id").on(userPreferences.userId);

// Auth Types - Supabase compatible
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;

export type WorkflowSystemStatus = typeof workflowSystemStatus.$inferSelect;
export type NewWorkflowSystemStatus = typeof workflowSystemStatus.$inferInsert;

export type WorkflowActivity = typeof workflowActivity.$inferSelect;
export type NewWorkflowActivity = typeof workflowActivity.$inferInsert;

export type CoinActivity = typeof coinActivities.$inferSelect;
export type NewCoinActivity = typeof coinActivities.$inferInsert;

export type SnipeTarget = typeof snipeTargets.$inferSelect;
export type NewSnipeTarget = typeof snipeTargets.$inferInsert;

export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;