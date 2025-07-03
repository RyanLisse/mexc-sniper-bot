/**
 * OpenTelemetry Database Instrumentation
 * Minimal implementation for build optimization
 */

export interface DatabaseInstrumentationConfig {
  enabled: boolean;
  traceSqlQueries: boolean;
  includeQueryParameters: boolean;
}

class DatabaseInstrumentation {
  private config: DatabaseInstrumentationConfig = {
    enabled: process.env.NODE_ENV === 'production',
    traceSqlQueries: false,
    includeQueryParameters: false
  };

  initialize(config?: Partial<DatabaseInstrumentationConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    if (this.config.enabled) {
      console.log('Database instrumentation initialized');
    }
  }

  traceQuery(query: string, parameters?: any[]): void {
    if (!this.config.enabled || !this.config.traceSqlQueries) {
      return;
    }
    
    console.debug('DB Query:', {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      parameters: this.config.includeQueryParameters ? parameters : '[hidden]',
      timestamp: new Date().toISOString()
    });
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}

export const databaseInstrumentation = new DatabaseInstrumentation();

export function initializeDatabaseInstrumentation(config?: Partial<DatabaseInstrumentationConfig>): void {
  databaseInstrumentation.initialize(config);
}

// Missing functions for compatibility
export function instrumentDatabase(operation: string): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      const startTime = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;
        console.debug(`Database operation ${operation} completed in ${duration}ms`);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`Database operation ${operation} failed after ${duration}ms:`, error);
        throw error;
      }
    };
    
    return descriptor;
  };
}

export function instrumentConnectionHealth(): void {
  console.debug('Database connection health instrumentation enabled');
}

export function instrumentDatabaseQuery(query: string, parameters?: any[]): void {
  databaseInstrumentation.traceQuery(query, parameters);
}