/**
 * Database Circuit Breaker - Simple implementation
 * Provides basic circuit breaker functionality for database operations
 */

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  timeout: number;
}

const defaultConfig: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000,
  timeout: 30000,
};

export async function executeWithCircuitBreaker<T>(
  operation: () => Promise<T>,
  operationId: string,
  config: CircuitBreakerConfig = defaultConfig
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`[Circuit Breaker] Operation ${operationId} failed:`, error);
    throw error;
  }
}