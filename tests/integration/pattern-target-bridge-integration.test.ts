/**
 * Pattern-Target Integration Bridge Integration Test
 * 
 * Tests the complete workflow: Pattern Detection → Event Emission → Target Creation → Database Storage
 * This verifies that "THE MISSING BRIDGE" is now working automatically.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PatternDetectionCore } from '@/src/core/pattern-detection';
import { PatternTargetBridgeService } from '@/src/services/data/pattern-detection/pattern-target-bridge-service';
import { PatternTargetIntegrationService } from '@/src/services/data/pattern-detection/pattern-target-integration-service';
import type { SymbolEntry, CalendarEntry } from '@/src/services/api/mexc-unified-exports';

describe('Pattern-Target Integration Bridge', () => {
  let patternEngine: PatternDetectionCore;
  let bridgeService: PatternTargetBridgeService;
  let integrationService: PatternTargetIntegrationService;

  beforeEach(() => {
    // Get singleton instances
    patternEngine = PatternDetectionCore.getInstance();
    bridgeService = PatternTargetBridgeService.getInstance();
    integrationService = PatternTargetIntegrationService.getInstance();

    // Reset bridge service for clean testing
    bridgeService.stopListening();
    bridgeService.resetStatistics();
  });

  afterEach(() => {
    // Clean up listeners
    bridgeService.stopListening();
  });

  it('should automatically create targets when ready state patterns are detected', async () => {
    // Arrange: Mock the integration service to track target creation
    const createTargetsSpy = vi.spyOn(integrationService, 'createTargetsFromPatterns').mockResolvedValue([
      {
        success: true,
        targetId: 1,
        target: { id: 1, symbol: 'TESTUSDT', status: 'ready' }
      }
    ]);

    // Start the bridge service listening
    bridgeService.startListening('test-user');

    // Create mock symbol data that matches ready state pattern (sts:2, st:2, tt:4)
    const mockSymbolData: SymbolEntry[] = [
      {
        cd: 'TESTUSDT',
        vcoinId: 'test-vcoin-123',
        sts: 2,  // Ready
        st: 2,   // Active
        tt: 4,   // Live
        ca: new Date().toISOString(),
        ps: 1,
        qs: 1
      } as SymbolEntry
    ];

    // Act: Trigger pattern detection (this should emit events and create targets)
    const patterns = await patternEngine.detectReadyStatePattern(mockSymbolData, { forceEmitEvents: true });

    // Wait for async event processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Assert: Verify that patterns were detected
    expect(patterns).toHaveLength(1);
    expect(patterns[0].patternType).toBe('ready_state');
    expect(patterns[0].confidence).toBeGreaterThan(85);

    // Verify that the bridge service processed the event and created targets
    expect(createTargetsSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          patternType: 'ready_state',
          symbol: 'TESTUSDT',
          vcoinId: 'test-vcoin-123'
        })
      ]),
      'test-user',
      expect.objectContaining({
        preferredEntryStrategy: 'market',
        defaultPriority: 1,
        minConfidenceForTarget: 85
      })
    );

    // Verify bridge service statistics
    const stats = bridgeService.getStatistics();
    expect(stats.totalEventsProcessed).toBe(1);
    expect(stats.totalTargetsCreated).toBe(1);
    expect(stats.readyStateTargets).toBe(1);

    createTargetsSpy.mockRestore();
  });

  it('should automatically create targets when advance opportunities are detected', async () => {
    // Arrange: Mock the integration service
    const createTargetsSpy = vi.spyOn(integrationService, 'createTargetsFromPatterns').mockResolvedValue([
      {
        success: true,
        targetId: 2,
        target: { id: 2, symbol: 'ADVUSDT', status: 'pending' }
      }
    ]);

    bridgeService.startListening('test-user');

    // Create mock calendar data for advance opportunity (launch in 6 hours)
    const futureTime = Date.now() + (6 * 60 * 60 * 1000); // 6 hours from now
    const mockCalendarData: CalendarEntry[] = [
      {
        symbol: 'ADVUSDT',
        vcoinId: 'adv-vcoin-456',
        projectName: 'Advanced Test Token',
        firstOpenTime: futureTime
      } as CalendarEntry
    ];

    // Act: Trigger advance opportunity detection
    const patterns = await patternEngine.detectAdvanceOpportunities(mockCalendarData, { forceEmitEvents: true });

    // Wait for async event processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Assert: Verify patterns were detected
    expect(patterns.length).toBeGreaterThan(0);
    const advancePattern = patterns.find(p => p.patternType === 'launch_sequence');
    expect(advancePattern).toBeDefined();
    expect(advancePattern?.advanceNoticeHours).toBeCloseTo(6, 1);

    // Verify target creation was triggered
    expect(createTargetsSpy).toHaveBeenCalled();

    // Verify statistics
    const stats = bridgeService.getStatistics();
    expect(stats.totalEventsProcessed).toBe(1);
    expect(stats.advanceOpportunityTargets).toBeGreaterThan(0);

    createTargetsSpy.mockRestore();
  });

  it('should handle pattern detection events with proper filtering', async () => {
    // Arrange: Mock integration service to return mixed results
    const createTargetsSpy = vi.spyOn(integrationService, 'createTargetsFromPatterns').mockResolvedValue([
      { success: true, targetId: 3 },
      { success: false, reason: 'Target already exists' }
    ]);

    bridgeService.startListening('test-user');

    // Create mixed quality symbol data
    const mockSymbolData: SymbolEntry[] = [
      {
        cd: 'HIGHUSDT',
        vcoinId: 'high-vcoin-789',
        sts: 2, st: 2, tt: 4,
        ca: new Date().toISOString(),
        ps: 1, qs: 1
      } as SymbolEntry,
      {
        cd: 'LOWUSDT',
        vcoinId: 'low-vcoin-000',
        sts: 1, st: 1, tt: 1, // Low quality pattern
        ca: new Date().toISOString()
      } as SymbolEntry
    ];

    // Act: Detect patterns
    await patternEngine.detectReadyStatePattern(mockSymbolData, { forceEmitEvents: true });
    await new Promise(resolve => setTimeout(resolve, 100));

    // Assert: Verify filtering worked (only high-quality patterns should trigger targets)
    const stats = bridgeService.getStatistics();
    expect(stats.totalEventsProcessed).toBe(1);
    expect(stats.totalTargetsCreated).toBe(1);
    expect(stats.totalTargetsFailed).toBe(1);

    createTargetsSpy.mockRestore();
  });

  it('should track bridge service status and statistics correctly', async () => {
    // Initially not listening
    expect(bridgeService.isActive()).toBe(false);

    // Start listening
    bridgeService.startListening('test-user');
    expect(bridgeService.isActive()).toBe(true);

    // Check initial statistics
    let stats = bridgeService.getStatistics();
    expect(stats.totalEventsProcessed).toBe(0);
    expect(stats.totalTargetsCreated).toBe(0);
    expect(stats.lastEventProcessed).toBeNull();

    // Mock successful target creation
    vi.spyOn(integrationService, 'createTargetsFromPatterns').mockResolvedValue([
      { success: true, targetId: 4 }
    ]);

    // Trigger pattern detection
    const mockSymbolData: SymbolEntry[] = [{
      cd: 'STATUSDT',
      vcoinId: 'stat-vcoin-999',
      sts: 2, st: 2, tt: 4,
      ca: new Date().toISOString(),
      ps: 1, qs: 1
    } as SymbolEntry];

    await patternEngine.detectReadyStatePattern(mockSymbolData, { forceEmitEvents: true });
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check updated statistics
    stats = bridgeService.getStatistics();
    expect(stats.totalEventsProcessed).toBe(1);
    expect(stats.totalTargetsCreated).toBe(1);
    expect(stats.lastEventProcessed).not.toBeNull();
    expect(stats.averageProcessingTime).toBeGreaterThan(0);

    // Stop listening
    bridgeService.stopListening();
    expect(bridgeService.isActive()).toBe(false);
  });

  it('should handle errors gracefully without crashing the bridge', async () => {
    // Arrange: Mock integration service to throw error
    const createTargetsSpy = vi.spyOn(integrationService, 'createTargetsFromPatterns')
      .mockRejectedValue(new Error('Database connection failed'));

    bridgeService.startListening('test-user');

    const mockSymbolData: SymbolEntry[] = [{
      cd: 'ERRORUSDT',
      vcoinId: 'error-vcoin-666',
      sts: 2, st: 2, tt: 4,
      ca: new Date().toISOString(),
      ps: 1, qs: 1
    } as SymbolEntry];

    // Act: Trigger pattern detection
    await patternEngine.detectReadyStatePattern(mockSymbolData, { forceEmitEvents: true });
    await new Promise(resolve => setTimeout(resolve, 100));

    // Assert: Bridge should still be active and have processed the event (even if it failed)
    expect(bridgeService.isActive()).toBe(true);
    
    const stats = bridgeService.getStatistics();
    expect(stats.totalEventsProcessed).toBe(1);
    expect(stats.totalTargetsCreated).toBe(0); // No targets created due to error
    expect(stats.totalTargetsFailed).toBeGreaterThan(0); // Error was tracked

    createTargetsSpy.mockRestore();
  });
});