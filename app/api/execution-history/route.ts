import { and, desc, eq, gte, lte } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { executionHistory } from "@/src/db/schemas/supabase-trading";

interface ExecutionRecord {
  action: string;
  status: string;
  totalCost?: number;
  fees?: number;
  executionLatencyMs?: number;
  slippagePercent?: number;
  symbolName?: string;
  executedAt?: number;
  requestedAt?: number;
  price?: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const action = searchParams.get("action"); // "buy", "sell", or null for all
    const status = searchParams.get("status"); // "success", "failed", or null for all
    const symbolName = searchParams.get("symbol"); // Filter by specific symbol
    const fromDate = searchParams.get("fromDate"); // Unix timestamp
    const toDate = searchParams.get("toDate"); // Unix timestamp

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameter: userId",
        },
        { status: 400 }
      );
    }

    // Build query conditions
    const conditions = [eq(executionHistory.userId, userId)];

    if (action) {
      conditions.push(eq(executionHistory.action, action));
    }

    if (status) {
      conditions.push(eq(executionHistory.status, status));
    }

    if (symbolName) {
      conditions.push(eq(executionHistory.symbolName, symbolName));
    }

    if (fromDate) {
      conditions.push(
        gte(executionHistory.executedAt, new Date(parseInt(fromDate) * 1000))
      );
    }

    if (toDate) {
      conditions.push(
        lte(executionHistory.executedAt, new Date(parseInt(toDate) * 1000))
      );
    }

    // Get execution history with pagination and error handling
    let executions: unknown[];
    try {
      executions = await Promise.race([
        db
          .select()
          .from(executionHistory)
          .where(and(...conditions))
          .orderBy(desc(executionHistory.executedAt))
          .limit(limit)
          .offset(offset),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Database query timeout")), 10000)
        ),
      ]);
    } catch (dbError) {
      console.error("Database error in execution history query:", {
        userId,
        error: dbError,
      });

      // Return empty execution history with success status
      const fallbackResponse = {
        executions: [],
        pagination: {
          total: 0,
          limit,
          offset,
          hasMore: false,
        },
        summary: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          totalBuyVolume: 0,
          totalSellVolume: 0,
          totalFees: 0,
          avgExecutionLatencyMs: 0,
          avgSlippagePercent: 0,
          successRate: 0,
        },
        symbolStats: [],
        error: "Database temporarily unavailable",
        fallback: true,
      };

      return NextResponse.json({
        success: true,
        data: fallbackResponse,
      });
    }

    // For simplicity, use the length of returned results
    // In a production system, you might want to implement proper pagination counting
    const totalCount = executions.length;

    // Calculate summary statistics
    const buyExecutions = (executions as ExecutionRecord[]).filter(
      (exec: ExecutionRecord) =>
        exec.action === "buy" && exec.status === "success"
    );
    const sellExecutions = (executions as ExecutionRecord[]).filter(
      (exec: ExecutionRecord) =>
        exec.action === "sell" && exec.status === "success"
    );

    const totalBuyVolume = buyExecutions.reduce(
      (sum: number, exec: ExecutionRecord) => sum + (exec.totalCost || 0),
      0
    );
    const totalSellVolume = sellExecutions.reduce(
      (sum: number, exec: ExecutionRecord) => sum + (exec.totalCost || 0),
      0
    );
    const totalFees = (executions as ExecutionRecord[]).reduce(
      (sum: number, exec: ExecutionRecord) => sum + (exec.fees || 0),
      0
    );

    const avgExecutionLatency = (executions as ExecutionRecord[])
      .filter((exec: ExecutionRecord) => exec.executionLatencyMs)
      .reduce(
        (
          sum: number,
          exec: ExecutionRecord,
          _: number,
          arr: ExecutionRecord[]
        ) => sum + (exec.executionLatencyMs || 0) / arr.length,
        0
      );

    const avgSlippage = (executions as ExecutionRecord[])
      .filter((exec: ExecutionRecord) => exec.slippagePercent)
      .reduce(
        (
          sum: number,
          exec: ExecutionRecord,
          _: number,
          arr: ExecutionRecord[]
        ) => sum + (exec.slippagePercent || 0) / arr.length,
        0
      );

    // Group executions by symbol for analysis
    interface SymbolStat {
      symbol: string;
      totalExecutions: number;
      successfulExecutions: number;
      totalVolume: number;
      avgPrice: number;
      lastExecution: number;
    }
    
    const symbolStats = (executions as ExecutionRecord[]).reduce(
      (acc: Record<string, SymbolStat>, exec: ExecutionRecord) => {
        const symbol = exec.symbolName;
        if (!symbol) return acc; // Skip executions without symbol names
        if (!acc[symbol]) {
          acc[symbol] = {
            symbol,
            totalExecutions: 0,
            successfulExecutions: 0,
            totalVolume: 0,
            avgPrice: 0,
            lastExecution: 0,
          };
        }

        acc[symbol].totalExecutions++;
        if (exec.status === "success") {
          acc[symbol].successfulExecutions++;
          acc[symbol].totalVolume += exec.totalCost || 0;
        }
        const executedAtTimestamp = typeof exec.executedAt === 'number' ? exec.executedAt : 0;
        acc[symbol].lastExecution = Math.max(
          acc[symbol].lastExecution,
          executedAtTimestamp
        );

        return acc;
      },
      {} as Record<string, SymbolStat>
    );

    const response = {
      executions: (executions as ExecutionRecord[]).map(
        (exec: ExecutionRecord) => ({
          ...exec,
          // Add human-readable timestamps
          executedAtFormatted: exec.executedAt
            ? new Date(exec.executedAt * 1000).toISOString()
            : null,
          requestedAtFormatted: exec.requestedAt
            ? new Date(exec.requestedAt * 1000).toISOString()
            : null,
          // Calculate profit/loss for matched buy/sell pairs
          profitLoss: null, // This would require more complex matching logic
        })
      ),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + executions.length < totalCount,
      },
      summary: {
        totalExecutions: executions.length,
        successfulExecutions: (executions as ExecutionRecord[]).filter(
          (exec: ExecutionRecord) => exec.status === "success"
        ).length,
        failedExecutions: (executions as ExecutionRecord[]).filter(
          (exec: ExecutionRecord) => exec.status === "failed"
        ).length,
        totalBuyVolume,
        totalSellVolume,
        totalFees,
        avgExecutionLatencyMs: Math.round(avgExecutionLatency),
        avgSlippagePercent: Number(avgSlippage.toFixed(3)),
        successRate:
          executions.length > 0
            ? ((executions as ExecutionRecord[]).filter(
                (exec: ExecutionRecord) => exec.status === "success"
              ).length /
                executions.length) *
              100
            : 0,
      },
      symbolStats: Object.values(symbolStats),
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("❌ Error fetching execution history:", { error: error });

    // Return empty data with success status instead of 500 error
    const fallbackResponse = {
      executions: [],
      pagination: {
        total: 0,
        limit: 50,
        offset: 0,
        hasMore: false,
      },
      summary: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalBuyVolume: 0,
        totalSellVolume: 0,
        totalFees: 0,
        avgExecutionLatencyMs: 0,
        avgSlippagePercent: 0,
        successRate: 0,
      },
      symbolStats: [],
      error:
        error instanceof Error
          ? error.message
          : "Service temporarily unavailable",
      fallback: true,
    };

    return NextResponse.json({
      success: true,
      data: fallbackResponse,
    });
  }
}
