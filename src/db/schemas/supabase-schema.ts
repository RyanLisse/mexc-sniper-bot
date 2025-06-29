// ===========================================
// SUPABASE SCHEMA EXPORTS
// ===========================================

// Export all Supabase-compatible schemas
export * from "./supabase-auth";
export * from "./supabase-trading";

// Re-export other schemas that are compatible as-is
export * from "./workflows";
export * from "./patterns";
export * from "./strategies";
export * from "./performance";
export * from "./alerts";
export * from "./safety";

// Schema aggregation for Drizzle ORM
import * as supabaseAuth from "./supabase-auth";
import * as supabaseTrading from "./supabase-trading";
import * as workflows from "./workflows";
import * as patterns from "./patterns";
import * as strategies from "./strategies";
import * as performance from "./performance";
import * as alerts from "./alerts";
import * as safety from "./safety";

export const supabaseSchema = {
  ...supabaseAuth,
  ...supabaseTrading,
  ...workflows,
  ...patterns,
  ...strategies,
  ...performance,
  ...alerts,
  ...safety,
};

export default supabaseSchema;