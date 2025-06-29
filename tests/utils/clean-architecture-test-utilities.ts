/**
 * Clean Architecture Test Utilities and Fixtures
 *
 * Comprehensive testing infrastructure for Clean Architecture domains:
 * - Domain-specific mock generators and fixtures
 * - Repository and service mocks with type safety
 * - Cross-domain integration testing helpers
 * - Performance testing utilities (<100ms execution target)
 * - Event-driven architecture testing support
 * - Feature flag integration for testing
 */

import type { EventEmitter } from "events";
import { expect, vi } from "vitest";

// ============================================================================
// Domain Entity Types for Testing
// ============================================================================

export interface TestDomainEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface TestPortfolioPosition extends TestDomainEntity {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentValue: number;
  pnl: number;
  pnlPercentage: number;
  status: 'active' | 'closed' | 'pending';
}

export interface TestTradingOrder extends TestDomainEntity {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop';
  quantity: number;
  price?: number;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  executedQuantity: number;
  executedPrice?: number;
}

export interface TestSafetyAlert extends TestDomainEntity {
  type: 'risk_threshold' | 'position_limit' | 'drawdown' | 'system_health';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  acknowledged: boolean;
  acknowledged_at?: Date;
  metadata: Record<string, any>;
}

export interface TestRiskMetrics extends TestDomainEntity {
  portfolioValue: number;
  totalExposure: number;
  maxDrawdown: number;
  currentDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  avgWinSize: number;
  avgLossSize: number;
  consecutiveLosses: number;
}

// ============================================================================
// Domain Mock Data Generators
// ============================================================================

export class CleanArchitectureMockGenerator {
  /**
   * Generate Portfolio domain entities
   */
  static generatePortfolioPosition(overrides: Partial<TestPortfolioPosition> = {}): TestPortfolioPosition {
    const basePrice = 100 + Math.random() * 900; // $100-$1000
    const quantity = 1 + Math.random() * 99; // 1-100 units
    const priceChange = (Math.random() - 0.5) * 0.2; // ±10% change
    const currentPrice = basePrice * (1 + priceChange);
    const currentValue = quantity * currentPrice;
    const pnl = (currentPrice - basePrice) * quantity;
    const pnlPercentage = (pnl / (basePrice * quantity)) * 100;

    return {
      id: `position_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      symbol: `TEST${Math.random().toString(36).substring(2, 5).toUpperCase()}USDT`,
      quantity,
      averagePrice: basePrice,
      currentValue,
      pnl,
      pnlPercentage,
      status: 'active',
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Within last 7 days
      updatedAt: new Date(),
      version: 1,
      ...overrides,
    };
  }

  /**
   * Generate Trading domain entities
   */
  static generateTradingOrder(overrides: Partial<TestTradingOrder> = {}): TestTradingOrder {
    const price = 50 + Math.random() * 950; // $50-$1000
    const quantity = 1 + Math.random() * 199; // 1-200 units
    const executedQuantity = Math.random() > 0.7 ? quantity : quantity * (0.5 + Math.random() * 0.5);

    return {
      id: `order_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      symbol: `TEST${Math.random().toString(36).substring(2, 5).toUpperCase()}USDT`,
      side: Math.random() > 0.5 ? 'buy' : 'sell',
      type: ['market', 'limit', 'stop'][Math.floor(Math.random() * 3)] as any,
      quantity,
      price,
      status: ['pending', 'filled', 'cancelled'][Math.floor(Math.random() * 3)] as any,
      executedQuantity,
      executedPrice: executedQuantity > 0 ? price * (0.99 + Math.random() * 0.02) : undefined, // ±1% slippage
      createdAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000), // Within last 24 hours
      updatedAt: new Date(),
      version: 1,
      ...overrides,
    };
  }

  /**
   * Generate Safety domain entities
   */
  static generateSafetyAlert(overrides: Partial<TestSafetyAlert> = {}): TestSafetyAlert {
    const types = ['risk_threshold', 'position_limit', 'drawdown', 'system_health'] as const;
    const severities = ['low', 'medium', 'high', 'critical'] as const;
    const type = types[Math.floor(Math.random() * types.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];

    const messages = {
      risk_threshold: 'Portfolio risk exceeded threshold',
      position_limit: 'Position size limit exceeded',
      drawdown: 'Maximum drawdown threshold breached',
      system_health: 'System health degradation detected',
    };

    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type,
      severity,
      message: messages[type],
      acknowledged: Math.random() > 0.6,
      acknowledged_at: Math.random() > 0.6 ? new Date(Date.now() - Math.random() * 60 * 60 * 1000) : undefined,
      metadata: {
        triggeredBy: 'automated_system',
        threshold: Math.random() * 100,
        currentValue: Math.random() * 150,
        context: `${type}_context`,
      },
      createdAt: new Date(Date.now() - Math.random() * 2 * 60 * 60 * 1000), // Within last 2 hours
      updatedAt: new Date(),
      version: 1,
      ...overrides,
    };
  }

  /**
   * Generate Risk Metrics for Safety domain
   */
  static generateRiskMetrics(overrides: Partial<TestRiskMetrics> = {}): TestRiskMetrics {
    const portfolioValue = 10000 + Math.random() * 90000; // $10k-$100k
    const totalExposure = portfolioValue * (0.3 + Math.random() * 0.4); // 30-70% exposure
    const maxDrawdown = Math.random() * 20; // 0-20% max drawdown
    const currentDrawdown = maxDrawdown * (0.1 + Math.random() * 0.9); // 10-100% of max
    const winRate = 0.4 + Math.random() * 0.4; // 40-80% win rate
    const avgWinSize = portfolioValue * (0.01 + Math.random() * 0.04); // 1-5% avg win
    const avgLossSize = portfolioValue * (0.005 + Math.random() * 0.025); // 0.5-3% avg loss
    const sharpeRatio = (winRate * avgWinSize - (1 - winRate) * avgLossSize) / (portfolioValue * 0.02);

    return {
      id: `risk_metrics_${Date.now()}`,
      portfolioValue,
      totalExposure,
      maxDrawdown,
      currentDrawdown,
      sharpeRatio,
      winRate,
      avgWinSize,
      avgLossSize,
      consecutiveLosses: Math.floor(Math.random() * 6), // 0-5 consecutive losses
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      ...overrides,
    };
  }

  /**
   * Generate cross-domain test scenario data
   */
  static generateCrossDomainScenario() {
    const symbol = `TEST${Math.random().toString(36).substring(2, 5).toUpperCase()}USDT`;
    
    return {
      symbol,
      portfolioPosition: this.generatePortfolioPosition({ symbol }),
      activeOrders: Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () =>
        this.generateTradingOrder({ symbol })
      ),
      recentAlerts: Array.from({ length: Math.floor(Math.random() * 3) }, () =>
        this.generateSafetyAlert({
          metadata: { symbol, triggeredBy: 'trading_activity' }
        })
      ),
      riskMetrics: this.generateRiskMetrics(),
    };
  }
}

// ============================================================================
// Repository Mocks for Clean Architecture
// ============================================================================

export interface MockRepository<T extends TestDomainEntity> {
  findById: ReturnType<typeof vi.fn>;
  findAll: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  clear: () => void;
  getCallHistory: () => any[];
}

export class RepositoryMockFactory {
  /**
   * Create a type-safe mock repository for any domain entity
   */
  static createMockRepository<T extends TestDomainEntity>(
    entityName: string,
    mockData: T[] = []
  ): MockRepository<T> {
    let data = [...mockData];
    const callHistory: any[] = [];

    const mockRepo = {
      findById: vi.fn().mockImplementation(async (id: string): Promise<T | null> => {
        callHistory.push({ method: 'findById', args: [id], timestamp: new Date() });
        const entity = data.find(item => item.id === id) || null;
        // Simulate database latency (1-10ms)
        await new Promise(resolve => setTimeout(resolve, 1 + Math.random() * 9));
        return entity;
      }),

      findAll: vi.fn().mockImplementation(async (filter?: any): Promise<T[]> => {
        callHistory.push({ method: 'findAll', args: [filter], timestamp: new Date() });
        // Simulate database latency
        await new Promise(resolve => setTimeout(resolve, 2 + Math.random() * 8));
        
        if (!filter) return [...data];
        
        // Simple filter implementation for testing
        return data.filter(item => {
          return Object.entries(filter).every(([key, value]) => 
            (item as any)[key] === value
          );
        });
      }),

      save: vi.fn().mockImplementation(async (entity: Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<T> => {
        const newEntity = {
          ...entity,
          id: `${entityName}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        } as T;
        
        data.push(newEntity);
        callHistory.push({ method: 'save', args: [entity], result: newEntity, timestamp: new Date() });
        
        // Simulate database latency
        await new Promise(resolve => setTimeout(resolve, 3 + Math.random() * 7));
        return newEntity;
      }),

      update: vi.fn().mockImplementation(async (id: string, updates: Partial<T>): Promise<T | null> => {
        const index = data.findIndex(item => item.id === id);
        if (index === -1) return null;

        const updatedEntity = {
          ...data[index],
          ...updates,
          updatedAt: new Date(),
          version: data[index].version + 1,
        };
        
        data[index] = updatedEntity;
        callHistory.push({ method: 'update', args: [id, updates], result: updatedEntity, timestamp: new Date() });
        
        // Simulate database latency
        await new Promise(resolve => setTimeout(resolve, 2 + Math.random() * 8));
        return updatedEntity;
      }),

      delete: vi.fn().mockImplementation(async (id: string): Promise<boolean> => {
        const index = data.findIndex(item => item.id === id);
        const found = index !== -1;
        
        if (found) {
          data.splice(index, 1);
        }
        
        callHistory.push({ method: 'delete', args: [id], result: found, timestamp: new Date() });
        
        // Simulate database latency
        await new Promise(resolve => setTimeout(resolve, 1 + Math.random() * 4));
        return found;
      }),

      clear: () => {
        data = [];
        callHistory.length = 0;
      },

      getCallHistory: () => [...callHistory],
    };

    return mockRepo;
  }

  /**
   * Create Portfolio domain repository mocks
   */
  static createPortfolioRepositoryMocks() {
    return {
      positionRepository: this.createMockRepository<TestPortfolioPosition>('position'),
      portfolioRepository: this.createMockRepository('portfolio'),
      portfolioSnapshotRepository: this.createMockRepository('portfolio_snapshot'),
    };
  }

  /**
   * Create Trading domain repository mocks
   */
  static createTradingRepositoryMocks() {
    return {
      orderRepository: this.createMockRepository<TestTradingOrder>('order'),
      executionRepository: this.createMockRepository('execution'),
      strategyRepository: this.createMockRepository('strategy'),
      signalRepository: this.createMockRepository('signal'),
    };
  }

  /**
   * Create Safety domain repository mocks
   */
  static createSafetyRepositoryMocks() {
    return {
      alertRepository: this.createMockRepository<TestSafetyAlert>('alert'),
      riskMetricsRepository: this.createMockRepository<TestRiskMetrics>('risk_metrics'),
      monitoringConfigRepository: this.createMockRepository('monitoring_config'),
      incidentRepository: this.createMockRepository('incident'),
    };
  }
}

// ============================================================================
// Use Case and Service Mocks
// ============================================================================

export class ServiceMockFactory {
  /**
   * Create mock for Portfolio use cases
   */
  static createPortfolioUseCaseMocks() {
    return {
      getPortfolioOverview: vi.fn().mockResolvedValue({
        totalValue: 50000,
        totalPnL: 2500,
        totalPnLPercentage: 5.0,
        positions: [],
        lastUpdated: new Date().toISOString(),
      }),
      
      getPortfolioPositions: vi.fn().mockResolvedValue([]),
      
      updatePosition: vi.fn().mockImplementation(async (positionId: string, updates: any) => {
        // Simulate processing time (<100ms target)
        await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 40));
        return CleanArchitectureMockGenerator.generatePortfolioPosition({ id: positionId, ...updates });
      }),
      
      calculatePortfolioMetrics: vi.fn().mockResolvedValue({
        totalValue: 50000,
        totalExposure: 25000,
        diversificationRatio: 0.75,
        beta: 1.2,
        alpha: 0.05,
      }),
    };
  }

  /**
   * Create mock for Trading use cases
   */
  static createTradingUseCaseMocks() {
    return {
      placeOrder: vi.fn().mockImplementation(async (orderRequest: any) => {
        // Simulate order placement time (<100ms target)
        await new Promise(resolve => setTimeout(resolve, 15 + Math.random() * 50));
        return CleanArchitectureMockGenerator.generateTradingOrder({
          ...orderRequest,
          status: 'pending',
        });
      }),
      
      cancelOrder: vi.fn().mockImplementation(async (orderId: string) => {
        await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 20));
        return { orderId, status: 'cancelled', cancelledAt: new Date() };
      }),
      
      getOrderHistory: vi.fn().mockResolvedValue([]),
      
      executeStrategy: vi.fn().mockImplementation(async (strategyId: string, params: any) => {
        // Simulate strategy execution time (<100ms target)
        await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 60));
        return {
          strategyId,
          executionId: `exec_${Date.now()}`,
          status: 'completed',
          ordersPlaced: Math.floor(1 + Math.random() * 3),
          estimatedReturn: Math.random() * 10 - 5, // ±5%
        };
      }),
    };
  }

  /**
   * Create mock for Safety use cases
   */
  static createSafetyUseCaseMocks() {
    return {
      assessRisk: vi.fn().mockImplementation(async (portfolioId: string) => {
        // Simulate risk assessment time (<100ms target)
        await new Promise(resolve => setTimeout(resolve, 8 + Math.random() * 30));
        return {
          portfolioId,
          riskScore: Math.random() * 100,
          riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
          recommendations: ['Consider position sizing', 'Monitor market volatility'],
          assessedAt: new Date(),
        };
      }),
      
      monitorPositions: vi.fn().mockResolvedValue({
        monitored: true,
        alertsGenerated: Math.floor(Math.random() * 3),
        lastCheck: new Date(),
      }),
      
      triggerAlert: vi.fn().mockImplementation(async (alertData: any) => {
        await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 15));
        return CleanArchitectureMockGenerator.generateSafetyAlert(alertData);
      }),
      
      getSystemHealth: vi.fn().mockResolvedValue({
        overall: 'healthy',
        components: {
          trading: 'healthy',
          portfolio: 'healthy',
          monitoring: 'healthy',
          connectivity: 'healthy',
        },
        lastCheck: new Date(),
      }),
    };
  }
}

// ============================================================================
// Event-Driven Architecture Testing
// ============================================================================

export class EventTestingFramework {
  private eventCollector: Array<{
    domain: string;
    eventType: string;
    data: any;
    timestamp: number;
    eventId: string;
  }> = [];

  private mockEventBus: {
    publish: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
  };

  constructor() {
    this.mockEventBus = {
      publish: vi.fn().mockImplementation(async (eventType: string, data: any, domain?: string) => {
        const event = {
          domain: domain || 'unknown',
          eventType,
          data,
          timestamp: Date.now(),
          eventId: `event_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        };
        this.eventCollector.push(event);
        
        // Simulate event processing time (<10ms for event publishing)
        await new Promise(resolve => setTimeout(resolve, 1 + Math.random() * 5));
        return event.eventId;
      }),
      
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
  }

  /**
   * Get the mock event bus for dependency injection
   */
  getMockEventBus() {
    return this.mockEventBus;
  }

  /**
   * Get all collected events
   */
  getCollectedEvents() {
    return [...this.eventCollector];
  }

  /**
   * Get events by domain
   */
  getEventsByDomain(domain: string) {
    return this.eventCollector.filter(e => e.domain === domain);
  }

  /**
   * Get events by type
   */
  getEventsByType(eventType: string) {
    return this.eventCollector.filter(e => e.eventType === eventType);
  }

  /**
   * Wait for specific event to be published
   */
  async waitForEvent(eventType: string, domain?: string, timeout = 5000): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const event = this.eventCollector.find(e => 
        e.eventType === eventType && 
        (!domain || e.domain === domain)
      );
      
      if (event) return event;
      
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    throw new Error(`Event ${eventType} ${domain ? `in domain ${domain}` : ''} not received within ${timeout}ms`);
  }

  /**
   * Clear all collected events
   */
  clearEvents() {
    this.eventCollector.length = 0;
  }

  /**
   * Simulate cross-domain event flow
   */
  simulateCrossDomainEventFlow() {
    // Trading domain publishes order filled event
    this.mockEventBus.publish('OrderFilled', {
      orderId: 'order_123',
      symbol: 'BTCUSDT',
      quantity: 0.1,
      price: 45000,
      side: 'buy',
    }, 'trading');

    // Portfolio domain should react to update positions
    // Safety domain should react to update risk metrics
    
    return this.eventCollector;
  }
}

// ============================================================================
// Performance Testing Framework
// ============================================================================

export class PerformanceTestFramework {
  /**
   * Measure use case execution time with <100ms target
   */
  static async measureUseCasePerformance<T>(
    useCase: () => Promise<T>,
    useCaseName: string,
    targetMs = 100
  ): Promise<{
    result: T;
    executionTime: number;
    passed: boolean;
    details: {
      target: number;
      actual: number;
      overhead: number;
      efficiency: number;
    };
  }> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    const result = await useCase();
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    
    const executionTime = endTime - startTime;
    const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;
    const passed = executionTime <= targetMs;

    return {
      result,
      executionTime,
      passed,
      details: {
        target: targetMs,
        actual: executionTime,
        overhead: memoryUsed / 1024 / 1024, // MB
        efficiency: (targetMs / executionTime) * 100, // Percentage of target
      },
    };
  }

  /**
   * Run concurrent use case performance test
   */
  static async measureConcurrentPerformance<T>(
    useCase: () => Promise<T>,
    concurrency: number,
    useCaseName: string,
    targetMs = 100
  ) {
    const promises = Array.from({ length: concurrency }, () => 
      this.measureUseCasePerformance(useCase, `${useCaseName}_concurrent`, targetMs)
    );

    const results = await Promise.all(promises);
    
    const executionTimes = results.map(r => r.executionTime);
    const passCount = results.filter(r => r.passed).length;

    return {
      concurrency,
      totalTests: concurrency,
      passed: passCount,
      failed: concurrency - passCount,
      passRate: (passCount / concurrency) * 100,
      avgExecutionTime: executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length,
      minExecutionTime: Math.min(...executionTimes),
      maxExecutionTime: Math.max(...executionTimes),
      results,
    };
  }
}

// ============================================================================
// Feature Flag Testing Integration
// ============================================================================

export class FeatureFlagTestHelper {
  private static flagState: Record<string, boolean> = {};

  /**
   * Set feature flag state for testing
   */
  static setFlag(flagName: string, enabled: boolean) {
    this.flagState[flagName] = enabled;
  }

  /**
   * Create mock feature flag service
   */
  static createMockFeatureFlagService() {
    return {
      isEnabled: vi.fn().mockImplementation((flagName: string) => {
        return this.flagState[flagName] || false;
      }),
      
      getAllFlags: vi.fn().mockImplementation(() => {
        return { ...this.flagState };
      }),
      
      setFlag: vi.fn().mockImplementation((flagName: string, enabled: boolean) => {
        this.flagState[flagName] = enabled;
        return true;
      }),
    };
  }

  /**
   * Reset all flags for clean test state
   */
  static resetFlags() {
    this.flagState = {};
  }

  /**
   * Setup common feature flags for clean architecture testing
   */
  static setupCleanArchitectureFlags() {
    this.setFlag('ENABLE_PORTFOLIO_DOMAIN', true);
    this.setFlag('ENABLE_TRADING_DOMAIN', true);
    this.setFlag('ENABLE_SAFETY_DOMAIN', true);
    this.setFlag('ENABLE_CROSS_DOMAIN_EVENTS', true);
    this.setFlag('ENABLE_PERFORMANCE_MONITORING', true);
    this.setFlag('ENABLE_DOMAIN_VALIDATION', true);
  }
}

// ============================================================================
// Assertion Helpers for Clean Architecture
// ============================================================================

export class CleanArchitectureAssertions {
  /**
   * Assert domain entity structure
   */
  static assertDomainEntity(entity: any, entityType: string) {
    expect(entity).toBeDefined();
    expect(typeof entity.id).toBe('string');
    expect(entity.createdAt).toBeInstanceOf(Date);
    expect(entity.updatedAt).toBeInstanceOf(Date);
    expect(typeof entity.version).toBe('number');
    expect(entity.version).toBeGreaterThan(0);
  }

  /**
   * Assert use case execution meets performance requirements
   */
  static assertUseCasePerformance(
    performanceResult: any,
    maxExecutionTime = 100,
    minEfficiency = 80
  ) {
    expect(performanceResult.passed).toBe(true);
    expect(performanceResult.executionTime).toBeLessThanOrEqual(maxExecutionTime);
    expect(performanceResult.details.efficiency).toBeGreaterThanOrEqual(minEfficiency);
  }

  /**
   * Assert cross-domain event flow
   */
  static assertCrossDomainEventFlow(events: any[], expectedFlow: string[]) {
    expect(events.length).toBeGreaterThanOrEqual(expectedFlow.length);
    
    expectedFlow.forEach((expectedEventType, index) => {
      const event = events.find(e => e.eventType === expectedEventType);
      expect(event).toBeDefined();
      expect(event.timestamp).toBeGreaterThan(0);
    });
  }

  /**
   * Assert repository mock interactions
   */
  static assertRepositoryInteractions(
    mockRepository: MockRepository<any>,
    expectedMethods: string[]
  ) {
    const callHistory = mockRepository.getCallHistory();
    const calledMethods = callHistory.map(call => call.method);
    
    expectedMethods.forEach(method => {
      expect(calledMethods).toContain(method);
    });
  }

  /**
   * Assert service response structure for clean architecture
   */
  static assertServiceResponse<T>(response: {
    success: boolean;
    data?: T;
    error?: string;
    metadata?: any;
  }) {
    expect(response).toBeDefined();
    expect(typeof response.success).toBe('boolean');
    
    if (response.success) {
      expect(response.data).toBeDefined();
    } else {
      expect(typeof response.error).toBe('string');
    }
  }
}

// Export all utilities
export default {
  CleanArchitectureMockGenerator,
  RepositoryMockFactory,
  ServiceMockFactory,
  EventTestingFramework,
  PerformanceTestFramework,
  FeatureFlagTestHelper,
  CleanArchitectureAssertions,
};