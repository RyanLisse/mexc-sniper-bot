// ===========================================
// SUPABASE SCHEMA EXPORTS
// ===========================================

// Export Supabase auth schemas with selective exports to avoid conflicts
export {
  users,
  userRoles,
  workflowSystemStatus,
  workflowActivity,
  snipeTargets,
  userPreferences,
  // Exclude coinActivities from supabase-auth as patterns.ts has the comprehensive version
  // Types
  type User,
  type NewUser,
  type UserRole,
  type NewUserRole,
  type WorkflowSystemStatus,
  type NewWorkflowSystemStatus,
  type WorkflowActivity,
  type NewWorkflowActivity,
  type SnipeTarget,
  type NewSnipeTarget,
  type UserPreferences,
  type NewUserPreferences,
  // Exclude CoinActivity and NewCoinActivity types as patterns.ts has the comprehensive version
} from "./supabase-auth";

// Export all Supabase trading schemas
export * from "./supabase-trading";

// Re-export other schemas that are compatible as-is
// Note: workflows excluded to avoid conflicts with supabase-auth
export * from "./patterns";
export * from "./strategies";
export * from "./performance";
export * from "./alerts";
export * from "./safety";

// Schema aggregation for Drizzle ORM
import * as supabaseTrading from "./supabase-trading";
import * as patterns from "./patterns";
import * as strategies from "./strategies";
import * as performance from "./performance";
import * as alerts from "./alerts";
import * as safety from "./safety";
import {
  users,
  userRoles,
  workflowSystemStatus,
  workflowActivity,
  snipeTargets,
  userPreferences,
} from "./supabase-auth";

export const supabaseSchema = {
  // Selective supabase-auth exports (excluding conflicting coinActivities)
  users,
  userRoles,
  workflowSystemStatus,
  workflowActivity,
  snipeTargets,
  userPreferences,
  // All other schemas
  ...supabaseTrading,
  ...patterns,
  ...strategies,
  ...performance,
  ...alerts,
  ...safety,
};

export default supabaseSchema;