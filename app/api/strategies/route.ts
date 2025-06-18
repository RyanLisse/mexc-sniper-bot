import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { multiPhaseTradingService, TradingStrategyConfigSchema, PREDEFINED_STRATEGIES } from "../../../src/services/multi-phase-trading-service";
import { MultiPhaseStrategyBuilder } from "../../../src/services/multi-phase-strategy-builder";
import { rateLimiter } from "../../../src/lib/rate-limiter";
import { apiResponse } from "../../../src/lib/api-response";

// ===========================================
// TRADING STRATEGIES API ENDPOINTS
// ===========================================

const CreateStrategySchema = z.object({
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(20),
  vcoinId: z.string().optional(),
  entryPrice: z.number().positive(),
  positionSize: z.number().positive(),
  positionSizeUsdt: z.number().positive(),
  stopLossPercent: z.number().min(0).max(50),
  description: z.string().optional(),
  strategyType: z.enum(["predefined", "custom"]),
  
  // For predefined strategies
  templateId: z.string().optional(),
  
  // For custom strategies
  customLevels: z.array(z.object({
    percentage: z.number().min(0),
    multiplier: z.number().min(1),
    sellPercentage: z.number().min(0).max(100),
  })).optional(),
});

const QuerySchema = z.object({
  status: z.string().optional(),
  symbol: z.string().optional(),
  limit: z.string().transform(val => val ? parseInt(val) : undefined).optional(),
  page: z.string().transform(val => val ? parseInt(val) : 1).optional(),
});

// GET /api/strategies - Get user's trading strategies
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiter.checkRateLimit(
      rateLimiter.getClientIP(request), 
      "strategies_read"
    );
    if (!rateLimitResult.success) {
      return apiResponse.error("Rate limit exceeded", 429);
    }

    // Authentication
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    
    if (!user?.id) {
      return apiResponse.error("Unauthorized", 401);
    }

    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const query = QuerySchema.parse(queryParams);

    // Get strategies
    const strategies = await multiPhaseTradingService.getUserStrategies(user.id, {
      status: query.status,
      symbol: query.symbol,
      limit: query.limit,
    });

    // Calculate summary statistics
    const totalStrategies = strategies.length;
    const activeStrategies = strategies.filter(s => s.status === "active").length;
    const totalPnl = strategies.reduce((sum, s) => sum + (s.totalPnl || 0), 0);
    const totalInvested = strategies.reduce((sum, s) => sum + s.positionSizeUsdt, 0);

    return apiResponse.success({
      strategies,
      summary: {
        total: totalStrategies,
        active: activeStrategies,
        totalPnl,
        totalInvested,
        avgPnlPercent: totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0,
      },
      pagination: {
        page: query.page || 1,
        limit: query.limit || strategies.length,
        total: totalStrategies,
      },
    });

  } catch (error) {
    console.error("Error fetching strategies:", error);
    return apiResponse.error("Failed to fetch strategies", 500);
  }
}

// POST /api/strategies - Create a new trading strategy
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiter.checkRateLimit(
      rateLimiter.getClientIP(request), 
      "strategies_create"
    );
    if (!rateLimitResult.success) {
      return apiResponse.error("Rate limit exceeded", 429);
    }

    // Authentication
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    
    if (!user?.id) {
      return apiResponse.error("Unauthorized", 401);
    }

    // Parse request body
    const body = await request.json();
    const data = CreateStrategySchema.parse(body);

    let strategyConfig;

    if (data.strategyType === "predefined") {
      // Use predefined strategy
      if (!data.templateId || !PREDEFINED_STRATEGIES[data.templateId]) {
        return apiResponse.error("Invalid template ID", 400);
      }
      strategyConfig = PREDEFINED_STRATEGIES[data.templateId];
    } else {
      // Use custom strategy
      if (!data.customLevels || data.customLevels.length === 0) {
        return apiResponse.error("Custom levels are required for custom strategies", 400);
      }

      strategyConfig = {
        id: `custom-${Date.now()}`,
        name: data.name,
        description: data.description || "",
        levels: data.customLevels,
      };

      // Validate custom strategy
      try {
        TradingStrategyConfigSchema.parse(strategyConfig);
      } catch (validationError) {
        return apiResponse.error("Invalid strategy configuration", 400);
      }
    }

    // Create strategy
    const strategy = await multiPhaseTradingService.createTradingStrategy({
      userId: user.id,
      name: data.name,
      symbol: data.symbol,
      vcoinId: data.vcoinId,
      entryPrice: data.entryPrice,
      positionSize: data.positionSize,
      positionSizeUsdt: data.positionSizeUsdt,
      strategyConfig,
      stopLossPercent: data.stopLossPercent,
      description: data.description,
    });

    return apiResponse.success(
      { strategy },
      { message: "Strategy created successfully" },
      201
    );

  } catch (error) {
    console.error("Error creating strategy:", error);
    
    if (error instanceof z.ZodError) {
      return apiResponse.error("Invalid request data", 400, error.errors);
    }

    return apiResponse.error("Failed to create strategy", 500);
  }
}