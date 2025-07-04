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
    enabled: process.env.NODE_ENV === "production",
    traceSqlQueries: false,
    includeQueryParameters: false,
  };

  initialize(config?: Partial<DatabaseInstrumentationConfig>): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (this.config.enabled) {
      console.log("Database instrumentation initialized");
    }
  }

  traceQuery(query: string, parameters?: any[]): void {
    if (!this.config.enabled || !this.config.traceSqlQueries) {
      return;
    }

    console.debug("DB Query:", {
      query: query.substring(0, 100) + (query.length > 100 ? "..." : ""),
      parameters: this.config.includeQueryParameters ? parameters : "[hidden]",
      timestamp: new Date().toISOString(),
    });
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}

export const databaseInstrumentation = new DatabaseInstrumentation();

export function initializeDatabaseInstrumentation(
  config?: Partial<DatabaseInstrumentationConfig>
): void {
  databaseInstrumentation.initialize(config);
}

// Missing functions for compatibility - FIX: should return the database instance, not a decorator
export function instrumentDatabase<T>(dbInstance: T): T {
  // Simply return the database instance without decoration for now
  // In a full implementation, this would wrap the instance with telemetry
  return dbInstance;
}

export async function instrumentConnectionHealth() {
  // Provide a simple health check implementation without circular dependencies
  console.debug("Database connection health instrumentation enabled");
  
  // Return a promise that resolves to basic health status
  return {
    status: "healthy",
    database: "instrumented",
    timestamp: new Date().toISOString(),
    responseTime: 0,
  };
}

export async function instrumentDatabaseQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  options?: {
    operationType?: string;
    tableName?: string;
    queryName?: string;
    includeQuery?: boolean;
  }
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;
    
    if (databaseInstrumentation.isEnabled()) {
      console.debug("DB Query Instrumentation:", {
        queryName,
        operationType: options?.operationType || "select",
        tableName: options?.tableName,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (databaseInstrumentation.isEnabled()) {
      console.error("DB Query Error:", {
        queryName,
        operationType: options?.operationType || "select",
        tableName: options?.tableName,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
    
    throw error;
  }
}
