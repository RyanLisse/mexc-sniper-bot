/**
 * Backend Integration Validator
 * 
 * Comprehensive validation service to ensure all backend trading components
 * are properly integrated and functional. This validates:
 * 
 * 1. Real MEXC API connectivity and credentials
 * 2. Balance retrieval functionality
 * 3. Order execution capabilities
 * 4. Auto-sniping workflow integrity
 * 5. Pattern detection integration
 * 6. Error handling and recovery
 */

import { toSafeError } from '@/src/lib/error-type-utils';
import { getUnifiedMexcService } from '@/src/services/mexc-unified-exports';
import { executionOrderService } from '@/src/services/execution/execution-order-service';
import { getMexcMarketService } from '@/src/services/data/mexc-market-service';
import { getCompleteAutoSnipingService } from '@/src/services/trading/complete-auto-sniping-service';
import { getUnifiedAutoSnipingOrchestrator } from '@/src/services/trading/unified-auto-sniping-orchestrator';

export interface ValidationResult {
  component: string;
  success: boolean;
  details: string;
  error?: string;
  timestamp: string;
  duration: number;
}

export interface BackendValidationReport {
  overall: {
    success: boolean;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    duration: number;
  };
  results: ValidationResult[];
  criticalIssues: string[];
  recommendations: string[];
  timestamp: string;
}

/**
 * Backend Integration Validator Service
 */
export class BackendIntegrationValidator {
  private logger = {
    info: (message: string, context?: any) => console.info('[backend-validator]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[backend-validator]', message, context || ''),
    error: (message: string, context?: any) => console.error('[backend-validator]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[backend-validator]', message, context || ''),
  };

  /**
   * Run comprehensive backend validation
   */
  async validateBackendIntegration(): Promise<BackendValidationReport> {
    const startTime = Date.now();
    const results: ValidationResult[] = [];
    const criticalIssues: string[] = [];
    const recommendations: string[] = [];

    this.logger.info('Starting comprehensive backend integration validation');

    // 1. Validate MEXC API Connectivity
    results.push(await this.validateMexcConnectivity());

    // 2. Validate Real Balance Retrieval
    results.push(await this.validateBalanceRetrieval());

    // 3. Validate Market Data Services
    results.push(await this.validateMarketDataServices());

    // 4. Validate Order Execution Services
    results.push(await this.validateOrderExecutionServices());

    // 5. Validate Auto-Sniping Services
    results.push(await this.validateAutoSnipingServices());

    // 6. Validate Complete Orchestration
    results.push(await this.validateCompleteOrchestration());

    // 7. Validate Error Handling
    results.push(await this.validateErrorHandling());

    // 8. Validate Service Integration
    results.push(await this.validateServiceIntegration());

    // Analyze results
    const passedTests = results.filter(r => r.success).length;
    const failedTests = results.filter(r => !r.success).length;

    // Identify critical issues
    results.forEach(result => {
      if (!result.success) {
        if (result.component.includes('Balance') || result.component.includes('Connectivity') || result.component.includes('Order')) {
          criticalIssues.push(`${result.component}: ${result.error}`);
        }
      }
    });

    // Generate recommendations
    if (failedTests > 0) {
      recommendations.push('Review failed validations and ensure all services are properly configured');
    }
    if (criticalIssues.length > 0) {
      recommendations.push('Address critical API connectivity and trading issues before deployment');
    }
    if (passedTests >= 6) {
      recommendations.push('Backend integration is healthy - proceed with testing');
    }

    const totalDuration = Date.now() - startTime;

    const report: BackendValidationReport = {
      overall: {
        success: failedTests === 0,
        totalTests: results.length,
        passedTests,
        failedTests,
        duration: totalDuration,
      },
      results,
      criticalIssues,
      recommendations,
      timestamp: new Date().toISOString(),
    };

    this.logger.info('Backend validation completed', {
      success: report.overall.success,
      passed: passedTests,
      failed: failedTests,
      critical: criticalIssues.length,
      duration: totalDuration,
    });

    return report;
  }

  /**
   * Validate MEXC API Connectivity
   */
  private async validateMexcConnectivity(): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Validating MEXC API connectivity...');

      // Test unified service connectivity
      const mexcService = await getUnifiedMexcService();
      const connectivityTest = await mexcService.testConnectivity();

      if (!connectivityTest) {
        throw new Error('MEXC API connectivity test failed');
      }

      // Test credentials if available
      let credentialDetails = 'No credentials configured (paper trading mode)';
      
      if (process.env.MEXC_API_KEY && process.env.MEXC_SECRET_KEY) {
        try {
          const accountInfo = await mexcService.getAccountInfo();
          if (accountInfo.success) {
            credentialDetails = `Credentials valid - Account Type: ${accountInfo.data?.accountType || 'Unknown'}, Can Trade: ${accountInfo.data?.canTrade || false}`;
          } else {
            credentialDetails = `Credential validation failed: ${accountInfo.error}`;
          }
        } catch (error) {
          credentialDetails = `Credential test error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      }

      return {
        component: 'MEXC API Connectivity',
        success: true,
        details: `API connectivity successful. ${credentialDetails}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };

    } catch (error) {
      const safeError = toSafeError(error);
      return {
        component: 'MEXC API Connectivity',
        success: false,
        details: 'Failed to establish MEXC API connectivity',
        error: safeError.message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate Real Balance Retrieval
   */
  private async validateBalanceRetrieval(): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Validating balance retrieval functionality...');

      const mexcService = await getUnifiedMexcService();
      
      // Test account balances retrieval
      const balanceResult = await mexcService.getAccountBalances();
      
      if (!balanceResult.success) {
        throw new Error(balanceResult.error || 'Balance retrieval failed');
      }

      const balanceCount = balanceResult.data?.balances?.length || 0;
      const totalValue = balanceResult.data?.totalUsdtValue || 0;

      return {
        component: 'Balance Retrieval',
        success: true,
        details: `Successfully retrieved ${balanceCount} balances with total USDT value: ${totalValue.toFixed(2)}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };

    } catch (error) {
      const safeError = toSafeError(error);
      return {
        component: 'Balance Retrieval',
        success: false,
        details: 'Failed to retrieve account balances',
        error: safeError.message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate Market Data Services
   */
  private async validateMarketDataServices(): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Validating market data services...');

      const marketService = getMexcMarketService();
      
      // Test exchange info
      const exchangeInfo = await marketService.getExchangeInfo();
      if (!exchangeInfo.success) {
        throw new Error('Exchange info retrieval failed');
      }

      // Test ticker data
      const tickerResult = await marketService.getTicker('BTCUSDT');
      if (!tickerResult.success) {
        throw new Error('Ticker retrieval failed');
      }

      // Test order book (real implementation)
      const orderBookResult = await marketService.getOrderBookDepth('BTCUSDT', 10);
      if (!orderBookResult.success) {
        throw new Error('Order book retrieval failed');
      }

      const symbolCount = exchangeInfo.data?.symbols?.length || 0;
      const btcPrice = tickerResult.data?.price || '0';

      return {
        component: 'Market Data Services',
        success: true,
        details: `Retrieved ${symbolCount} symbols, BTC price: ${btcPrice}, order book: ${orderBookResult.data?.bids?.length || 0} bids`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };

    } catch (error) {
      const safeError = toSafeError(error);
      return {
        component: 'Market Data Services',
        success: false,
        details: 'Failed to retrieve market data',
        error: safeError.message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate Order Execution Services
   */
  private async validateOrderExecutionServices(): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Validating order execution services...');

      // Test order service configuration
      const config = executionOrderService.getConfig();
      if (!config) {
        throw new Error('Execution order service not configured');
      }

      // Test order creation (not actual execution)
      const testOrder = await executionOrderService.createOrder({
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'limit',
        quantity: 0.001,
        price: 45000,
      });

      if (!testOrder) {
        throw new Error('Failed to create test order');
      }

      // Test order status update
      const statusUpdate = await executionOrderService.updateOrderStatus(testOrder.id, 'cancelled');
      if (!statusUpdate) {
        throw new Error('Failed to update order status');
      }

      return {
        component: 'Order Execution Services',
        success: true,
        details: `Order service functional - Test order created: ${testOrder.id}, API Key configured: ${!!config.apiKey}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };

    } catch (error) {
      const safeError = toSafeError(error);
      return {
        component: 'Order Execution Services',
        success: false,
        details: 'Failed to validate order execution services',
        error: safeError.message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate Auto-Sniping Services
   */
  private async validateAutoSnipingServices(): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Validating auto-sniping services...');

      const snipingService = getCompleteAutoSnipingService();
      
      // Test service status
      const status = snipingService.getStatus();
      if (!status) {
        throw new Error('Auto-sniping service status unavailable');
      }

      // Test initialization
      const initResult = await snipingService.initialize();
      if (!initResult.success) {
        throw new Error(`Auto-sniping initialization failed: ${initResult.error}`);
      }

      return {
        component: 'Auto-Sniping Services',
        success: true,
        details: `Auto-sniping service initialized successfully - Active: ${status.isActive}, Initialized: ${status.isInitialized}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };

    } catch (error) {
      const safeError = toSafeError(error);
      return {
        component: 'Auto-Sniping Services',
        success: false,
        details: 'Failed to validate auto-sniping services',
        error: safeError.message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate Complete Orchestration
   */
  private async validateCompleteOrchestration(): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Validating complete orchestration...');

      const orchestrator = getUnifiedAutoSnipingOrchestrator();
      
      // Test orchestrator status
      const status = orchestrator.getStatus();
      if (!status) {
        throw new Error('Orchestrator status unavailable');
      }

      // Test configuration
      const config = orchestrator.getConfig();
      if (!config) {
        throw new Error('Orchestrator configuration unavailable');
      }

      return {
        component: 'Complete Orchestration',
        success: true,
        details: `Orchestrator functional - Initialized: ${status.isInitialized}, Active: ${status.isActive}, Paper Trading: ${config.paperTradingMode}`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };

    } catch (error) {
      const safeError = toSafeError(error);
      return {
        component: 'Complete Orchestration',
        success: false,
        details: 'Failed to validate complete orchestration',
        error: safeError.message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate Error Handling
   */
  private async validateErrorHandling(): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Validating error handling...');

      const mexcService = await getUnifiedMexcService();
      
      // Test graceful handling of invalid requests
      const invalidTickerResult = await mexcService.getTicker('INVALID_SYMBOL');
      
      // Error handling should return success: false, not throw
      if (invalidTickerResult.success) {
        throw new Error('Error handling failed - invalid request should not succeed');
      }

      if (!invalidTickerResult.error) {
        throw new Error('Error handling failed - error message not provided');
      }

      return {
        component: 'Error Handling',
        success: true,
        details: `Error handling functional - Invalid requests properly handled with error: "${invalidTickerResult.error}"`,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };

    } catch (error) {
      const safeError = toSafeError(error);
      return {
        component: 'Error Handling',
        success: false,
        details: 'Failed to validate error handling',
        error: safeError.message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate Service Integration
   */
  private async validateServiceIntegration(): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Validating service integration...');

      // Test that all services can be instantiated without errors
      const mexcService = await getUnifiedMexcService();
      const marketService = getMexcMarketService();
      const snipingService = getCompleteAutoSnipingService();
      const orchestrator = getUnifiedAutoSnipingOrchestrator();

      if (!mexcService || !marketService || !snipingService || !orchestrator) {
        throw new Error('Failed to instantiate all required services');
      }

      // Test that services can communicate
      const serverTime = await mexcService.getServerTime();
      if (!serverTime.success) {
        throw new Error('Service communication test failed');
      }

      return {
        component: 'Service Integration',
        success: true,
        details: 'All services instantiated successfully and can communicate with MEXC API',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };

    } catch (error) {
      const safeError = toSafeError(error);
      return {
        component: 'Service Integration',
        success: false,
        details: 'Failed to validate service integration',
        error: safeError.message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };
    }
  }
}

// Export singleton instance
let validatorInstance: BackendIntegrationValidator | null = null;

export function getBackendValidator(): BackendIntegrationValidator {
  if (!validatorInstance) {
    validatorInstance = new BackendIntegrationValidator();
  }
  return validatorInstance;
}

export function resetBackendValidator(): void {
  validatorInstance = null;
}