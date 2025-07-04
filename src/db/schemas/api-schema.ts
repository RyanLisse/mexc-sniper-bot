import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/**
 * API and Credentials Schema
 * Contains tables for API credentials and related configurations
 */

export const apiCredentials = pgTable(
  "api_credentials",
  {
    id: serial().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    provider: text().notNull(),
    apiKey: text("api_key").notNull(),
    apiSecret: text("api_secret").notNull(),
    passphrase: text(),
    sandbox: boolean().default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    permissions: text(),
    lastValidated: timestamp("last_validated", { mode: "string" }),
    validationStatus: text("validation_status").default("pending").notNull(),
    errorMessage: text("error_message"),
    expiresAt: timestamp("expires_at", { mode: "string" }),
    rateLimitTier: text("rate_limit_tier"),
    maxRequestsPerMinute: integer("max_requests_per_minute"),
    currentUsage: integer("current_usage").default(0),
    metadata: text(),
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
      name: "api_credentials_userId_user_id_fk",
    }).onDelete("cascade"),
    index("api_credentials_user_provider_idx").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.provider.asc().nullsLast()
    ),
    unique("api_credentials_user_provider_unique").on(
      table.userId,
      table.provider
    ),
  ]
);
