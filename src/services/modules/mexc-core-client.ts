/**
 * MEXC Core API Client
 * 
 * Focused, lightweight HTTP client for MEXC API communication.
 * This module handles core API requests while keeping under 500 lines.
 * 
 * Features:
 * - Clean HTTP request interface
 * - Built-in error handling
 * - Request/response logging
 * - TypeScript strict mode
 * - Zod validation integration
 */

import { z } from 'zod';
import type { 
  UnifiedMexcConfig, 
  MexcServiceResponse,
  CalendarEntry,
  ExchangeSymbol,
  Portfolio,
  Ticker
} from './mexc-api-types';
import { 
  UnifiedMexcConfigSchema,
  CalendarEntrySchema,
  ExchangeSymbolSchema,
  PortfolioSchema,
  TickerSchema,
  validateMexcData,
  safeMexcValidation
} from './mexc-api-types';

// ============================================================================
// Request/Response Types
// ============================================================================

interface ApiRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  params?: Record<string, string | number | boolean>;
  data?: Record<string, unknown>;
  requiresAuth?: boolean;
  timeout?: number;
}

interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
  timestamp: number;
}

// ============================================================================
// Core API Client Class
// ============================================================================

export class MexcCoreClient {
  private readonly config: Required<UnifiedMexcConfig>;
  private readonly baseHeaders: Record<string, string>;

  constructor(config: UnifiedMexcConfig) {
    // Validate and merge configuration
    this.config = {
      ...UnifiedMexcConfigSchema.parse(config),
      apiKey: config.apiKey || process.env.MEXC_API_KEY || '',
      secretKey: config.secretKey || process.env.MEXC_SECRET_KEY || '',
      passphrase: config.passphrase || process.env.MEXC_PASSPHRASE || '',
    };

    if (!this.config.apiKey || !this.config.secretKey) {
      throw new Error('MEXC API credentials are required');
    }

    this.baseHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'mexc-sniper-bot/1.0.0',
      'X-MEXC-APIKEY': this.config.apiKey,
    };
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Get calendar listings with Zod validation
   */
  async getCalendarListings(): Promise<MexcServiceResponse<CalendarEntry[]>> {
    try {
      const response = await this.makeRequest<CalendarEntry[]>({
        method: 'GET',
        endpoint: '/api/v3/calendar',
        requiresAuth: false,
      });

      // Validate response data
      const validation = safeMexcValidation(response.data, z.array(CalendarEntrySchema));
      
      if (!validation.success) {
        return {
          success: false,
          error: `Calendar validation failed: ${validation.error}`,
          timestamp: Date.now(),
          cached: false,
        };
      }

      return {
        success: true,
        data: validation.data,
        timestamp: Date.now(),
        cached: false,
      };
    } catch (error) {
      return this.handleError('getCalendarListings', error);
    }
  }

  /**
   * Get exchange symbols with validation
   */
  async getExchangeSymbols(): Promise<MexcServiceResponse<ExchangeSymbol[]>> {
    try {
      const response = await this.makeRequest<{ symbols: ExchangeSymbol[] }>({
        method: 'GET',
        endpoint: '/api/v3/exchangeInfo',
        requiresAuth: false,
      });

      const validation = safeMexcValidation(
        response.data.symbols, 
        z.array(ExchangeSymbolSchema)
      );
      
      if (!validation.success) {
        return {
          success: false,
          error: `Exchange symbols validation failed: ${validation.error}`,
          timestamp: Date.now(),
          cached: false,
        };
      }

      return {
        success: true,
        data: validation.data,
        timestamp: Date.now(),
        cached: false,
      };
    } catch (error) {
      return this.handleError('getExchangeSymbols', error);
    }
  }

  /**
   * Get account portfolio information
   */
  async getPortfolio(): Promise<MexcServiceResponse<Portfolio>> {
    try {
      const response = await this.makeRequest<Portfolio>({
        method: 'GET',
        endpoint: '/api/v3/account',
        requiresAuth: true,
      });

      const validation = safeMexcValidation(response.data, PortfolioSchema);
      
      if (!validation.success) {
        return {
          success: false,
          error: `Portfolio validation failed: ${validation.error}`,
          timestamp: Date.now(),
          cached: false,
        };
      }

      return {
        success: true,
        data: validation.data,
        timestamp: Date.now(),
        cached: false,
      };
    } catch (error) {
      return this.handleError('getPortfolio', error);
    }
  }

  /**
   * Get ticker information for a symbol
   */
  async getTicker(symbol: string): Promise<MexcServiceResponse<Ticker>> {
    try {
      const response = await this.makeRequest<Ticker>({
        method: 'GET',
        endpoint: '/api/v3/ticker/24hr',
        params: { symbol },
        requiresAuth: false,
      });

      const validation = safeMexcValidation(response.data, TickerSchema);
      
      if (!validation.success) {
        return {
          success: false,
          error: `Ticker validation failed: ${validation.error}`,
          timestamp: Date.now(),
          cached: false,
        };
      }

      return {
        success: true,
        data: validation.data,
        timestamp: Date.now(),
        cached: false,
      };
    } catch (error) {
      return this.handleError('getTicker', error);
    }
  }

  /**
   * Get server time
   */
  async getServerTime(): Promise<MexcServiceResponse<{ serverTime: number }>> {
    try {
      const response = await this.makeRequest<{ serverTime: number }>({
        method: 'GET',
        endpoint: '/api/v3/time',
        requiresAuth: false,
      });

      return {
        success: true,
        data: response.data,
        timestamp: Date.now(),
        cached: false,
      };
    } catch (error) {
      return this.handleError('getServerTime', error);
    }
  }

  // ============================================================================
  // Core HTTP Request Method
  // ============================================================================

  private async makeRequest<T>(options: ApiRequestOptions): Promise<ApiResponse<T>> {
    const url = new URL(options.endpoint, this.config.baseUrl);
    
    // Add query parameters
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.append(key, value.toString());
      });
    }

    // Prepare headers
    const headers = { ...this.baseHeaders };
    
    // Add authentication if required
    if (options.requiresAuth) {
      const timestamp = Date.now();
      const signature = this.generateSignature(options, timestamp);
      headers['X-MEXC-TIMESTAMP'] = timestamp.toString();
      headers['X-MEXC-SIGNATURE'] = signature;
    }

    // Prepare request options
    const fetchOptions: RequestInit = {
      method: options.method,
      headers,
      signal: AbortSignal.timeout(options.timeout || this.config.timeout),
    };

    if (options.data && ['POST', 'PUT'].includes(options.method)) {
      fetchOptions.body = JSON.stringify(options.data);
    }

    // Make request with retry logic
    let lastError: Error;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(url.toString(), fetchOptions);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        return {
          data,
          status: response.status,
          headers: responseHeaders,
          timestamp: Date.now(),
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  // ============================================================================
  // Authentication & Utility Methods
  // ============================================================================

  private generateSignature(options: ApiRequestOptions, timestamp: number): string {
    // Simple signature generation (implement MEXC's actual algorithm)
    const payload = `${options.method}${options.endpoint}${timestamp}`;
    return btoa(payload + this.config.secretKey).substring(0, 32);
  }

  private handleError(method: string, error: unknown): MexcServiceResponse<never> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`[MexcCoreClient.${method}] Error:`, errorMessage);
    
    return {
      success: false,
      error: errorMessage,
      timestamp: Date.now(),
      cached: false,
    };
  }

  // ============================================================================
  // Configuration Access
  // ============================================================================

  getConfig(): Readonly<Required<UnifiedMexcConfig>> {
    return { ...this.config };
  }

  isConfigured(): boolean {
    return !!(this.config.apiKey && this.config.secretKey);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let globalClient: MexcCoreClient | null = null;

export function createMexcCoreClient(config: UnifiedMexcConfig): MexcCoreClient {
  return new MexcCoreClient(config);
}

export function getMexcCoreClient(config?: UnifiedMexcConfig): MexcCoreClient {
  if (!globalClient && config) {
    globalClient = new MexcCoreClient(config);
  }
  
  if (!globalClient) {
    throw new Error('MexcCoreClient not initialized. Call with config first.');
  }
  
  return globalClient;
}

export function resetMexcCoreClient(): void {
  globalClient = null;
}