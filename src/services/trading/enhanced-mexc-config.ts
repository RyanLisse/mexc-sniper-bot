/**
 * Enhanced MEXC Configuration Service
 * 
 * This service provides:
 * 1. Secure credential management
 * 2. Real MEXC API endpoint configuration
 * 3. Trading parameter validation
 * 4. Environment-based configuration
 * 5. Credential testing and validation
 */

import { toSafeError } from '@/src/lib/error-type-utils';
import { UnifiedMexcServiceV2 } from '../api/unified-mexc-service-v2';

// Enhanced configuration interfaces
export interface MexcCredentials {
  apiKey: string;
  secretKey: string;
  passphrase?: string;
  sandbox?: boolean;
}

export interface MexcTradingConfig {
  // API Configuration
  credentials: MexcCredentials;
  baseUrl: string;
  websocketUrl: string;
  
  // Trading Parameters
  defaultPositionSize: number; // USDT
  maxPositionSize: number; // USDT
  minPositionSize: number; // USDT
  maxDailyTrades: number;
  maxConcurrentPositions: number;
  
  // Risk Management
  globalStopLoss: number; // %
  globalTakeProfit: number; // %
  maxDrawdownPercent: number; // %
  riskPerTrade: number; // % of account
  
  // Execution Settings
  orderTimeout: number; // ms
  maxSlippage: number; // %
  retryAttempts: number;
  paperTradingMode: boolean;
  
  // Rate Limiting
  requestsPerSecond: number;
  burstAllowance: number;
  
  // Monitoring
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableMetrics: boolean;
}

export interface CredentialValidationResult {
  isValid: boolean;
  canTrade: boolean;
  accountType: string;
  permissions: string[];
  balanceUSDT: number;
  error?: string;
  responseTime: number;
  timestamp: Date;
}

export interface TradingLimits {
  minTradeAmount: number; // USDT
  maxTradeAmount: number; // USDT
  tickSize: number;
  stepSize: number;
  maxOrderRate: number; // orders per second
}

/**
 * Enhanced MEXC Configuration Service
 * 
 * Manages all MEXC-related configuration and credential validation
 */
export class EnhancedMexcConfig {
  private logger = {
    info: (message: string, context?: any) => console.info('[enhanced-mexc-config]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[enhanced-mexc-config]', message, context || ''),
    error: (message: string, context?: any) => console.error('[enhanced-mexc-config]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[enhanced-mexc-config]', message, context || ''),
  };

  private config: MexcTradingConfig;
  private mexcService: UnifiedMexcServiceV2 | null = null;
  private validationCache: Map<string, CredentialValidationResult> = new Map();
  private symbolLimits: Map<string, TradingLimits> = new Map();

  constructor(config?: Partial<MexcTradingConfig>) {
    this.config = this.createDefaultConfig(config);
    this.logger.info('Enhanced MEXC Configuration initialized', {
      paperTrading: this.config.paperTradingMode,
      baseUrl: this.config.baseUrl,
      hasCredentials: !!this.config.credentials.apiKey,
    });
  }

  /**
   * Create default configuration
   */
  private createDefaultConfig(overrides?: Partial<MexcTradingConfig>): MexcTradingConfig {
    const baseConfig: MexcTradingConfig = {
      credentials: {
        apiKey: process.env.MEXC_API_KEY || '',
        secretKey: process.env.MEXC_SECRET_KEY || '',
        passphrase: process.env.MEXC_PASSPHRASE || '',
        sandbox: process.env.MEXC_SANDBOX === 'true',
      },
      baseUrl: process.env.MEXC_BASE_URL || 
        (process.env.MEXC_SANDBOX === 'true' 
          ? 'https://api.mexc.com' // MEXC doesn't have separate sandbox, using main API
          : 'https://api.mexc.com'),
      websocketUrl: process.env.MEXC_WEBSOCKET_URL || 'wss://wbs.mexc.com/ws',
      
      // Trading Parameters
      defaultPositionSize: parseFloat(process.env.MEXC_DEFAULT_POSITION_SIZE || '50'),
      maxPositionSize: parseFloat(process.env.MEXC_MAX_POSITION_SIZE || '500'),
      minPositionSize: parseFloat(process.env.MEXC_MIN_POSITION_SIZE || '10'),
      maxDailyTrades: parseInt(process.env.MEXC_MAX_DAILY_TRADES || '20'),
      maxConcurrentPositions: parseInt(process.env.MEXC_MAX_CONCURRENT_POSITIONS || '5'),
      
      // Risk Management
      globalStopLoss: parseFloat(process.env.MEXC_GLOBAL_STOP_LOSS || '5'),
      globalTakeProfit: parseFloat(process.env.MEXC_GLOBAL_TAKE_PROFIT || '10'),
      maxDrawdownPercent: parseFloat(process.env.MEXC_MAX_DRAWDOWN || '15'),
      riskPerTrade: parseFloat(process.env.MEXC_RISK_PER_TRADE || '2'),
      
      // Execution Settings
      orderTimeout: parseInt(process.env.MEXC_ORDER_TIMEOUT || '30000'),
      maxSlippage: parseFloat(process.env.MEXC_MAX_SLIPPAGE || '2'),
      retryAttempts: parseInt(process.env.MEXC_RETRY_ATTEMPTS || '3'),
      paperTradingMode: process.env.MEXC_PAPER_TRADING === 'true',
      
      // Rate Limiting
      requestsPerSecond: parseInt(process.env.MEXC_REQUESTS_PER_SECOND || '10'),
      burstAllowance: parseInt(process.env.MEXC_BURST_ALLOWANCE || '20'),
      
      // Monitoring
      enableLogging: process.env.MEXC_ENABLE_LOGGING !== 'false',
      logLevel: (process.env.MEXC_LOG_LEVEL as any) || 'info',
      enableMetrics: process.env.MEXC_ENABLE_METRICS !== 'false',
    };

    return { ...baseConfig, ...overrides };
  }

  /**
   * Initialize MEXC service with current configuration
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing MEXC service with enhanced configuration');

      // Validate configuration
      this.validateConfig();

      // Initialize MEXC service
      this.mexcService = new UnifiedMexcServiceV2({
        apiKey: this.config.credentials.apiKey,
        secretKey: this.config.credentials.secretKey,
        baseUrl: this.config.baseUrl,
        timeout: this.config.orderTimeout,
        maxRetries: this.config.retryAttempts,
        enableCaching: true,
        cacheTTL: 30000, // 30 seconds
      });

      // Test credentials if not in paper trading mode
      if (!this.config.paperTradingMode && this.hasCredentials()) {
        const validation = await this.validateCredentials();
        if (!validation.isValid) {
          throw new Error(`Credential validation failed: ${validation.error}`);
        }
        this.logger.info('MEXC credentials validated successfully', {
          canTrade: validation.canTrade,
          accountType: validation.accountType,
          balanceUSDT: validation.balanceUSDT,
        });
      }

      // Load trading limits for common symbols
      await this.loadTradingLimits();

      this.logger.info('Enhanced MEXC configuration initialized successfully');

    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error('Failed to initialize MEXC configuration', safeError);
      throw safeError;
    }
  }

  /**
   * Validate current credentials
   */
  async validateCredentials(): Promise<CredentialValidationResult> {
    const startTime = Date.now();

    try {
      if (!this.mexcService) {
        throw new Error('MEXC service not initialized');
      }

      if (!this.hasCredentials()) {
        return {
          isValid: false,
          canTrade: false,
          accountType: 'none',
          permissions: [],
          balanceUSDT: 0,
          error: 'No API credentials configured',
          responseTime: Date.now() - startTime,
          timestamp: new Date(),
        };
      }

      // Create cache key
      const cacheKey = this.createCredentialCacheKey();
      const cached = this.validationCache.get(cacheKey);
      
      // Use cache if valid (within 5 minutes)
      if (cached && (Date.now() - cached.timestamp.getTime()) < 300000) {
        return cached;
      }

      this.logger.info('Validating MEXC credentials');

      // Test connection with ping
      const pingResult = await this.mexcService.ping();
      if (!pingResult.success) {
        throw new Error(`API connection failed: ${pingResult.error}`);
      }

      // Test authentication with account info
      const accountResult = await this.mexcService.getAccountInfo();
      if (!accountResult.success) {
        throw new Error(`Authentication failed: ${accountResult.error}`);
      }

      const accountInfo = accountResult.data!;

      // Get USDT balance
      const usdtBalance = accountInfo.balances.find(b => b.asset === 'USDT');
      const balanceUSDT = usdtBalance ? parseFloat(usdtBalance.free) + parseFloat(usdtBalance.locked) : 0;

      const result: CredentialValidationResult = {
        isValid: true,
        canTrade: accountInfo.canTrade,
        accountType: accountInfo.accountType,
        permissions: accountInfo.permissions,
        balanceUSDT,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
      };

      // Cache the result
      this.validationCache.set(cacheKey, result);

      this.logger.info('Credential validation successful', {
        canTrade: result.canTrade,
        accountType: result.accountType,
        balanceUSDT: result.balanceUSDT,
        responseTime: result.responseTime,
      });

      return result;

    } catch (error) {
      const safeError = toSafeError(error);
      
      const result: CredentialValidationResult = {
        isValid: false,
        canTrade: false,
        accountType: 'error',
        permissions: [],
        balanceUSDT: 0,
        error: safeError.message,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
      };

      this.logger.error('Credential validation failed', {
        error: safeError.message,
        responseTime: result.responseTime,
      });

      return result;
    }
  }

  /**
   * Get trading limits for a symbol
   */
  async getTradingLimits(symbol: string): Promise<TradingLimits | null> {
    try {
      const cached = this.symbolLimits.get(symbol);
      if (cached) {
        return cached;
      }

      if (!this.mexcService) {
        throw new Error('MEXC service not initialized');
      }

      // Get exchange info for the symbol
      const exchangeInfo = await this.mexcService.getExchangeInfo();
      if (!exchangeInfo.success || !exchangeInfo.data) {
        throw new Error('Failed to get exchange info');
      }

      // Find symbol info
      const symbolInfo = exchangeInfo.data.symbols?.find((s: any) => s.symbol === symbol);
      if (!symbolInfo) {
        this.logger.warn(`Symbol ${symbol} not found in exchange info`);
        return null;
      }

      // Extract filters
      const lotSizeFilter = symbolInfo.filters?.find((f: any) => f.filterType === 'LOT_SIZE');
      const minNotionalFilter = symbolInfo.filters?.find((f: any) => f.filterType === 'MIN_NOTIONAL');
      const priceFilter = symbolInfo.filters?.find((f: any) => f.filterType === 'PRICE_FILTER');

      const limits: TradingLimits = {
        minTradeAmount: minNotionalFilter ? parseFloat(minNotionalFilter.minNotional) : 10,
        maxTradeAmount: 1000000, // Default max
        tickSize: priceFilter ? parseFloat(priceFilter.tickSize) : 0.01,
        stepSize: lotSizeFilter ? parseFloat(lotSizeFilter.stepSize) : 0.001,
        maxOrderRate: 10, // MEXC default
      };

      // Cache the limits
      this.symbolLimits.set(symbol, limits);

      return limits;

    } catch (error) {
      this.logger.error(`Failed to get trading limits for ${symbol}`, error);
      return null;
    }
  }

  /**
   * Validate a trade order before execution
   */
  validateTradeOrder(order: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price?: number;
    type: string;
    quoteOrderQty?: number;
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Check if trading is enabled
      if (!this.config.credentials.apiKey && !this.config.paperTradingMode) {
        errors.push('No API credentials configured and not in paper trading mode');
      }

      // Validate position size
      const positionValue = order.quoteOrderQty || (order.quantity * (order.price || 0));
      
      if (positionValue < this.config.minPositionSize) {
        errors.push(`Position size ${positionValue} below minimum ${this.config.minPositionSize}`);
      }

      if (positionValue > this.config.maxPositionSize) {
        errors.push(`Position size ${positionValue} above maximum ${this.config.maxPositionSize}`);
      }

      // Validate symbol format
      if (!order.symbol || typeof order.symbol !== 'string') {
        errors.push('Invalid symbol');
      }

      // Validate side
      if (!['BUY', 'SELL'].includes(order.side)) {
        errors.push('Invalid order side');
      }

      // Validate quantity
      if (order.quantity !== undefined && (order.quantity <= 0 || !isFinite(order.quantity))) {
        errors.push('Invalid quantity');
      }

      // Validate price for limit orders
      if (order.type === 'LIMIT' && order.price !== undefined && (order.price <= 0 || !isFinite(order.price))) {
        errors.push('Invalid price for limit order');
      }

      return {
        valid: errors.length === 0,
        errors,
      };

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, errors };
    }
  }

  /**
   * Check if credentials are configured
   */
  hasCredentials(): boolean {
    return !!(this.config.credentials.apiKey && this.config.credentials.secretKey);
  }

  /**
   * Get current configuration
   */
  getConfig(): MexcTradingConfig {
    return { ...this.config };
  }

  /**
   * Get MEXC service instance
   */
  getMexcService(): UnifiedMexcServiceV2 | null {
    return this.mexcService;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<MexcTradingConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Clear validation cache if credentials changed
    if (updates.credentials) {
      this.validationCache.clear();
    }

    this.logger.info('Configuration updated', { 
      updatedFields: Object.keys(updates),
    });
  }

  /**
   * Update credentials only
   */
  updateCredentials(credentials: Partial<MexcCredentials>): void {
    this.config.credentials = { ...this.config.credentials, ...credentials };
    this.validationCache.clear();
    
    this.logger.info('Credentials updated');
  }

  /**
   * Get configuration status
   */
  getStatus() {
    return {
      isInitialized: !!this.mexcService,
      hasCredentials: this.hasCredentials(),
      paperTradingMode: this.config.paperTradingMode,
      baseUrl: this.config.baseUrl,
      websocketUrl: this.config.websocketUrl,
      maxPositions: this.config.maxConcurrentPositions,
      maxDailyTrades: this.config.maxDailyTrades,
      riskPerTrade: this.config.riskPerTrade,
      lastValidation: this.getLastValidation(),
      symbolLimitsLoaded: this.symbolLimits.size,
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    const errors: string[] = [];

    // Validate URLs
    if (!this.config.baseUrl || !this.config.baseUrl.startsWith('http')) {
      errors.push('Invalid base URL');
    }

    if (!this.config.websocketUrl || !this.config.websocketUrl.startsWith('ws')) {
      errors.push('Invalid websocket URL');
    }

    // Validate trading parameters
    if (this.config.maxPositionSize <= this.config.minPositionSize) {
      errors.push('Max position size must be greater than min position size');
    }

    if (this.config.globalStopLoss <= 0 || this.config.globalStopLoss > 50) {
      errors.push('Invalid global stop loss percentage');
    }

    if (this.config.riskPerTrade <= 0 || this.config.riskPerTrade > 10) {
      errors.push('Risk per trade should be between 0-10%');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Load trading limits for common symbols
   */
  private async loadTradingLimits(): Promise<void> {
    const commonSymbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'DOTUSDT'];
    
    this.logger.info('Loading trading limits for common symbols');

    for (const symbol of commonSymbols) {
      try {
        await this.getTradingLimits(symbol);
      } catch (error) {
        this.logger.warn(`Failed to load limits for ${symbol}`, error);
      }
    }

    this.logger.info(`Loaded trading limits for ${this.symbolLimits.size} symbols`);
  }

  /**
   * Create cache key for credential validation
   */
  private createCredentialCacheKey(): string {
    const key = `${this.config.credentials.apiKey}:${this.config.credentials.secretKey}`;
    return Buffer.from(key).toString('base64').substring(0, 32);
  }

  /**
   * Get last validation result
   */
  private getLastValidation(): CredentialValidationResult | null {
    const cacheKey = this.createCredentialCacheKey();
    return this.validationCache.get(cacheKey) || null;
  }
}

// Export singleton instance
let enhancedMexcConfig: EnhancedMexcConfig | null = null;

export function getEnhancedMexcConfig(config?: Partial<MexcTradingConfig>): EnhancedMexcConfig {
  if (!enhancedMexcConfig) {
    enhancedMexcConfig = new EnhancedMexcConfig(config);
  }
  return enhancedMexcConfig;
}

export function resetEnhancedMexcConfig(): void {
  enhancedMexcConfig = null;
}

// Helper functions for environment setup
export function validateEnvironmentVariables(): { valid: boolean; missing: string[] } {
  const required = [
    'MEXC_API_KEY',
    'MEXC_SECRET_KEY',
  ];

  const missing = required.filter(key => !process.env[key]);

  return {
    valid: missing.length === 0,
    missing,
  };
}

export function getEnvironmentConfig(): Partial<MexcTradingConfig> {
  return {
    credentials: {
      apiKey: process.env.MEXC_API_KEY || '',
      secretKey: process.env.MEXC_SECRET_KEY || '',
      passphrase: process.env.MEXC_PASSPHRASE || '',
      sandbox: process.env.MEXC_SANDBOX === 'true',
    },
    paperTradingMode: process.env.MEXC_PAPER_TRADING === 'true',
    defaultPositionSize: parseFloat(process.env.MEXC_DEFAULT_POSITION_SIZE || '50'),
    maxConcurrentPositions: parseInt(process.env.MEXC_MAX_CONCURRENT_POSITIONS || '5'),
  };
}