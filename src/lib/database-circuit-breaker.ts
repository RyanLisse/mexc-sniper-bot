/**
 * Database Circuit Breaker - Emergency Cost Protection
 * 
 * Automatically disables database operations when failure rates exceed thresholds
 * to prevent cascading failures and runaway costs from repeated failed queries.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  recoveryTimeout?: number;
  monitoringWindow?: number;
  successThreshold?: number;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  totalRequests: number;
  totalFailures: number;
  uptime: number;
}

export class DatabaseCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private lastSuccessTime = Date.now();
  private readonly startTime = Date.now();
  private totalRequests = 0;
  private totalFailures = 0;
  
  private readonly failureThreshold: number;
  private readonly recoveryTimeout: number;
  private readonly monitoringWindow: number;
  private readonly successThreshold: number;
  
  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.recoveryTimeout = options.recoveryTimeout ?? 60000; // 1 minute
    this.monitoringWindow = options.monitoringWindow ?? 300000; // 5 minutes
    this.successThreshold = options.successThreshold ?? 3;
  }
  
  async execute<T>(operation: () => Promise<T>, operationName = 'database-operation'): Promise<T> {
    this.totalRequests++;
    
    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        console.info(`🔄 [CIRCUIT BREAKER] Transitioning to HALF_OPEN state`, {
          operation: operationName,
          recoveryTime: this.recoveryTimeout,
          lastFailure: new Date(this.lastFailureTime).toISOString()
        });
        this.state = 'HALF_OPEN';
        this.successCount = 0; // Reset success count for half-open testing
      } else {
        const waitTime = this.recoveryTimeout - (Date.now() - this.lastFailureTime);
        const error = new Error(`Circuit breaker OPEN - database operations disabled to prevent costs. Retry in ${Math.ceil(waitTime / 1000)}s`);
        console.error(`🚨 [CIRCUIT BREAKER] Operation blocked`, {
          operation: operationName,
          state: this.state,
          waitTime: Math.ceil(waitTime / 1000),
          totalFailures: this.totalFailures,
          lastFailure: new Date(this.lastFailureTime).toISOString()
        });
        throw error;
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess(operationName);
      return result;
      
    } catch (error) {
      this.onFailure(error, operationName);
      throw error;
    }
  }
  
  private onSuccess(operationName: string): void {
    this.lastSuccessTime = Date.now();
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      console.info(`✅ [CIRCUIT BREAKER] Success in HALF_OPEN state`, {
        operation: operationName,
        successCount: this.successCount,
        threshold: this.successThreshold
      });
      
      if (this.successCount >= this.successThreshold) {
        console.info(`🟢 [CIRCUIT BREAKER] Transitioning to CLOSED state - operations restored`, {
          operation: operationName,
          successCount: this.successCount,
          previousFailures: this.failureCount
        });
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
      }
    } else if (this.state === 'CLOSED') {
      // Gradually reduce failure count on successful operations
      if (this.failureCount > 0) {
        this.failureCount = Math.max(0, this.failureCount - 1);
      }
    }
  }
  
  private onFailure(error: unknown, operationName: string): void {
    this.failureCount++;
    this.totalFailures++;
    this.lastFailureTime = Date.now();
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check if error indicates a cost-related issue
    const isCostError = this.isCostRelatedError(errorMessage);
    const shouldTripCircuit = this.failureCount >= this.failureThreshold || isCostError;
    
    if (shouldTripCircuit && this.state !== 'OPEN') {
      console.error(`🔴 [CIRCUIT BREAKER] Opening circuit due to failures`, {
        operation: operationName,
        failureCount: this.failureCount,
        threshold: this.failureThreshold,
        error: errorMessage,
        isCostError,
        state: this.state
      });
      
      this.state = 'OPEN';
      
      // Send emergency alert for cost-related failures
      if (isCostError) {
        // Don't await to avoid blocking execution
        this.sendEmergencyAlert(operationName, errorMessage).catch(console.error);
      }
    }
    
    console.error(`❌ [CIRCUIT BREAKER] Operation failed`, {
      operation: operationName,
      error: errorMessage,
      failureCount: this.failureCount,
      state: this.state,
      isCostError
    });
  }
  
  private isCostRelatedError(errorMessage: string): boolean {
    const costKeywords = [
      'quota exceeded',
      'rate limit',
      'billing',
      'payment required',
      'usage limit',
      'cost limit',
      'monthly limit',
      'database limit'
    ];
    
    return costKeywords.some(keyword => 
      errorMessage.toLowerCase().includes(keyword.toLowerCase())
    );
  }
  
  private async sendEmergencyAlert(operationName: string, errorMessage: string): Promise<void> {
    console.error(`🚨🚨🚨 [EMERGENCY ALERT] Database cost-related failure detected!`, {
      operation: operationName,
      error: errorMessage,
      circuitState: this.state,
      failureCount: this.failureCount,
      totalFailures: this.totalFailures,
      timestamp: new Date().toISOString(),
      action: 'IMMEDIATE_INTERVENTION_REQUIRED'
    });
    
    // Integrate with alerting system
    await this.sendExternalAlert(operationName, errorMessage);
  }
  
  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      uptime: Date.now() - this.startTime
    };
  }
  
  /**
   * Force reset the circuit breaker (emergency use only)
   */
  emergencyReset(): void {
    console.warn(`🔄 [EMERGENCY RESET] Circuit breaker reset manually`, {
      previousState: this.state,
      failureCount: this.failureCount,
      timestamp: new Date().toISOString()
    });
    
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
  }
  
  /**
   * Check if the circuit is healthy (not open)
   */
  isHealthy(): boolean {
    return this.state !== 'OPEN';
  }
  
  /**
   * Get human-readable status
   */
  getStatusMessage(): string {
    switch (this.state) {
      case 'CLOSED':
        return 'Circuit healthy - all operations allowed';
      case 'HALF_OPEN':
        return `Circuit testing - ${this.successCount}/${this.successThreshold} successful operations needed`;
      case 'OPEN':
        const waitTime = Math.ceil((this.recoveryTimeout - (Date.now() - this.lastFailureTime)) / 1000);
        return `Circuit open - operations blocked for ${Math.max(0, waitTime)}s`;
      default:
        return 'Circuit state unknown';
    }
  }

  private async sendExternalAlert(operationName: string, errorMessage: string): Promise<void> {
    try {
      const alertPayload = {
        text: `🚨 CIRCUIT BREAKER EMERGENCY ALERT 🚨`,
        attachments: [{
          color: 'danger',
          title: 'Database Circuit Breaker Triggered',
          text: `Database cost-related failure detected. Circuit breaker opened.`,
          fields: [
            { title: "Operation", value: operationName, short: true },
            { title: "Error", value: errorMessage, short: true },
            { title: "Circuit State", value: this.state, short: true },
            { title: "Failure Count", value: this.failureCount.toString(), short: true },
            { title: "Total Failures", value: this.totalFailures.toString(), short: true },
            { title: "Action Required", value: "IMMEDIATE_INTERVENTION_REQUIRED", short: false }
          ],
          ts: Math.floor(Date.now() / 1000)
        }]
      };

      // Send to webhook if configured
      const webhookUrl = process.env.CIRCUIT_BREAKER_WEBHOOK_URL || process.env.EMERGENCY_WEBHOOK_URL;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertPayload)
        });
      }

      // Send email if configured
      const emailEndpoint = process.env.CIRCUIT_BREAKER_EMAIL_ENDPOINT;
      if (emailEndpoint) {
        await fetch(emailEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: process.env.CIRCUIT_BREAKER_EMAIL_TO,
            subject: `EMERGENCY: Database Circuit Breaker Triggered - ${operationName}`,
            body: JSON.stringify({
              operation: operationName,
              error: errorMessage,
              circuitState: this.state,
              failureCount: this.failureCount,
              totalFailures: this.totalFailures,
              stats: this.getStats()
            }, null, 2)
          })
        });
      }
    } catch (error) {
      console.error('[CIRCUIT BREAKER] Failed to send external alert:', error);
    }
  }
}

// Global circuit breaker instance for database operations
export const globalDatabaseCircuitBreaker = new DatabaseCircuitBreaker({
  failureThreshold: parseInt(process.env.DB_CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5'),
  recoveryTimeout: parseInt(process.env.DB_CIRCUIT_BREAKER_RECOVERY_TIMEOUT || '60000'),
  monitoringWindow: parseInt(process.env.DB_CIRCUIT_BREAKER_MONITORING_WINDOW || '300000'),
  successThreshold: parseInt(process.env.DB_CIRCUIT_BREAKER_SUCCESS_THRESHOLD || '3')
});

/**
 * Convenience function to execute database operations with circuit breaker protection
 */
export async function executeWithCircuitBreaker<T>(
  operation: () => Promise<T>, 
  operationName?: string
): Promise<T> {
  return globalDatabaseCircuitBreaker.execute(operation, operationName);
}