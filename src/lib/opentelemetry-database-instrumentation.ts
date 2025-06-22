/**
 * OpenTelemetry Database Instrumentation
 *
 * Provides comprehensive monitoring for database operations including
 * query performance, connection health, and transaction tracking.
 */

import { SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("mexc-sniper-database", "1.0.0");

export interface DatabaseSpanOptions {
  operationType: "select" | "insert" | "update" | "delete" | "transaction" | "migration";
  tableName?: string;
  queryName?: string;
  includeQuery?: boolean;
  sensitiveColumns?: string[];
}

/**
 * Instrument database query operations
 */
export async function instrumentDatabaseQuery<T>(
  queryName: string,
  operation: () => Promise<T>,
  options: DatabaseSpanOptions
): Promise<T> {
  const spanName = `db.${options.operationType}.${options.tableName || "unknown"}.${queryName}`;

  return tracer.startActiveSpan(
    spanName,
    {
      kind: SpanKind.CLIENT,
      attributes: {
        "db.system": "postgresql",
        "db.name": "neondb",
        "db.operation": options.operationType,
        "db.sql.table": options.tableName || "",
        "operation.name": queryName,
        "service.name": "mexc-sniper-database",
      },
    },
    async (span) => {
      const startTime = Date.now();

      try {
        const result = await operation();

        const duration = Date.now() - startTime;
        span.setAttributes({
          "db.operation.duration_ms": duration,
          "db.operation.success": true,
        });

        // Add result metadata
        if (Array.isArray(result)) {
          span.setAttributes({
            "db.result.count": result.length,
          });
        } else if (result && typeof result === "object" && "rowCount" in result) {
          span.setAttributes({
            "db.result.affected_rows": (result as any).rowCount || 0,
          });
        }

        // Performance warnings
        if (duration > 1000) {
          span.setAttributes({
            "db.performance.slow_query": true,
            "db.performance.threshold_exceeded": true,
          });
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttributes({
          "db.operation.duration_ms": duration,
          "db.operation.success": false,
          "error.name": error instanceof Error ? error.name : "DatabaseError",
          "error.message": error instanceof Error ? error.message : String(error),
        });

        // Detect specific database error types
        if (error instanceof Error) {
          const errorMessage = error.message.toLowerCase();
          if (errorMessage.includes("connection")) {
            span.setAttributes({ "db.error.type": "connection" });
          } else if (errorMessage.includes("timeout")) {
            span.setAttributes({ "db.error.type": "timeout" });
          } else if (errorMessage.includes("constraint")) {
            span.setAttributes({ "db.error.type": "constraint_violation" });
          } else if (errorMessage.includes("syntax")) {
            span.setAttributes({ "db.error.type": "syntax_error" });
          }
        }

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });

        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Instrument database transactions
 */
export async function instrumentDatabaseTransaction<T>(
  transactionName: string,
  operation: () => Promise<T>,
  tables: string[] = []
): Promise<T> {
  return instrumentDatabaseQuery(transactionName, operation, {
    operationType: "transaction",
    tableName: tables.join(","),
    queryName: transactionName,
  });
}

/**
 * Instrument pattern detection database operations
 */
export async function instrumentPatternQuery<T>(
  queryType: "search" | "insert" | "update" | "analyze",
  operation: () => Promise<T>,
  _additionalData?: { symbolCount?: number; patternType?: string }
): Promise<T> {
  return instrumentDatabaseQuery(`pattern_${queryType}`, operation, {
    operationType:
      queryType === "search" || queryType === "analyze"
        ? "select"
        : queryType === "insert"
          ? "insert"
          : "update",
    tableName: "pattern_embeddings",
    queryName: `pattern_${queryType}`,
  });
}

/**
 * Instrument trading-related database operations
 */
export async function instrumentTradingQuery<T>(
  queryType: "positions" | "orders" | "history" | "metrics",
  operation: () => Promise<T>,
  _symbol?: string
): Promise<T> {
  return instrumentDatabaseQuery(`trading_${queryType}`, operation, {
    operationType: "select",
    tableName: "trading_data",
    queryName: `trading_${queryType}`,
  });
}

/**
 * Enhanced wrapper for the main database instance with instrumentation
 */
export function instrumentDatabase(db: any) {
  return new Proxy(db, {
    get(target, prop) {
      const originalValue = target[prop];

      // Instrument common database methods
      if (
        typeof originalValue === "function" &&
        ["query", "execute", "transaction"].includes(prop as string)
      ) {
        return async (...args: any[]) => {
          const queryName = args[0]?.toString().substring(0, 50) || "unknown";

          return instrumentDatabaseQuery(
            `db_${prop as string}`,
            () => originalValue.apply(target, args),
            {
              operationType: detectQueryType(queryName),
              queryName: prop as string,
              includeQuery: process.env.NODE_ENV === "development",
            }
          );
        };
      }

      return originalValue;
    },
  });
}

/**
 * Detect query type from SQL string
 */
function detectQueryType(query: string): DatabaseSpanOptions["operationType"] {
  const normalizedQuery = query.toLowerCase().trim();

  if (normalizedQuery.startsWith("select")) return "select";
  if (normalizedQuery.startsWith("insert")) return "insert";
  if (normalizedQuery.startsWith("update")) return "update";
  if (normalizedQuery.startsWith("delete")) return "delete";
  if (normalizedQuery.startsWith("begin") || normalizedQuery.startsWith("commit"))
    return "transaction";
  if (normalizedQuery.includes("create") || normalizedQuery.includes("alter")) return "migration";

  return "select"; // Default fallback
}

/**
 * Database connection health monitoring
 */
export async function instrumentConnectionHealth() {
  return tracer.startActiveSpan(
    "db.connection.health_check",
    {
      kind: SpanKind.CLIENT,
      attributes: {
        "db.system": "postgresql",
        "db.name": "neondb",
        "operation.type": "health_check",
      },
    },
    async (span) => {
      const startTime = Date.now();

      try {
        // This would be called from the health check implementation
        const duration = Date.now() - startTime;
        span.setAttributes({
          "db.connection.response_time_ms": duration,
          "db.connection.status": "healthy",
        });

        span.setStatus({ code: SpanStatusCode.OK });
        return { status: "healthy", responseTime: duration };
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttributes({
          "db.connection.response_time_ms": duration,
          "db.connection.status": "unhealthy",
          "error.message": error instanceof Error ? error.message : String(error),
        });

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: "Database connection unhealthy",
        });

        throw error;
      } finally {
        span.end();
      }
    }
  );
}
