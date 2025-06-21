/**
 * Service Layer Architecture - Improved Separation of Concerns
 * 
 * This module establishes a clean service layer architecture that eliminates
 * tight coupling and improves maintainability by defining clear boundaries
 * between different service domains.
 * 
 * ARCHITECTURE PRINCIPLES:
 * 1. Domain-specific service boundaries
 * 2. Dependency injection through service locator pattern
 * 3. Unified configuration management
 * 4. Clear separation between infrastructure and business logic
 * 5. Standardized service interfaces
 */

// ============================================================================
// Core Service Layer Types
// ============================================================================

export interface ServiceDependencies {
  // Database layer
  database?: any;
  
  // External API integrations
  mexcService?: any;
  
  // Infrastructure services
  cache?: any;
  websocket?: any;
  
  // Configuration
  config?: ServiceConfiguration;
}

export interface ServiceConfiguration {
  // Environment settings
  environment: 'development' | 'production' | 'test';
  
  // Feature flags
  features: {
    autoSniping: boolean;
    patternDetection: boolean;
    riskManagement: boolean;
    aiIntelligence: boolean;
  };
  
  // Service-specific configs
  mexc: {
    apiKey?: string;
    secretKey?: string;
    baseUrl: string;
    timeout: number;
  };
  
  safety: {
    maxPositionSize: number;
    stopLossPercentage: number;
    confidenceThreshold: number;
  };
  
  performance: {
    cacheEnabled: boolean;
    cacheTTL: number;
    rateLimitEnabled: boolean;
  };
}

// ============================================================================
// Service Domain Definitions
// ============================================================================

/**
 * Trading Domain Services
 * Handles all trading-related operations
 */
export interface TradingServices {
  // Core trading operations
  orderExecution: OrderExecutionService;
  portfolioManagement: PortfolioManagementService;
  riskManagement: RiskManagementService;
  
  // Pattern and analysis
  patternDetection: PatternDetectionService;
  marketAnalysis: MarketAnalysisService;
}

/**
 * Infrastructure Domain Services
 * Handles external integrations and infrastructure
 */
export interface InfrastructureServices {
  // External APIs
  mexcIntegration: MexcIntegrationService;
  
  // Data persistence
  dataStorage: DataStorageService;
  
  // Communication
  websocket: WebSocketService;
  notifications: NotificationService;
  
  // Caching and performance
  cache: CacheService;
  performance: PerformanceService;
}

/**
 * Safety and Monitoring Domain Services
 * Handles system safety and monitoring
 */
export interface SafetyServices {
  // Safety coordination
  safetyCoordinator: SafetyCoordinatorService;
  emergencySystem: EmergencySystemService;
  
  // Monitoring and alerting
  systemMonitoring: SystemMonitoringService;
  agentMonitoring: AgentMonitoringService;
  
  // Compliance and audit
  auditLogger: AuditLoggerService;
  complianceChecker: ComplianceCheckerService;
}

// ============================================================================
// Service Interface Definitions
// ============================================================================

export interface BaseService {
  initialize(dependencies: ServiceDependencies): Promise<void>;
  isHealthy(): Promise<boolean>;
  getStatus(): ServiceStatus;
  cleanup(): Promise<void>;
}

export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'offline';
  lastChecked: Date;
  dependencies: string[];
  metrics?: Record<string, any>;
}

// Trading Service Interfaces
export interface OrderExecutionService extends BaseService {
  executeOrder(order: OrderRequest): Promise<OrderResult>;
  cancelOrder(orderId: string): Promise<boolean>;
  getOrderStatus(orderId: string): Promise<OrderStatus>;
}

export interface PortfolioManagementService extends BaseService {
  getPortfolio(): Promise<Portfolio>;
  getPositions(): Promise<Position[]>;
  getBalance(): Promise<Balance>;
}

export interface RiskManagementService extends BaseService {
  assessRisk(operation: TradingOperation): Promise<RiskAssessment>;
  isOperationSafe(operation: TradingOperation): Promise<boolean>;
  getActiveRisks(): Promise<RiskAlert[]>;
}

export interface PatternDetectionService extends BaseService {
  detectPatterns(symbols: SymbolData[]): Promise<PatternMatch[]>;
  analyzePattern(pattern: PatternData): Promise<PatternAnalysis>;
  subscribeToPatterns(callback: PatternCallback): void;
}

export interface MarketAnalysisService extends BaseService {
  analyzeMarket(symbol: string): Promise<MarketAnalysis>;
  getMarketTrends(): Promise<MarketTrend[]>;
  generateTradeSignals(): Promise<TradeSignal[]>;
}

// Infrastructure Service Interfaces
export interface MexcIntegrationService extends BaseService {
  getMarketData(): Promise<MarketData>;
  placeOrder(order: OrderRequest): Promise<OrderResult>;
  getAccountInfo(): Promise<AccountInfo>;
}

export interface DataStorageService extends BaseService {
  save<T>(entity: string, data: T): Promise<string>;
  find<T>(entity: string, id: string): Promise<T | null>;
  query<T>(entity: string, criteria: QueryCriteria): Promise<T[]>;
}

export interface WebSocketService extends BaseService {
  connect(url: string): Promise<void>;
  subscribe(channel: string, callback: MessageCallback): void;
  send(message: any): Promise<void>;
}

export interface NotificationService extends BaseService {
  sendAlert(alert: AlertMessage): Promise<void>;
  sendNotification(notification: Notification): Promise<void>;
  subscribeToAlerts(callback: AlertCallback): void;
}

export interface CacheService extends BaseService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface PerformanceService extends BaseService {
  recordMetric(name: string, value: number, tags?: Record<string, string>): void;
  getMetrics(filter?: MetricFilter): Promise<Metric[]>;
  startTimer(operation: string): Timer;
}

// Safety Service Interfaces
export interface SafetyCoordinatorService extends BaseService {
  checkSystemSafety(): Promise<SafetyStatus>;
  enforceEmergencyStop(reason: string): Promise<void>;
  getActiveViolations(): Promise<SafetyViolation[]>;
}

export interface EmergencySystemService extends BaseService {
  triggerEmergencyStop(reason: string): Promise<void>;
  isInEmergencyMode(): boolean;
  clearEmergencyMode(): Promise<void>;
}

export interface SystemMonitoringService extends BaseService {
  getSystemHealth(): Promise<SystemHealth>;
  monitorComponent(component: string): Promise<ComponentHealth>;
  getSystemMetrics(): Promise<SystemMetrics>;
}

export interface AgentMonitoringService extends BaseService {
  getAgentStatus(agentId: string): Promise<AgentStatus>;
  getAllAgentStatuses(): Promise<AgentStatus[]>;
  isAgentHealthy(agentId: string): Promise<boolean>;
}

export interface AuditLoggerService extends BaseService {
  logAction(action: AuditAction): Promise<void>;
  getAuditTrail(filter?: AuditFilter): Promise<AuditEntry[]>;
  generateReport(period: DateRange): Promise<AuditReport>;
}

export interface ComplianceCheckerService extends BaseService {
  checkCompliance(operation: TradingOperation): Promise<ComplianceResult>;
  getComplianceStatus(): Promise<ComplianceStatus>;
  reportViolation(violation: ComplianceViolation): Promise<void>;
}

// ============================================================================
// Supporting Types
// ============================================================================

// Trading Types
export interface OrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity: number;
  price?: number;
}

export interface OrderResult {
  orderId: string;
  status: 'filled' | 'partial' | 'rejected';
  executedQuantity: number;
  executedPrice: number;
}

export interface OrderStatus {
  orderId: string;
  status: string;
  remainingQuantity: number;
}

export interface Portfolio {
  totalValue: number;
  positions: Position[];
  balance: Balance;
}

export interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  pnl: number;
}

export interface Balance {
  asset: string;
  free: number;
  locked: number;
}

export interface TradingOperation {
  type: 'buy' | 'sell';
  symbol: string;
  quantity: number;
  price?: number;
}

export interface RiskAssessment {
  riskScore: number;
  factors: RiskFactor[];
  recommendation: 'proceed' | 'caution' | 'abort';
}

export interface RiskFactor {
  name: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface RiskAlert {
  id: string;
  severity: 'warning' | 'critical';
  message: string;
  timestamp: Date;
}

// Pattern Detection Types
export interface SymbolData {
  symbol: string;
  price: number;
  volume: number;
  timestamp: Date;
}

export interface PatternMatch {
  patternType: string;
  confidence: number;
  symbol: string;
  timestamp: Date;
}

export interface PatternData {
  type: string;
  parameters: Record<string, any>;
}

export interface PatternAnalysis {
  pattern: PatternData;
  confidence: number;
  recommendation: string;
}

export type PatternCallback = (match: PatternMatch) => void;

// Market Analysis Types
export interface MarketData {
  symbols: SymbolData[];
  timestamp: Date;
}

export interface MarketAnalysis {
  symbol: string;
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  signals: TradeSignal[];
}

export interface MarketTrend {
  symbol: string;
  direction: 'up' | 'down' | 'sideways';
  strength: number;
  duration: number;
}

export interface TradeSignal {
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  reason: string;
}

// Infrastructure Types
export interface AccountInfo {
  accountId: string;
  balances: Balance[];
  permissions: string[];
}

export interface QueryCriteria {
  filters: Record<string, any>;
  limit?: number;
  offset?: number;
  sortBy?: string;
}

export type MessageCallback = (message: any) => void;

export interface AlertMessage {
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
}

export interface Notification {
  type: string;
  recipient: string;
  content: string;
}

export type AlertCallback = (alert: AlertMessage) => void;

export interface MetricFilter {
  name?: string;
  startTime?: Date;
  endTime?: Date;
  tags?: Record<string, string>;
}

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
}

export interface Timer {
  stop(): number;
}

// Safety Types
export interface SafetyStatus {
  overall: 'safe' | 'warning' | 'critical';
  checks: SafetyCheck[];
  violations: SafetyViolation[];
}

export interface SafetyCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

export interface SafetyViolation {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: Date;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  components: ComponentHealth[];
  uptime: number;
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'offline';
  responseTime: number;
  lastChecked: Date;
}

export interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

export interface AgentStatus {
  agentId: string;
  status: 'active' | 'inactive' | 'error';
  lastActivity: Date;
  metrics: Record<string, any>;
}

export interface AuditAction {
  userId: string;
  action: string;
  resource: string;
  timestamp: Date;
  details: Record<string, any>;
}

export interface AuditFilter {
  userId?: string;
  action?: string;
  startTime?: Date;
  endTime?: Date;
}

export interface AuditEntry {
  id: string;
  action: AuditAction;
  result: 'success' | 'failure';
  timestamp: Date;
}

export interface AuditReport {
  period: DateRange;
  summary: Record<string, number>;
  entries: AuditEntry[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ComplianceResult {
  compliant: boolean;
  violations: ComplianceViolation[];
  warnings: string[];
}

export interface ComplianceStatus {
  overall: 'compliant' | 'warning' | 'violation';
  checks: ComplianceCheck[];
}

export interface ComplianceCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

export interface ComplianceViolation {
  rule: string;
  severity: 'minor' | 'major' | 'critical';
  description: string;
  timestamp: Date;
}

// ============================================================================
// Service Locator Pattern
// ============================================================================

/**
 * Service Registry for Dependency Injection
 * Provides centralized service access and lifecycle management
 */
export class ServiceRegistry {
  private services = new Map<string, BaseService>();
  private dependencies: ServiceDependencies = {};
  private configuration: ServiceConfiguration;

  constructor(config: ServiceConfiguration) {
    this.configuration = config;
  }

  register<T extends BaseService>(name: string, service: T): void {
    this.services.set(name, service);
  }

  get<T extends BaseService>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not found in registry`);
    }
    return service as T;
  }

  async initializeAll(): Promise<void> {
    for (const [name, service] of this.services) {
      try {
        await service.initialize(this.dependencies);
        console.log(`✅ Service '${name}' initialized successfully`);
      } catch (error) {
        console.error(`❌ Failed to initialize service '${name}':`, error);
        throw error;
      }
    }
  }

  async healthCheck(): Promise<Map<string, boolean>> {
    const healthStatus = new Map<string, boolean>();
    
    for (const [name, service] of this.services) {
      try {
        const isHealthy = await service.isHealthy();
        healthStatus.set(name, isHealthy);
      } catch (error) {
        console.error(`Health check failed for service '${name}':`, error);
        healthStatus.set(name, false);
      }
    }

    return healthStatus;
  }

  async cleanup(): Promise<void> {
    for (const [name, service] of this.services) {
      try {
        await service.cleanup();
        console.log(`✅ Service '${name}' cleaned up successfully`);
      } catch (error) {
        console.error(`❌ Failed to cleanup service '${name}':`, error);
      }
    }
  }

  getConfiguration(): ServiceConfiguration {
    return this.configuration;
  }

  setDependencies(dependencies: ServiceDependencies): void {
    this.dependencies = { ...this.dependencies, ...dependencies };
  }
}

// ============================================================================
// Service Factory Functions
// ============================================================================

/**
 * Create a new service registry with default configuration
 */
export function createServiceRegistry(config: ServiceConfiguration): ServiceRegistry {
  return new ServiceRegistry(config);
}

/**
 * Get default service configuration
 */
export function getDefaultServiceConfiguration(): ServiceConfiguration {
  return {
    environment: (process.env.NODE_ENV as any) || 'development',
    features: {
      autoSniping: true,
      patternDetection: true,
      riskManagement: true,
      aiIntelligence: false,
    },
    mexc: {
      baseUrl: 'https://api.mexc.com',
      timeout: 30000,
    },
    safety: {
      maxPositionSize: 10,
      stopLossPercentage: 5,
      confidenceThreshold: 80,
    },
    performance: {
      cacheEnabled: true,
      cacheTTL: 300,
      rateLimitEnabled: true,
    },
  };
}

/**
 * Create service dependencies from existing instances
 */
export function createServiceDependencies(
  database: any,
  mexcService: any,
  cache: any,
  websocket: any,
  config: ServiceConfiguration
): ServiceDependencies {
  return {
    database,
    mexcService,
    cache,
    websocket,
    config,
  };
}