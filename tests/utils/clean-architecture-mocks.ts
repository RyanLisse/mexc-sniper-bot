/**
 * Clean Architecture Domain Mocks
 *
 * Comprehensive mock implementations for all Clean Architecture domains:
 * - Repository layer mocks with realistic data simulation
 * - Service layer mocks with proper error simulation
 * - Infrastructure mocks (event bus, external APIs, etc.)
 * - Cross-domain integration mocks
 * - Performance-focused mocks (<100ms execution time)
 */

import { vi } from "vitest";
import type { EventEmitter } from "events";
import {
  CleanArchitectureMockGenerator,
  RepositoryMockFactory,
  ServiceMockFactory,
  type TestDomainEntity,
  type TestPortfolioPosition,
  type TestTradingOrder,
  type TestSafetyAlert,
  type TestRiskMetrics,
} from "./clean-architecture-test-utilities";

// ============================================================================
// Domain Repository Interfaces for Mocking
// ============================================================================

export interface IPortfolioRepository {
  getPortfolioById(id: string): Promise<any>;
  getPortfolioByUserId(userId: string): Promise<any>;
  updatePortfolioValue(id: string, value: number): Promise<void>;
  getPortfolioHistory(id: string, days: number): Promise<any[]>;
}

export interface IPositionRepository {
  getPositionsByPortfolioId(portfolioId: string): Promise<TestPortfolioPosition[]>;
  getPositionBySymbol(portfolioId: string, symbol: string): Promise<TestPortfolioPosition | null>;
  createPosition(position: Omit<TestPortfolioPosition, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<TestPortfolioPosition>;
  updatePosition(id: string, updates: Partial<TestPortfolioPosition>): Promise<TestPortfolioPosition | null>;
  closePosition(id: string): Promise<boolean>;
}

export interface IOrderRepository {
  getOrdersByUserId(userId: string): Promise<TestTradingOrder[]>;
  getActiveOrders(userId: string): Promise<TestTradingOrder[]>;
  createOrder(order: Omit<TestTradingOrder, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<TestTradingOrder>;
  updateOrderStatus(id: string, status: TestTradingOrder['status']): Promise<boolean>;
  cancelOrder(id: string): Promise<boolean>;
}

export interface IAlertRepository {
  getActiveAlerts(): Promise<TestSafetyAlert[]>;
  getAlertsByUserId(userId: string): Promise<TestSafetyAlert[]>;
  createAlert(alert: Omit<TestSafetyAlert, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<TestSafetyAlert>;
  acknowledgeAlert(id: string): Promise<boolean>;
  clearAcknowledgedAlerts(): Promise<number>;
}

export interface IRiskMetricsRepository {
  getLatestMetrics(portfolioId: string): Promise<TestRiskMetrics | null>;
  getMetricsHistory(portfolioId: string, days: number): Promise<TestRiskMetrics[]>;
  saveMetrics(metrics: Omit<TestRiskMetrics, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<TestRiskMetrics>;
}

// ============================================================================
// Domain Service Interfaces for Mocking
// ============================================================================

export interface IPortfolioService {
  calculatePortfolioValue(portfolioId: string): Promise<number>;
  getPortfolioPerformance(portfolioId: string): Promise<any>;
  rebalancePortfolio(portfolioId: string, strategy: string): Promise<any>;
  getPortfolioRisk(portfolioId: string): Promise<any>;
}

export interface ITradingService {
  executeOrder(orderRequest: any): Promise<TestTradingOrder>;
  cancelOrder(orderId: string): Promise<boolean>;
  getOrderBook(symbol: string): Promise<any>;
  getMarketData(symbol: string): Promise<any>;
  validateOrderParameters(order: any): Promise<boolean>;
}

export interface ISafetyService {
  assessPortfolioRisk(portfolioId: string): Promise<any>;
  monitorPositions(portfolioId: string): Promise<void>;
  checkSystemHealth(): Promise<any>;
  triggerEmergencyStop(reason: string): Promise<void>;
  validateTradingParameters(params: any): Promise<boolean>;
}

// ============================================================================
// Comprehensive Domain Mock Factory
// ============================================================================

export class DomainMockFactory {
  private static portfolioData: Map<string, any> = new Map();
  private static positionData: TestPortfolioPosition[] = [];
  private static orderData: TestTradingOrder[] = [];
  private static alertData: TestSafetyAlert[] = [];
  private static riskMetricsData: TestRiskMetrics[] = [];

  /**
   * Initialize with sample data for testing
   */
  static initializeWithSampleData() {
    // Sample portfolio data
    this.portfolioData.set('portfolio_1', {
      id: 'portfolio_1',
      userId: 'user_1',
      name: 'Test Portfolio',
      totalValue: 50000,
      currency: 'USD',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date(),
    });

    // Sample positions
    this.positionData = [
      CleanArchitectureMockGenerator.generatePortfolioPosition({
        id: 'position_1',
        symbol: 'BTCUSDT',
        quantity: 0.5,
        averagePrice: 45000,
      }),
      CleanArchitectureMockGenerator.generatePortfolioPosition({
        id: 'position_2',
        symbol: 'ETHUSDT',
        quantity: 2.0,
        averagePrice: 3000,
      }),
    ];

    // Sample orders
    this.orderData = [
      CleanArchitectureMockGenerator.generateTradingOrder({
        id: 'order_1',
        symbol: 'BTCUSDT',
        side: 'buy',
        status: 'filled',
      }),
      CleanArchitectureMockGenerator.generateTradingOrder({
        id: 'order_2',
        symbol: 'ETHUSDT',
        side: 'sell',
        status: 'pending',
      }),
    ];

    // Sample alerts
    this.alertData = [
      CleanArchitectureMockGenerator.generateSafetyAlert({
        id: 'alert_1',
        type: 'risk_threshold',
        severity: 'medium',
      }),
    ];

    // Sample risk metrics
    this.riskMetricsData = [
      CleanArchitectureMockGenerator.generateRiskMetrics({
        id: 'risk_1',
        portfolioValue: 50000,
        currentDrawdown: 5.0,
      }),
    ];
  }

  /**
   * Create Portfolio Domain Repository Mocks
   */
  static createPortfolioRepositoryMocks(): {
    portfolioRepository: IPortfolioRepository;
    positionRepository: IPositionRepository;
  } {
    const portfolioRepository: IPortfolioRepository = {
      getPortfolioById: vi.fn().mockImplementation(async (id: string) => {
        await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 15));
        return this.portfolioData.get(id) || null;
      }),

      getPortfolioByUserId: vi.fn().mockImplementation(async (userId: string) => {
        await new Promise(resolve => setTimeout(resolve, 8 + Math.random() * 20));
        const portfolio = Array.from(this.portfolioData.values()).find(p => p.userId === userId);
        return portfolio || null;
      }),

      updatePortfolioValue: vi.fn().mockImplementation(async (id: string, value: number) => {
        await new Promise(resolve => setTimeout(resolve, 3 + Math.random() * 10));
        const portfolio = this.portfolioData.get(id);
        if (portfolio) {
          portfolio.totalValue = value;
          portfolio.updatedAt = new Date();
        }
      }),

      getPortfolioHistory: vi.fn().mockImplementation(async (id: string, days: number) => {
        await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 30));
        // Generate sample history data
        return Array.from({ length: days }, (_, index) => ({
          date: new Date(Date.now() - (days - index) * 24 * 60 * 60 * 1000),
          value: 45000 + Math.random() * 10000,
          pnl: (Math.random() - 0.5) * 1000,
        }));
      }),
    };

    const positionRepository: IPositionRepository = {
      getPositionsByPortfolioId: vi.fn().mockImplementation(async (portfolioId: string) => {
        await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 15));
        return this.positionData.filter(p => p.id.includes(portfolioId.split('_')[1] || ''));
      }),

      getPositionBySymbol: vi.fn().mockImplementation(async (portfolioId: string, symbol: string) => {
        await new Promise(resolve => setTimeout(resolve, 3 + Math.random() * 10));
        return this.positionData.find(p => p.symbol === symbol) || null;
      }),

      createPosition: vi.fn().mockImplementation(async (position) => {
        await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 15));
        const newPosition = CleanArchitectureMockGenerator.generatePortfolioPosition(position);
        this.positionData.push(newPosition);
        return newPosition;
      }),

      updatePosition: vi.fn().mockImplementation(async (id: string, updates) => {
        await new Promise(resolve => setTimeout(resolve, 3 + Math.random() * 10));
        const index = this.positionData.findIndex(p => p.id === id);
        if (index !== -1) {
          this.positionData[index] = { ...this.positionData[index], ...updates, updatedAt: new Date() };
          return this.positionData[index];
        }
        return null;
      }),

      closePosition: vi.fn().mockImplementation(async (id: string) => {
        await new Promise(resolve => setTimeout(resolve, 8 + Math.random() * 20));
        const index = this.positionData.findIndex(p => p.id === id);
        if (index !== -1) {
          this.positionData[index].status = 'closed';
          this.positionData[index].updatedAt = new Date();
          return true;
        }
        return false;
      }),
    };

    return { portfolioRepository, positionRepository };
  }

  /**
   * Create Trading Domain Repository Mocks
   */
  static createTradingRepositoryMocks(): {
    orderRepository: IOrderRepository;
  } {
    const orderRepository: IOrderRepository = {
      getOrdersByUserId: vi.fn().mockImplementation(async (userId: string) => {
        await new Promise(resolve => setTimeout(resolve, 8 + Math.random() * 20));
        return this.orderData; // In real implementation, filter by userId
      }),

      getActiveOrders: vi.fn().mockImplementation(async (userId: string) => {
        await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 15));
        return this.orderData.filter(o => o.status === 'pending');
      }),

      createOrder: vi.fn().mockImplementation(async (order) => {
        await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 30));
        const newOrder = CleanArchitectureMockGenerator.generateTradingOrder(order);
        this.orderData.push(newOrder);
        return newOrder;
      }),

      updateOrderStatus: vi.fn().mockImplementation(async (id: string, status) => {
        await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 15));
        const order = this.orderData.find(o => o.id === id);
        if (order) {
          order.status = status;
          order.updatedAt = new Date();
          return true;
        }
        return false;
      }),

      cancelOrder: vi.fn().mockImplementation(async (id: string) => {
        await new Promise(resolve => setTimeout(resolve, 8 + Math.random() * 20));
        const order = this.orderData.find(o => o.id === id);
        if (order && order.status === 'pending') {
          order.status = 'cancelled';
          order.updatedAt = new Date();
          return true;
        }
        return false;
      }),
    };

    return { orderRepository };
  }

  /**
   * Create Safety Domain Repository Mocks
   */
  static createSafetyRepositoryMocks(): {
    alertRepository: IAlertRepository;
    riskMetricsRepository: IRiskMetricsRepository;
  } {
    const alertRepository: IAlertRepository = {
      getActiveAlerts: vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 15));
        return this.alertData.filter(a => !a.acknowledged);
      }),

      getAlertsByUserId: vi.fn().mockImplementation(async (userId: string) => {
        await new Promise(resolve => setTimeout(resolve, 8 + Math.random() * 20));
        return this.alertData; // In real implementation, filter by userId
      }),

      createAlert: vi.fn().mockImplementation(async (alert) => {
        await new Promise(resolve => setTimeout(resolve, 3 + Math.random() * 10));
        const newAlert = CleanArchitectureMockGenerator.generateSafetyAlert(alert);
        this.alertData.push(newAlert);
        return newAlert;
      }),

      acknowledgeAlert: vi.fn().mockImplementation(async (id: string) => {
        await new Promise(resolve => setTimeout(resolve, 2 + Math.random() * 8));
        const alert = this.alertData.find(a => a.id === id);
        if (alert) {
          alert.acknowledged = true;
          alert.acknowledged_at = new Date();
          return true;
        }
        return false;
      }),

      clearAcknowledgedAlerts: vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 25));
        const acknowledgedCount = this.alertData.filter(a => a.acknowledged).length;
        this.alertData = this.alertData.filter(a => !a.acknowledged);
        return acknowledgedCount;
      }),
    };

    const riskMetricsRepository: IRiskMetricsRepository = {
      getLatestMetrics: vi.fn().mockImplementation(async (portfolioId: string) => {
        await new Promise(resolve => setTimeout(resolve, 8 + Math.random() * 20));
        return this.riskMetricsData[this.riskMetricsData.length - 1] || null;
      }),

      getMetricsHistory: vi.fn().mockImplementation(async (portfolioId: string, days: number) => {
        await new Promise(resolve => setTimeout(resolve, 15 + Math.random() * 35));
        return this.riskMetricsData.slice(-days);
      }),

      saveMetrics: vi.fn().mockImplementation(async (metrics) => {
        await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 15));
        const newMetrics = CleanArchitectureMockGenerator.generateRiskMetrics(metrics);
        this.riskMetricsData.push(newMetrics);
        return newMetrics;
      }),
    };

    return { alertRepository, riskMetricsRepository };
  }

  /**
   * Create Domain Service Mocks
   */
  static createDomainServiceMocks() {
    const portfolioService: IPortfolioService = {
      calculatePortfolioValue: vi.fn().mockImplementation(async (portfolioId: string) => {
        await new Promise(resolve => setTimeout(resolve, 15 + Math.random() * 35));
        return 45000 + Math.random() * 15000; // $45k-$60k
      }),

      getPortfolioPerformance: vi.fn().mockImplementation(async (portfolioId: string) => {
        await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 40));
        return {
          totalReturn: Math.random() * 20 - 10, // ±10%
          annualizedReturn: Math.random() * 15 - 5, // ±5%
          sharpeRatio: Math.random() * 2,
          maxDrawdown: Math.random() * 10,
          volatility: Math.random() * 25 + 10, // 10-35%
          winRate: 0.5 + Math.random() * 0.3, // 50-80%
        };
      }),

      rebalancePortfolio: vi.fn().mockImplementation(async (portfolioId: string, strategy: string) => {
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50)); // Longer operation
        return {
          rebalanceId: `rebalance_${Date.now()}`,
          strategy,
          ordersCreated: Math.floor(3 + Math.random() * 5),
          estimatedCost: Math.random() * 100,
          expectedCompletion: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        };
      }),

      getPortfolioRisk: vi.fn().mockImplementation(async (portfolioId: string) => {
        await new Promise(resolve => setTimeout(resolve, 25 + Math.random() * 45));
        return {
          riskScore: Math.random() * 100,
          riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
          concentrationRisk: Math.random() * 50,
          marketRisk: Math.random() * 40,
          liquidityRisk: Math.random() * 30,
          recommendations: [
            'Consider diversifying portfolio',
            'Monitor position sizes',
            'Review stop-loss levels',
          ],
        };
      }),
    };

    const tradingService: ITradingService = {
      executeOrder: vi.fn().mockImplementation(async (orderRequest: any) => {
        await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 60)); // Trading latency
        return CleanArchitectureMockGenerator.generateTradingOrder({
          ...orderRequest,
          status: Math.random() > 0.1 ? 'filled' : 'rejected', // 90% success rate
        });
      }),

      cancelOrder: vi.fn().mockImplementation(async (orderId: string) => {
        await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 30));
        return Math.random() > 0.05; // 95% success rate for cancellations
      }),

      getOrderBook: vi.fn().mockImplementation(async (symbol: string) => {
        await new Promise(resolve => setTimeout(resolve, 8 + Math.random() * 20));
        return {
          symbol,
          bids: Array.from({ length: 20 }, (_, i) => [
            (1000 - i * 0.5).toString(),
            (100 + Math.random() * 500).toString(),
          ]),
          asks: Array.from({ length: 20 }, (_, i) => [
            (1001 + i * 0.5).toString(),
            (100 + Math.random() * 500).toString(),
          ]),
          timestamp: Date.now(),
        };
      }),

      getMarketData: vi.fn().mockImplementation(async (symbol: string) => {
        await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 15));
        return {
          symbol,
          price: 1000 + Math.random() * 500,
          volume24h: 1000000 + Math.random() * 5000000,
          change24h: (Math.random() - 0.5) * 20, // ±10%
          high24h: 1200 + Math.random() * 300,
          low24h: 900 + Math.random() * 200,
          timestamp: Date.now(),
        };
      }),

      validateOrderParameters: vi.fn().mockImplementation(async (order: any) => {
        await new Promise(resolve => setTimeout(resolve, 2 + Math.random() * 8));
        // Simulate validation logic
        return order.quantity > 0 && order.price > 0;
      }),
    };

    const safetyService: ISafetyService = {
      assessPortfolioRisk: vi.fn().mockImplementation(async (portfolioId: string) => {
        await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 50));
        return {
          portfolioId,
          overallRisk: Math.random() * 100,
          riskFactors: [
            { factor: 'concentration', score: Math.random() * 50 },
            { factor: 'volatility', score: Math.random() * 40 },
            { factor: 'liquidity', score: Math.random() * 30 },
          ],
          recommendations: [
            'Monitor position concentration',
            'Consider hedging strategies',
            'Review stop-loss levels',
          ],
          assessedAt: new Date(),
        };
      }),

      monitorPositions: vi.fn().mockImplementation(async (portfolioId: string) => {
        await new Promise(resolve => setTimeout(resolve, 15 + Math.random() * 35));
        // Monitoring doesn't return data, just performs checks
      }),

      checkSystemHealth: vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 12 + Math.random() * 28));
        return {
          overall: 'healthy',
          services: {
            trading: Math.random() > 0.05 ? 'healthy' : 'degraded',
            portfolio: 'healthy',
            safety: 'healthy',
            connectivity: Math.random() > 0.02 ? 'healthy' : 'issue',
          },
          metrics: {
            uptime: 99.9,
            responseTime: 50 + Math.random() * 100,
            errorRate: Math.random() * 0.1,
          },
          lastCheck: new Date(),
        };
      }),

      triggerEmergencyStop: vi.fn().mockImplementation(async (reason: string) => {
        await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 15));
        // Emergency stop doesn't return data
      }),

      validateTradingParameters: vi.fn().mockImplementation(async (params: any) => {
        await new Promise(resolve => setTimeout(resolve, 3 + Math.random() * 10));
        return params && typeof params === 'object';
      }),
    };

    return {
      portfolioService,
      tradingService,
      safetyService,
    };
  }

  /**
   * Create Infrastructure Mocks (Event Bus, External APIs, etc.)
   */
  static createInfrastructureMocks() {
    const eventBus = {
      publish: vi.fn().mockImplementation(async (event: string, data: any, domain?: string) => {
        await new Promise(resolve => setTimeout(resolve, 1 + Math.random() * 5));
        return `event_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      }),

      subscribe: vi.fn().mockImplementation((event: string, handler: Function) => {
        return `subscription_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      }),

      unsubscribe: vi.fn().mockImplementation(async (subscriptionId: string) => {
        await new Promise(resolve => setTimeout(resolve, 1 + Math.random() * 3));
        return true;
      }),
    };

    const mexcApi = {
      getAccountInfo: vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200)); // API latency
        return {
          accountType: 'SPOT',
          balances: [
            { asset: 'USDT', free: '10000.00', locked: '500.00' },
            { asset: 'BTC', free: '0.5', locked: '0.0' },
            { asset: 'ETH', free: '2.0', locked: '0.1' },
          ],
          permissions: ['SPOT', 'MARGIN'],
          updateTime: Date.now(),
        };
      }),

      placeOrder: vi.fn().mockImplementation(async (order: any) => {
        await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 300)); // Order latency
        return {
          orderId: `mexc_${Date.now()}`,
          clientOrderId: order.clientOrderId,
          symbol: order.symbol,
          status: Math.random() > 0.05 ? 'FILLED' : 'REJECTED',
          executedQty: order.quantity,
          executedPrice: order.price * (0.99 + Math.random() * 0.02), // ±1% slippage
          timestamp: Date.now(),
        };
      }),

      cancelOrder: vi.fn().mockImplementation(async (symbol: string, orderId: string) => {
        await new Promise(resolve => setTimeout(resolve, 80 + Math.random() * 150));
        return {
          orderId,
          symbol,
          status: 'CANCELED',
          cancelledTime: Date.now(),
        };
      }),

      getTicker: vi.fn().mockImplementation(async (symbol: string) => {
        await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 70));
        return {
          symbol,
          price: '45000.00',
          priceChange: '500.00',
          priceChangePercent: '1.12',
          volume: '123456.789',
          count: 98765,
          timestamp: Date.now(),
        };
      }),
    };

    const database = {
      transaction: vi.fn().mockImplementation(async (callback: Function) => {
        await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 15));
        return await callback();
      }),

      query: vi.fn().mockImplementation(async (sql: string, params: any[] = []) => {
        await new Promise(resolve => setTimeout(resolve, 2 + Math.random() * 10));
        return { rows: [], rowCount: 0 };
      }),
    };

    return {
      eventBus,
      mexcApi,
      database,
    };
  }

  /**
   * Create Error Simulation Mocks
   */
  static createErrorSimulationMocks() {
    return {
      networkError: vi.fn().mockRejectedValue(new Error('Network connection failed')),
      timeoutError: vi.fn().mockRejectedValue(new Error('Operation timed out')),
      validationError: vi.fn().mockRejectedValue(new Error('Invalid parameters')),
      insufficientFundsError: vi.fn().mockRejectedValue(new Error('Insufficient funds')),
      marketClosedError: vi.fn().mockRejectedValue(new Error('Market is closed')),
      rateLimit: vi.fn().mockRejectedValue(new Error('Rate limit exceeded')),
    };
  }

  /**
   * Reset all mock data to clean state
   */
  static resetAllMockData() {
    this.portfolioData.clear();
    this.positionData.length = 0;
    this.orderData.length = 0;
    this.alertData.length = 0;
    this.riskMetricsData.length = 0;
  }

  /**
   * Setup realistic test scenario data
   */
  static setupRealisticScenario() {
    this.resetAllMockData();
    this.initializeWithSampleData();

    // Add some variance to make it more realistic
    const scenarios = ['bull_market', 'bear_market', 'sideways', 'volatile'];
    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

    switch (scenario) {
      case 'bull_market':
        this.positionData.forEach(position => {
          position.pnl = Math.abs(position.pnl);
          position.pnlPercentage = Math.abs(position.pnlPercentage);
        });
        break;
      case 'bear_market':
        this.positionData.forEach(position => {
          position.pnl = -Math.abs(position.pnl);
          position.pnlPercentage = -Math.abs(position.pnlPercentage);
        });
        break;
      case 'volatile':
        this.positionData.forEach(position => {
          position.pnl *= 2; // Double the volatility
          position.pnlPercentage *= 2;
        });
        break;
    }

    return scenario;
  }
}

// Export the factory
export default DomainMockFactory;