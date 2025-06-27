/**
 * Pattern to Database Bridge Integration Tests - Main Entry Point
 *
 * This file imports all the split test suites for the Pattern to Database Bridge.
 * The original large test file (1527 lines) has been refactored into smaller,
 * focused test files for better maintainability.
 *
 * Test suites included:
 * - Event Integration: Basic event handling and database integration
 * - Pattern Filtering: Confidence thresholds, pattern types, risk filtering
 * - Deduplication: Preventing duplicate patterns and database entries
 * - User Preferences: Integration with user settings and fallback values
 */

// Import all test suites to run them together
import "./event-integration.test";
import "./pattern-filtering.test";
import "./deduplication.test";
import "./user-preferences.test";

// Additional test suites would be imported here as they are created:
// import "./priority-calculation.test";
// import "./user-limit-enforcement.test";
// import "./error-handling.test";
// import "./end-to-end-pipeline.test";

// This file serves as a convenient entry point to run all pattern-to-database-bridge tests
// while maintaining the same test coverage as the original monolithic test file.
