/**
 * Auto-Sniping Integration Test
 * 
 * Tests real auto-sniping functionality including trade execution
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCoreTrading, resetCoreTrading } from '@/src/services/trading/consolidated/core-trading/base-service';
import { getCompleteAutoSnipingService, resetCompleteAutoSnipingService } from '@/src/services/trading/complete-auto-sniping-service';
import type { AutoSnipeTarget, SnipeConfiguration } from '@/src/services/trading/complete-auto-sniping-service';

// Use the simplified test infrastructure that's already configured
describe('Auto-Sniping Integration Tests', () => {
  let coreTrading: any;
  let autoSnipingService: any;
  
  beforeEach(async () => {
    // Configure test environment to use mocks (override integration test detection)
    process.env.FORCE_MOCK_DB = 'true';
    process.env.SKIP_DB_CONNECTION = 'true';
    process.env.USE_REAL_DATABASE = 'false';
    process.env.NODE_ENV = 'test';
    
    // Reset services to ensure fresh instances and clean state
    await resetCoreTrading();
    resetCompleteAutoSnipingService();
    
    // Initialize core trading with test configuration
    coreTrading = getCoreTrading({
      enablePaperTrading: true,
      autoSnipingEnabled: true,
      apiKey: 'test-key',
      secretKey: 'test-secret'
    });
    
    // Initialize autosniping service
    const snipeConfig: Partial<SnipeConfiguration> = {
      enabled: true,
      paperTradingMode: true,
      maxConcurrentSnipes: 3,
      minConfidenceScore: 70
    };
    autoSnipingService = getCompleteAutoSnipingService(snipeConfig);
    
    // Initialize services
    await coreTrading.initialize();
    await autoSnipingService.initialize();
  });
  
  afterEach(async () => {
    if (autoSnipingService) {
      await autoSnipingService.stop();
    }
    if (coreTrading) {
      await coreTrading.shutdown();
    }
    await resetCoreTrading();
    vi.clearAllMocks();
  });
  
  it('should initialize auto-sniping services successfully', async () => {
    expect(coreTrading).toBeDefined();
    expect(autoSnipingService).toBeDefined();
    
    // Check service status
    const coreStatus = await coreTrading.getServiceStatus();
    expect(coreStatus.isHealthy).toBe(true);
    expect(coreStatus.paperTradingMode).toBe(true);
    
    const autoSnipeStatus = autoSnipingService.getStatus();
    expect(autoSnipeStatus.isInitialized).toBe(true);
    expect(autoSnipeStatus.config.paperTradingMode).toBe(true);
  });
  
  it('should start and stop auto-sniping correctly', async () => {
    // Start auto-sniping
    const startResult = await autoSnipingService.start();
    expect(startResult.success).toBe(true);
    
    const statusAfterStart = autoSnipingService.getStatus();
    expect(statusAfterStart.isActive).toBe(true);
    
    // Stop auto-sniping
    const stopResult = await autoSnipingService.stop();
    expect(stopResult.success).toBe(true);
    
    const statusAfterStop = autoSnipingService.getStatus();
    expect(statusAfterStop.isActive).toBe(false);
  });

  it('should execute pattern-triggered snipe successfully', async () => {
    // Start auto-sniping
    await autoSnipingService.start();
    
    // Create a mock pattern trigger
    const trigger = {
      id: 'test-pattern-1',
      symbol: 'BTCUSDT',
      pattern: 'breakout',
      confidence: 85,
      timestamp: new Date(),
      price: 45000,
      volume: 1000000,
      metadata: { vcoinId: 'BTC' }
    };
    
    // Execute pattern snipe
    const result = await autoSnipingService.executePatternSnipe(trigger);
    
    expect(result.success).toBe(true);
    expect(result.snipeId).toBeDefined();
    expect(result.executionTime).toBeGreaterThan(0);
    expect(result.executedPrice).toBeGreaterThan(0);
    expect(result.executedQuantity).toBeGreaterThan(0);
  });

  it('should execute manual snipe target successfully', async () => {
    // Start auto-sniping
    await autoSnipingService.start();
    
    // Create a mock snipe target
    const target: AutoSnipeTarget = {
      id: 1,
      symbolName: 'ETHUSDT',
      vcoinId: 'ETH',
      userId: 'test-user',
      entryStrategy: 'market',
      positionSizeUsdt: 50,
      takeProfitLevel: 2,
      takeProfitCustom: 10,
      stopLossPercent: 5,
      status: 'ready',
      priority: 1,
      maxRetries: 3,
      currentRetries: 0,
      confidenceScore: 80,
      riskLevel: 'medium',
      targetExecutionTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      strategy: 'normal'
    };
    
    // Execute manual snipe
    const result = await autoSnipingService.executeManualSnipe(target);
    
    expect(result.success).toBe(true);
    expect(result.snipeId).toBeDefined();
    expect(result.executionTime).toBeGreaterThan(0);
  });

  it('should process pending targets from database', async () => {
    // Start auto-sniping
    await autoSnipingService.start();
    
    // Process pending targets (should handle empty state gracefully)
    const result = await autoSnipingService.processPendingTargets();
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.processed).toBeGreaterThanOrEqual(0);
    expect(result.data.successful).toBeGreaterThanOrEqual(0);
    expect(result.data.successful).toBeLessThanOrEqual(result.data.processed);
  });

  it('should validate core trading integration', async () => {
    // Check core trading auto-sniping methods
    expect(typeof coreTrading.startAutoSniping).toBe('function');
    expect(typeof coreTrading.stopAutoSniping).toBe('function');
    expect(typeof coreTrading.getActivePositions).toBe('function');
    
    // Test core trading auto-sniping lifecycle
    const startResult = await coreTrading.startAutoSniping();
    expect(startResult.success).toBe(true);
    
    const stopResult = await coreTrading.stopAutoSniping();
    expect(stopResult.success).toBe(true);
    
    // Test position management
    const positions = await coreTrading.getActivePositions();
    expect(Array.isArray(positions)).toBe(true);
  });

  it('should handle configuration updates', async () => {
    // Get initial config
    const initialStatus = autoSnipingService.getStatus();
    const initialConfig = initialStatus.config;
    
    // Update configuration
    const newConfig = {
      maxConcurrentSnipes: 5,
      minConfidenceScore: 80,
      paperTradingMode: true
    };
    
    const updateResult = await autoSnipingService.updateConfig(newConfig);
    expect(updateResult.success).toBe(true);
    
    // Verify config was updated
    const updatedStatus = autoSnipingService.getStatus();
    expect(updatedStatus.config.maxConcurrentSnipes).toBe(5);
    expect(updatedStatus.config.minConfidenceScore).toBe(80);
  });

  it('should track metrics and statistics', async () => {
    // Start auto-sniping
    await autoSnipingService.start();
    
    // Get initial statistics
    const initialStatus = autoSnipingService.getStatus();
    expect(initialStatus.totalExecuted).toBe(0);
    expect(initialStatus.totalSuccessful).toBe(0);
    expect(initialStatus.totalFailed).toBe(0);
    
    // Execute a test snipe to generate metrics
    const trigger = {
      id: 'metrics-test',
      symbol: 'BTCUSDT',
      pattern: 'test',
      confidence: 90,
      timestamp: new Date(),
      price: 45000,
      volume: 1000000,
      metadata: {}
    };
    
    await autoSnipingService.executePatternSnipe(trigger);
    
    // Check updated metrics
    const updatedStatus = autoSnipingService.getStatus();
    expect(updatedStatus.totalExecuted).toBe(1);
    expect(updatedStatus.successRate).toBeGreaterThanOrEqual(0);
  });

  it('should handle price alerts and monitoring', async () => {
    // Start auto-sniping
    await autoSnipingService.start();
    
    // Add price alert
    autoSnipingService.addPriceAlert('BTCUSDT', 50000, 'above');
    
    // Check price alerts
    const alerts = autoSnipingService.getPriceAlerts();
    expect(alerts.length).toBe(1);
    expect(alerts[0].symbol).toBe('BTCUSDT');
    expect(alerts[0].targetPrice).toBe(50000);
    expect(alerts[0].direction).toBe('above');
    
    // Remove price alert
    autoSnipingService.removePriceAlert('BTCUSDT');
    const alertsAfterRemoval = autoSnipingService.getPriceAlerts();
    expect(alertsAfterRemoval.length).toBe(0);
  });
  
  it('should handle error conditions gracefully', async () => {
    // Test invalid pattern trigger (low confidence)
    const lowConfidenceTrigger = {
      id: 'low-conf-test',
      symbol: 'BTCUSDT',
      pattern: 'weak',
      confidence: 50, // Below threshold
      timestamp: new Date(),
      price: 45000,
      volume: 1000000,
      metadata: {}
    };
    
    const result = await autoSnipingService.executePatternSnipe(lowConfidenceTrigger);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Confidence');
    
    // Test stopping when not active
    const stopResult = await autoSnipingService.stop();
    const doubleStopResult = await autoSnipingService.stop();
    expect(doubleStopResult.success).toBe(true); // Should handle gracefully
  });

});