import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { executionHistory, snipeTargets } from "@/src/db/schema";

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
      conditions.push(gte(executionHistory.executedAt, new Date(parseInt(fromDate) * 1000)));
    }

    if (toDate) {
      conditions.push(lte(executionHistory.executedAt, new Date(parseInt(toDate) * 1000)));
    }

    // Get execution history with pagination
    const executions = await db.select()
    .from(executionHistory)
    .where(and(...conditions))
    .orderBy(desc(executionHistory.executedAt))
    .limit(limit)
    .offset(offset);

    // For simplicity, use the length of returned results
    // In a production system, you might want to implement proper pagination counting
    const totalCount = executions.length;

    // Calculate summary statistics
    const buyExecutions = executions.filter((exec: any) => exec.action === "buy" && exec.status === "success");
    const sellExecutions = executions.filter((exec: any) => exec.action === "sell" && exec.status === "success");
    
    const totalBuyVolume = buyExecutions.reduce((sum: number, exec: any) => sum + (exec.totalCost || 0), 0);
    const totalSellVolume = sellExecutions.reduce((sum: number, exec: any) => sum + (exec.totalCost || 0), 0);
    const totalFees = executions.reduce((sum: number, exec: any) => sum + (exec.fees || 0), 0);
    
    const avgExecutionLatency = executions
      .filter((exec: any) => exec.executionLatencyMs)
      .reduce((sum: number, exec: any, _: number, arr: any[]) => sum + (exec.executionLatencyMs || 0) / arr.length, 0);

    const avgSlippage = executions
      .filter((exec: any) => exec.slippagePercent)
      .reduce((sum: number, exec: any, _: number, arr: any[]) => sum + (exec.slippagePercent || 0) / arr.length, 0);

    // Group executions by symbol for analysis
    const symbolStats = executions.reduce((acc: any, exec: any) => {
      const symbol = exec.symbolName;
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
      const executedAtTimestamp = exec.executedAt instanceof Date ? exec.executedAt.getTime() / 1000 : (exec.executedAt || 0);
      acc[symbol].lastExecution = Math.max(acc[symbol].lastExecution, executedAtTimestamp);
      
      return acc;
    }, {} as Record<string, any>);

    const response = {
      executions: executions.map((exec: any) => ({
        ...exec,
        // Add human-readable timestamps
        executedAtFormatted: exec.executedAt ? (exec.executedAt instanceof Date ? exec.executedAt.toISOString() : new Date((exec.executedAt as number) * 1000).toISOString()) : null,
        requestedAtFormatted: exec.requestedAt ? (exec.requestedAt instanceof Date ? exec.requestedAt.toISOString() : new Date((exec.requestedAt as number) * 1000).toISOString()) : null,
        // Calculate profit/loss for matched buy/sell pairs
        profitLoss: null, // This would require more complex matching logic
      })),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: (offset + executions.length) < totalCount,
      },
      summary: {
        totalExecutions: executions.length,
        successfulExecutions: executions.filter((exec: any) => exec.status === "success").length,
        failedExecutions: executions.filter((exec: any) => exec.status === "failed").length,
        totalBuyVolume,
        totalSellVolume,
        totalFees,
        avgExecutionLatencyMs: Math.round(avgExecutionLatency),
        avgSlippagePercent: Number(avgSlippage.toFixed(3)),
        successRate: executions.length > 0 ? 
          (executions.filter((exec: any) => exec.status === "success").length / executions.length) * 100 : 0,
      },
      symbolStats: Object.values(symbolStats),
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("❌ Error fetching execution history:", { error: error });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch execution history",
      },
      { status: 500 }
    );
  }
}