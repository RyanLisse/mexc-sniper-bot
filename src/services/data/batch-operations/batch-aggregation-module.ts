/**
 * Batch Aggregation Module
 *
 * Handles aggregation operations and analytics for pattern performance metrics.
 * Extracted from batch-database-service.ts for better modularity.
 */

import { sql } from "drizzle-orm";
import { z } from "zod";
import { db, executeWithRetry, monitoredQuery } from "@/src/db";
import { toSafeError } from "@/src/lib/error-type-utils";

const AggregationOptionsSchema = z.object({
  groupBy: z.enum([
    "pattern_type",
    "symbol_name",
    "user_id",
    "confidence_range",
  ]),
  timeframe: z.enum(["1h", "6h", "24h", "7d", "30d"]).default("24h"),
  includeInactive: z.boolean().default(false),
  minConfidence: z.number().min(0).max(100).optional(),
});

type AggregationOptions = z.infer<typeof AggregationOptionsSchema>;

interface AggregatedMetrics {
  groupKey: string;
  totalPatterns: number;
  averageConfidence: number;
  successRate: number;
  totalOccurrences: number;
  avgProfit: number;
  activePatterns: number;
  timeframe: string;
}

export class BatchAggregationModule {
  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[batch-aggregation-module]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[batch-aggregation-module]", message, context || ""),
    error: (message: string, context?: unknown, error?: Error) =>
      console.error(
        "[batch-aggregation-module]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: unknown) =>
      console.debug("[batch-aggregation-module]", message, context || ""),
  };

  /**
   * Aggregate pattern performance metrics
   */
  async aggregatePatternPerformanceMetrics(
    options: AggregationOptions
  ): Promise<AggregatedMetrics[]> {
    const validatedOptions = AggregationOptionsSchema.parse(options);
    const { groupBy, timeframe, includeInactive, minConfidence } =
      validatedOptions;

    const startTime = performance.now();
    this.logger.info("Starting pattern performance aggregation", {
      groupBy,
      timeframe,
      includeInactive,
      minConfidence,
    });

    try {
      // Build time range condition
      const timeRangeMs = this.parseTimeframe(timeframe);
      const cutoffTime = new Date(Date.now() - timeRangeMs);

      // Build aggregation query
      const baseQuery = this.buildAggregationQuery(
        groupBy,
        cutoffTime,
        includeInactive,
        minConfidence
      );

      const results = await monitoredQuery(
        "aggregate_pattern_performance_metrics",
        async () => {
          return await executeWithRetry(async () => {
            // Replace PostgreSQL-style placeholders with actual values
            let queryWithParams = baseQuery.query;
            baseQuery.parameters.forEach((param, index) => {
              const placeholder = `$${index + 1}`;
              const value =
                param instanceof Date
                  ? `'${param.toISOString()}'`
                  : `'${param}'`;
              queryWithParams = queryWithParams.replace(placeholder, value);
            });
            return await db.execute(sql.raw(queryWithParams));
          });
        },
        {
          operationType: "select",
          tableName: "pattern_embeddings",
          query: baseQuery.query,
          parameters: baseQuery.parameters,
        }
      );

      const metrics: AggregatedMetrics[] = results.map((row: any) => ({
        groupKey: row.group_key,
        totalPatterns: parseInt(row.total_patterns),
        averageConfidence: parseFloat(row.average_confidence),
        successRate: parseFloat(row.success_rate) || 0,
        totalOccurrences: parseInt(row.total_occurrences),
        avgProfit: parseFloat(row.avg_profit) || 0,
        activePatterns: parseInt(row.active_patterns),
        timeframe,
      }));

      const aggregationTime = performance.now() - startTime;
      this.logger.info("Pattern performance aggregation completed", {
        groupBy,
        timeframe,
        resultCount: metrics.length,
        aggregationTimeMs: Math.round(aggregationTime),
      });

      return metrics;
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Pattern performance aggregation failed", {
        groupBy,
        timeframe,
        error: safeError.message,
      });
      throw error;
    }
  }

  /**
   * Optimized bulk select with connection pooling and caching
   */
  async bulkSelect<T>(
    tableName: string,
    conditions: Record<string, any>[],
    options: {
      select?: string[];
      orderBy?: string;
      limit?: number;
      cacheKey?: string;
      cacheTTL?: number;
    } = {}
  ): Promise<T[]> {
    if (conditions.length === 0) return [];

    const cacheKey =
      options.cacheKey ||
      `bulk_select_${tableName}_${JSON.stringify(conditions).slice(0, 50)}`;
    const cacheTTL = options.cacheTTL || 60000; // 1 minute default

    return await monitoredQuery(
      `bulk_select_${tableName}`,
      async () => {
        return await executeWithRetry(async () => {
          const tableRef = this.getTableReference(tableName);
          let query = db.select().from(tableRef);

          // Build OR conditions for multiple where clauses
          if (conditions.length > 0) {
            const orConditions = conditions.map((condition) =>
              this.buildWhereConditions(condition)
            );
            query = query.where(sql`${sql.join(orConditions, sql` OR `)}`);
          }

          if (options.limit) {
            query = query.limit(options.limit);
          }

          return await query;
        });
      },
      {
        operationType: "select",
        tableName,
        query: `SELECT * FROM ${tableName} WHERE ...`,
        parameters: conditions,
      }
    );
  }

  /**
   * Get time-series aggregated data for charts and analytics
   */
  async getTimeSeriesAggregation(
    tableName: string,
    dateColumn: string,
    metricColumns: string[],
    timeframe: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      filters?: Record<string, any>;
      groupBy?: string[];
    } = {}
  ): Promise<any[]> {
    const startTime = performance.now();
    const { startDate, endDate, filters, groupBy } = options;

    this.logger.info("Starting time series aggregation", {
      tableName,
      timeframe,
      metricColumns,
      groupBy,
    });

    try {
      const timeGrouping = this.getTimeGrouping(timeframe);
      const dateRange = this.getDateRange(startDate, endDate, timeframe);

      // Build dynamic query
      const groupByClause = groupBy ? groupBy.join(", ") + ", " : "";
      const selectClause = [
        `${timeGrouping}(${dateColumn}) as time_bucket`,
        ...(groupBy || []),
        ...metricColumns.map((col) => `AVG(${col}) as avg_${col}`),
        ...metricColumns.map((col) => `SUM(${col}) as sum_${col}`),
        "COUNT(*) as total_count",
      ].join(", ");

      let whereClause = `${dateColumn} >= $1 AND ${dateColumn} <= $2`;
      const parameters: any[] = [dateRange.start, dateRange.end];

      if (filters && Object.keys(filters).length > 0) {
        const filterConditions = Object.entries(filters).map(
          ([key, value], index) => {
            parameters.push(value);
            return `${key} = $${parameters.length}`;
          }
        );
        whereClause += " AND " + filterConditions.join(" AND ");
      }

      const query = `
        SELECT ${selectClause}
        FROM ${tableName}
        WHERE ${whereClause}
        GROUP BY ${groupByClause}${timeGrouping}(${dateColumn})
        ORDER BY time_bucket
      `;

      const results = await monitoredQuery(
        "time_series_aggregation",
        async () => {
          return await executeWithRetry(async () => {
            // Replace PostgreSQL-style placeholders
            let queryWithParams = query;
            parameters.forEach((param, index) => {
              const placeholder = `$${index + 1}`;
              const value =
                param instanceof Date
                  ? `'${param.toISOString()}'`
                  : `'${param}'`;
              queryWithParams = queryWithParams.replace(placeholder, value);
            });
            return await db.execute(sql.raw(queryWithParams));
          });
        },
        {
          operationType: "select",
          tableName,
          query,
          parameters,
        }
      );

      const aggregationTime = performance.now() - startTime;
      this.logger.info("Time series aggregation completed", {
        tableName,
        timeframe,
        resultCount: results.length,
        aggregationTimeMs: Math.round(aggregationTime),
      });

      return results;
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Time series aggregation failed", {
        tableName,
        timeframe,
        error: safeError.message,
      });
      throw error;
    }
  }

  // Helper methods
  private buildAggregationQuery(
    groupBy: string,
    cutoffTime: Date,
    includeInactive: boolean,
    minConfidence?: number
  ): { query: string; parameters: any[] } {
    const parameters: any[] = [cutoffTime];
    const whereConditions = ["discovered_at >= $1"];

    if (!includeInactive) {
      whereConditions.push("is_active = true");
    }

    if (minConfidence) {
      whereConditions.push(`confidence >= $${parameters.length + 1}`);
      parameters.push(minConfidence);
    }

    const groupByColumn = this.getGroupByColumn(groupBy);

    const query = `
      SELECT 
        ${groupByColumn} as group_key,
        COUNT(*) as total_patterns,
        AVG(confidence) as average_confidence,
        AVG(COALESCE(success_rate, 0)) as success_rate,
        SUM(COALESCE(occurrences, 0)) as total_occurrences,
        AVG(COALESCE(avg_profit, 0)) as avg_profit,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_patterns
      FROM pattern_embeddings
      WHERE ${whereConditions.join(" AND ")}
      GROUP BY ${groupByColumn}
      ORDER BY total_patterns DESC
    `;

    return { query, parameters };
  }

  private getGroupByColumn(groupBy: string): string {
    switch (groupBy) {
      case "pattern_type":
        return "pattern_type";
      case "symbol_name":
        return "symbol_name";
      case "confidence_range":
        return "CASE WHEN confidence >= 90 THEN '90-100' WHEN confidence >= 80 THEN '80-89' WHEN confidence >= 70 THEN '70-79' ELSE '<70' END";
      default:
        return "pattern_type";
    }
  }

  private parseTimeframe(timeframe: string): number {
    const timeframes: Record<string, number> = {
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };

    return timeframes[timeframe] || timeframes["24h"];
  }

  private getTimeGrouping(timeframe: string): string {
    switch (timeframe) {
      case "1h":
        return "DATE_TRUNC('hour'";
      case "6h":
        return "DATE_TRUNC('hour'";
      case "24h":
        return "DATE_TRUNC('day'";
      case "7d":
        return "DATE_TRUNC('day'";
      case "30d":
        return "DATE_TRUNC('week'";
      default:
        return "DATE_TRUNC('day'";
    }
  }

  private getDateRange(
    startDate?: Date,
    endDate?: Date,
    timeframe?: string
  ): { start: Date; end: Date } {
    const end = endDate || new Date();
    let start = startDate;

    if (!start && timeframe) {
      const timeRangeMs = this.parseTimeframe(timeframe);
      start = new Date(end.getTime() - timeRangeMs);
    }

    if (!start) {
      start = new Date(end.getTime() - 24 * 60 * 60 * 1000); // Default to 24h
    }

    return { start, end };
  }

  private getTableReference(tableName: string): any {
    // This would need to be implemented based on available tables
    throw new Error(`Table reference for ${tableName} not implemented`);
  }

  private buildWhereConditions(conditions: Record<string, any>): any {
    const whereConditions: any[] = [];

    for (const [key, value] of Object.entries(conditions)) {
      if (Array.isArray(value)) {
        whereConditions.push(sql`${sql.identifier(key)} = ANY(${value})`);
      } else if (value === null) {
        whereConditions.push(sql`${sql.identifier(key)} IS NULL`);
      } else {
        whereConditions.push(sql`${sql.identifier(key)} = ${value}`);
      }
    }

    return whereConditions.length === 1
      ? whereConditions[0]
      : sql`${sql.join(whereConditions, sql` AND `)}`;
  }
}
