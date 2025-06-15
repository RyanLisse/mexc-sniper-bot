import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { multiPhaseTradingService, PREDEFINED_STRATEGIES } from "@/src/services/multi-phase-trading-service";
import { MultiPhaseStrategyBuilder, StrategyPatterns, createQuickStrategies } from "@/src/services/multi-phase-strategy-builder";
import { rateLimiter } from "@/src/lib/rate-limiter";
import { ApiResponse } from "@/src/lib/api-response";

// ===========================================
// STRATEGY TEMPLATES API
// ===========================================

const BuilderRequestSchema = z.object({
  type: z.enum(["balanced", "conservative", "aggressive", "scalping", "diamond", "fibonacci", "momentum", "risk_adjusted"]),
  params: z.object({
    // For balanced strategy
    phases: z.number().min(2).max(10).optional(),
    maxTarget: z.number().min(10).max(5000).optional(),
    totalSellPercent: z.number().min(10).max(100).optional(),
    
    // For conservative strategy
    earlyExitPercent: z.number().min(30).max(90).optional(),
    
    // For fibonacci strategy
    baseTarget: z.number().min(10).max(500).optional(),
    
    // For momentum strategy
    volatility: z.enum(["low", "medium", "high"]).optional(),
    
    // For risk adjusted strategy
    positionSizePercent: z.number().min(1).max(100).optional(),
    
    // General parameters
    id: z.string().min(1).max(50).optional(),
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
  }).optional(),
});

// GET /api/strategies/templates - Get all strategy templates
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiter.check(request, "templates_read", 100, 60);
    if (!rateLimitResult.success) {
      return ApiResponse.error("Rate limit exceeded", 429);
    }

    // Get predefined strategies
    const predefinedStrategies = Object.values(PREDEFINED_STRATEGIES).map(strategy => ({
      ...strategy,
      type: "predefined",
      riskLevel: determineRiskLevel(strategy.levels),
      category: getCategoryFromId(strategy.id),
      estimatedDuration: getEstimatedDuration(strategy.levels),
      suitableFor: getSuitableFor(strategy.levels),
    }));

    // Get database templates
    const dbTemplates = await multiPhaseTradingService.getStrategyTemplates();

    // Get quick strategy builders
    const quickStrategies = [
      {
        id: "quick-conservative",
        name: "Quick Conservative",
        description: "Fast setup conservative strategy with early profit-taking",
        type: "builder",
        builderType: "conservative",
        riskLevel: "low",
        category: "Quick Start",
        estimatedDuration: "1-7 days",
        suitableFor: ["beginners", "risk-averse"],
      },
      {
        id: "quick-balanced",
        name: "Quick Balanced",
        description: "Balanced approach with moderate targets",
        type: "builder",
        builderType: "balanced",
        riskLevel: "medium",
        category: "Quick Start",
        estimatedDuration: "3-14 days",
        suitableFor: ["intermediate", "balanced-risk"],
      },
      {
        id: "quick-aggressive",
        name: "Quick Aggressive",
        description: "High targets for maximum potential gains",
        type: "builder",
        builderType: "aggressive",
        riskLevel: "high",
        category: "Quick Start",
        estimatedDuration: "7-30 days",
        suitableFor: ["experienced", "high-risk"],
      },
    ];

    // Advanced strategy patterns
    const advancedPatterns = [
      {
        id: "fibonacci-pattern",
        name: "Fibonacci Progression",
        description: "Mathematical fibonacci sequence for target progression",
        type: "pattern",
        patternType: "fibonacci",
        riskLevel: "medium",
        category: "Advanced",
        estimatedDuration: "5-21 days",
        suitableFor: ["technical-analysis", "mathematical-approach"],
      },
      {
        id: "momentum-pattern",
        name: "Momentum Adaptive",
        description: "Adapts to market volatility conditions",
        type: "pattern",
        patternType: "momentum",
        riskLevel: "variable",
        category: "Advanced",
        estimatedDuration: "variable",
        suitableFor: ["experienced", "market-adaptive"],
      },
      {
        id: "risk-adjusted-pattern",
        name: "Risk-Adjusted Sizing",
        description: "Adjusts strategy based on position size risk",
        type: "pattern",
        patternType: "risk_adjusted",
        riskLevel: "variable",
        category: "Advanced",
        estimatedDuration: "variable",
        suitableFor: ["risk-management", "portfolio-optimization"],
      },
    ];

    return ApiResponse.success({
      predefined: predefinedStrategies,
      database: dbTemplates,
      quickStart: quickStrategies,
      advanced: advancedPatterns,
      categories: [
        {
          name: "Predefined",
          description: "Battle-tested strategies with proven track records",
          count: predefinedStrategies.length,
        },
        {
          name: "Quick Start",
          description: "Easy setup strategies for fast deployment",
          count: quickStrategies.length,
        },
        {
          name: "Advanced",
          description: "Sophisticated patterns for experienced traders",
          count: advancedPatterns.length,
        },
        {
          name: "Custom",
          description: "User-created templates",
          count: dbTemplates.length,
        },
      ],
    });

  } catch (error) {
    console.error("Error fetching templates:", error);
    return ApiResponse.error("Failed to fetch templates", 500);
  }
}

// POST /api/strategies/templates/build - Build a strategy using the builder
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimiter.check(request, "templates_build", 30, 60);
    if (!rateLimitResult.success) {
      return ApiResponse.error("Rate limit exceeded", 429);
    }

    // Authentication
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    
    if (!user?.id) {
      return ApiResponse.error("Unauthorized", 401);
    }

    // Parse request body
    const body = await request.json();
    const data = BuilderRequestSchema.parse(body);

    let builder: MultiPhaseStrategyBuilder;
    const params = data.params || {};
    const strategyId = params.id || `${data.type}-${Date.now()}`;
    const strategyName = params.name || `${data.type.charAt(0).toUpperCase() + data.type.slice(1)} Strategy`;

    // Create builder based on type
    switch (data.type) {
      case "balanced":
        builder = new MultiPhaseStrategyBuilder(strategyId, strategyName)
          .createBalancedStrategy(
            params.phases || 4,
            params.maxTarget || 100,
            params.totalSellPercent || 80
          );
        break;

      case "conservative":
        builder = new MultiPhaseStrategyBuilder(strategyId, strategyName)
          .createConservativeStrategy(
            params.earlyExitPercent || 60,
            params.maxTarget || 100
          );
        break;

      case "aggressive":
        builder = new MultiPhaseStrategyBuilder(strategyId, strategyName)
          .createAggressiveStrategy(
            params.maxTarget ? params.maxTarget / 5 : 100,
            params.maxTarget || 500
          );
        break;

      case "scalping":
        builder = new MultiPhaseStrategyBuilder(strategyId, strategyName)
          .createScalpingStrategy(params.maxTarget || 20);
        break;

      case "diamond":
        builder = new MultiPhaseStrategyBuilder(strategyId, strategyName)
          .createDiamondHandsStrategy();
        break;

      case "fibonacci":
        builder = StrategyPatterns.fibonacci(
          params.baseTarget || 25,
          params.phases || 5
        );
        builder = new MultiPhaseStrategyBuilder(strategyId, strategyName)
          .addPhases(builder.preview().levels.map(l => [l.percentage, l.sellPercentage] as [number, number]));
        break;

      case "momentum":
        builder = StrategyPatterns.momentum(params.volatility || "medium");
        builder = new MultiPhaseStrategyBuilder(strategyId, strategyName)
          .addPhases(builder.preview().levels.map(l => [l.percentage, l.sellPercentage] as [number, number]));
        break;

      case "risk_adjusted":
        builder = StrategyPatterns.riskAdjusted(params.positionSizePercent || 10);
        builder = new MultiPhaseStrategyBuilder(strategyId, strategyName)
          .addPhases(builder.preview().levels.map(l => [l.percentage, l.sellPercentage] as [number, number]));
        break;

      default:
        return ApiResponse.error("Invalid strategy type", 400);
    }

    // Add description if provided
    if (params.description) {
      builder.withDescription(params.description);
    }

    // Get preview before building
    const preview = builder.preview();

    // Build strategy if valid
    if (preview.validation.isValid) {
      const strategy = builder.build();
      
      return ApiResponse.success({
        strategy,
        preview,
        builderType: data.type,
        isValid: true,
      }, "Strategy built successfully");
    } else {
      return ApiResponse.success({
        preview,
        builderType: data.type,
        isValid: false,
      }, "Strategy preview generated with validation errors");
    }

  } catch (error) {
    console.error("Error building strategy:", error);
    
    if (error instanceof z.ZodError) {
      return ApiResponse.error("Invalid request data", 400, {
        details: error.errors
      });
    }

    return ApiResponse.error("Failed to build strategy", 500);
  }
}

// Helper functions
function determineRiskLevel(levels: any[]): "low" | "medium" | "high" {
  const avgTarget = levels.reduce((sum, level) => sum + level.percentage, 0) / levels.length;
  
  if (avgTarget < 30) return "low";
  if (avgTarget < 100) return "medium";
  return "high";
}

function getCategoryFromId(id: string): string {
  const categories: Record<string, string> = {
    "conservative": "Safety First",
    "normal": "Balanced",
    "aggressive": "High Growth",
    "scalping": "Quick Profits",
    "diamond": "Long Term",
  };
  
  return categories[id] || "General";
}

function getEstimatedDuration(levels: any[]): string {
  const maxTarget = Math.max(...levels.map(l => l.percentage));
  
  if (maxTarget < 25) return "1-3 days";
  if (maxTarget < 100) return "3-14 days";
  if (maxTarget < 300) return "1-4 weeks";
  return "1-3 months";
}

function getSuitableFor(levels: any[]): string[] {
  const avgTarget = levels.reduce((sum, level) => sum + level.percentage, 0) / levels.length;
  const maxTarget = Math.max(...levels.map(l => l.percentage));
  
  const suitability: string[] = [];
  
  if (avgTarget < 30) {
    suitability.push("beginners", "risk-averse", "capital-preservation");
  } else if (avgTarget < 100) {
    suitability.push("intermediate", "balanced-risk", "steady-growth");
  } else {
    suitability.push("experienced", "high-risk", "growth-focused");
  }
  
  if (maxTarget > 500) {
    suitability.push("diamond-hands", "long-term");
  }
  
  if (levels.length > 5) {
    suitability.push("active-management");
  }
  
  return suitability;
}