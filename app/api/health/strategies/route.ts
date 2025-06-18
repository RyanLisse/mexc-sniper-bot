import { NextRequest, NextResponse } from "next/server";
import { multiPhaseTradingService } from "../../../../src/services/multi-phase-trading-service";
import { db } from "../../../../src/db";
import { strategyTemplates, tradingStrategies } from "../../../../src/db/schemas/strategies";
import { count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Test database connectivity for strategy tables
    const [templateCount, strategyCount] = await Promise.all([
      db.select({ count: count() }).from(strategyTemplates),
      db.select({ count: count() }).from(tradingStrategies),
    ]);

    // Test service functionality
    const predefinedStrategies = multiPhaseTradingService.getPredefinedStrategies();
    
    // Test strategy validation
    const testStrategy = predefinedStrategies.normal;
    const isValid = multiPhaseTradingService.validateStrategy(testStrategy);

    const responseTime = Date.now() - startTime;
    
    return NextResponse.json({
      status: "healthy",
      service: "Multi-Phase Trading Strategy System",
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      details: {
        database: {
          strategyTemplates: templateCount[0].count,
          tradingStrategies: strategyCount[0].count,
        },
        predefinedStrategies: {
          count: Object.keys(predefinedStrategies).length,
          available: Object.keys(predefinedStrategies),
        },
        validation: {
          testPassed: isValid,
        },
        capabilities: [
          "Multi-phase strategy creation",
          "AI-powered strategy optimization", 
          "Real-time execution tracking",
          "Performance analytics",
          "Custom strategy builder",
        ],
      },
    });
  } catch (error) {
    console.error("Strategy system health check failed:", error);
    
    return NextResponse.json(
      {
        status: "unhealthy",
        service: "Multi-Phase Trading Strategy System",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
        details: {
          issue: "Database connection or service initialization failed",
          recommendation: "Check database connectivity and strategy service configuration",
        },
      },
      { status: 500 }
    );
  }
}