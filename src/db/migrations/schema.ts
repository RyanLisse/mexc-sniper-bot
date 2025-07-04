/**
 * Database Schema - Modular Architecture
 *
 * This file maintains backward compatibility by re-exporting all tables
 * from the new modular schema structure.
 *
 * The original monolithic schema.ts has been refactored into multiple
 * focused modules organized by functional domain:
 *
 * - auth-schema.ts: User authentication and management
 * - alerts-schema.ts: Alert management and notifications
 * - trading-schema.ts: Trading operations and transactions
 * - strategy-schema.ts: Strategy templates and performance
 * - monitoring-schema.ts: System health and performance monitoring
 * - workflow-schema.ts: Workflow activities and orchestration
 * - ml-schema.ts: Machine learning and pattern detection
 * - risk-schema.ts: Risk management and error handling
 * - api-schema.ts: API credentials and configurations
 *
 * Each module is under 500 LOC for better maintainability.
 *
 * @see src/db/schemas/ for individual schema modules
 */

// Re-export all tables from modular schemas
export * from "../schemas";

// For migration compatibility, ensure all tables are available
export { allTables } from "../schemas";
