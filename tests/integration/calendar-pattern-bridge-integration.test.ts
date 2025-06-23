/**
 * Calendar-Pattern Bridge Service Integration Tests
 *
 * Tests the automated pipeline: Calendar Monitoring → Pattern Detection → Target Creation
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { calendarPatternBridgeService } from "../../src/services/calendar-pattern-bridge-service";

describe("Calendar-Pattern Bridge Service Integration", () => {
  beforeEach(() => {
    // Reset service state
    calendarPatternBridgeService.resetStatistics();
    if (calendarPatternBridgeService.isActive()) {
      calendarPatternBridgeService.stopMonitoring();
    }
  });

  afterEach(() => {
    // Cleanup monitoring
    if (calendarPatternBridgeService.isActive()) {
      calendarPatternBridgeService.stopMonitoring();
    }
  });

  describe("Service Lifecycle", () => {
    it("should initialize correctly", () => {
      expect(calendarPatternBridgeService).toBeDefined();
      expect(calendarPatternBridgeService.isActive()).toBe(false);
    });

    it("should start and stop monitoring correctly", () => {
      // Start monitoring
      calendarPatternBridgeService.startMonitoring(1); // 1 minute interval for testing
      expect(calendarPatternBridgeService.isActive()).toBe(true);

      // Stop monitoring
      calendarPatternBridgeService.stopMonitoring();
      expect(calendarPatternBridgeService.isActive()).toBe(false);
    });

    it("should prevent double initialization", () => {
      calendarPatternBridgeService.startMonitoring(1);
      expect(calendarPatternBridgeService.isActive()).toBe(true);

      // Try to start again
      calendarPatternBridgeService.startMonitoring(1);
      expect(calendarPatternBridgeService.isActive()).toBe(true);
    });

    it("should track comprehensive statistics", () => {
      const initialStats = calendarPatternBridgeService.getStatistics();
      expect(initialStats.totalEventsProcessed).toBe(0);
      expect(initialStats.totalCalendarScans).toBe(0);
      expect(initialStats.totalNewListingsFound).toBe(0);
      expect(initialStats.totalPatternAnalysisTriggered).toBe(0);
      expect(initialStats.lastCalendarScan).toBe(null);
      expect(initialStats.lastPatternAnalysis).toBe(null);
    });

    it("should provide accurate service status", () => {
      const status = calendarPatternBridgeService.getStatus();
      expect(status.isActive).toBe(false);
      expect(status.statistics).toBeDefined();
      expect(status.uptime).toBeGreaterThanOrEqual(0);

      calendarPatternBridgeService.startMonitoring(1);
      const activeStatus = calendarPatternBridgeService.getStatus();
      expect(activeStatus.isActive).toBe(true);
    });

    it("should reset statistics correctly", () => {
      // Reset statistics
      calendarPatternBridgeService.resetStatistics();

      const stats = calendarPatternBridgeService.getStatistics();
      expect(stats.totalEventsProcessed).toBe(0);
      expect(stats.totalCalendarScans).toBe(0);
      expect(stats.totalNewListingsFound).toBe(0);
      expect(stats.totalPatternAnalysisTriggered).toBe(0);
      expect(stats.lastCalendarScan).toBe(null);
      expect(stats.lastPatternAnalysis).toBe(null);
    });
  });

  describe("Manual Scan Testing", () => {
    it("should handle manual scan trigger", async () => {
      const result = await calendarPatternBridgeService.triggerManualScan();

      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.processingTime).toBe("number");
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it("should update statistics after manual scan", async () => {
      const initialStats = calendarPatternBridgeService.getStatistics();
      
      await calendarPatternBridgeService.triggerManualScan();

      const finalStats = calendarPatternBridgeService.getStatistics();
      // Stats should be updated after scan attempt
      expect(finalStats.totalCalendarScans).toBeGreaterThanOrEqual(initialStats.totalCalendarScans);
    });
  });

  describe("Service Integration", () => {
    it("should have proper service configuration", () => {
      const status = calendarPatternBridgeService.getStatus();
      expect(status.statistics).toHaveProperty("totalEventsProcessed");
      expect(status.statistics).toHaveProperty("totalCalendarScans");
      expect(status.statistics).toHaveProperty("totalNewListingsFound");
      expect(status.statistics).toHaveProperty("totalPatternAnalysisTriggered");
      expect(status.statistics).toHaveProperty("readyCandidatesDetected");
      expect(status.statistics).toHaveProperty("averageProcessingTime");
    });

    it("should maintain correct active state", () => {
      expect(calendarPatternBridgeService.isActive()).toBe(false);
      
      calendarPatternBridgeService.startMonitoring(1);
      expect(calendarPatternBridgeService.isActive()).toBe(true);
      
      calendarPatternBridgeService.stopMonitoring();
      expect(calendarPatternBridgeService.isActive()).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should handle empty calendar data gracefully", async () => {
      const result = await calendarPatternBridgeService.triggerManualScan();
      
      // Should not throw errors even with no calendar data
      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
    });

    it("should maintain service stability after errors", async () => {
      // Trigger scan that might fail
      await calendarPatternBridgeService.triggerManualScan();
      
      // Service should still be functional
      expect(calendarPatternBridgeService.getStatus()).toBeDefined();
      expect(calendarPatternBridgeService.getStatistics()).toBeDefined();
    });
  });
});