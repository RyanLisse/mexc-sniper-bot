import { NextRequest, NextResponse } from "next/server";
import { createApiResponse } from "../../../../src/lib/api-response";
import { apiAuthWrapper } from "../../../../src/lib/api-auth";

// ======================
// Types
// ======================

interface Phase3Configuration {
  aiIntelligence: {
    enabled: boolean;
    cohereEnabled: boolean;
    perplexityEnabled: boolean;
    openaiEnabled: boolean;
    confidenceThreshold: number;
    maxAIBoost: number;
  };
  patternDetection: {
    advanceDetectionEnabled: boolean;
    targetAdvanceHours: number;
    activityEnhancementEnabled: boolean;
    confidenceThreshold: number;
  };
  cacheWarming: {
    enabled: boolean;
    autoWarmingEnabled: boolean;
    warmingInterval: number;
    strategies: {
      mexcSymbols: boolean;
      patternData: boolean;
      activityData: boolean;
      calendarData: boolean;
    };
  };
  performance: {
    monitoringEnabled: boolean;
    alertsEnabled: boolean;
    metricsRetentionDays: number;
    performanceThresholds: {
      maxResponseTime: number;
      minHitRate: number;
      maxMemoryUsage: number;
    };
  };
}

// ======================
// Default Configuration
// ======================

const defaultConfiguration: Phase3Configuration = {
  aiIntelligence: {
    enabled: true,
    cohereEnabled: !!process.env.COHERE_API_KEY,
    perplexityEnabled: !!process.env.PERPLEXITY_API_KEY,
    openaiEnabled: !!process.env.OPENAI_API_KEY,
    confidenceThreshold: 70,
    maxAIBoost: 20,
  },
  patternDetection: {
    advanceDetectionEnabled: true,
    targetAdvanceHours: 3.5,
    activityEnhancementEnabled: true,
    confidenceThreshold: 70,
  },
  cacheWarming: {
    enabled: true,
    autoWarmingEnabled: true,
    warmingInterval: 30,
    strategies: {
      mexcSymbols: true,
      patternData: true,
      activityData: true,
      calendarData: true,
    },
  },
  performance: {
    monitoringEnabled: true,
    alertsEnabled: true,
    metricsRetentionDays: 7,
    performanceThresholds: {
      maxResponseTime: 100,
      minHitRate: 70,
      maxMemoryUsage: 500,
    },
  },
};

// ======================
// GET - Retrieve Configuration
// ======================

export async function GET(request: NextRequest) {
  try {
    // In a real implementation, this would fetch from database
    // For now, return default configuration with environment-based overrides
    const configuration = await getPhase3Configuration();

    return createApiResponse({
      success: true,
      data: {
        configuration,
        lastUpdated: new Date().toISOString(),
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
      },
    });
  } catch (error) {
    console.error("[Phase3 Config] Error getting configuration:", { error: error });
    return createApiResponse(
      {
        success: false,
        error: "Failed to get Phase 3 configuration",
        details: { error: error instanceof Error ? error.message : "Unknown error" },
      },
      500
    );
  }
}

// ======================
// POST - Update Configuration
// ======================

export const POST = apiAuthWrapper(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { configuration } = body;

    if (!configuration) {
      return createApiResponse(
        {
          success: false,
          error: "Configuration data is required",
        },
        400
      );
    }

    // Validate configuration structure
    const validationResult = validateConfiguration(configuration);
    if (!validationResult.valid) {
      return createApiResponse(
        {
          success: false,
          error: "Invalid configuration",
          details: { errors: validationResult.errors },
        },
        400
      );
    }

    // In a real implementation, this would save to database
    // For now, we'll simulate saving and return success
    const savedConfiguration = await savePhase3Configuration(configuration);

    return createApiResponse({
      success: true,
      data: {
        configuration: savedConfiguration,
        message: "Phase 3 configuration updated successfully",
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[Phase3 Config] Error updating configuration:", { error: error });
    return createApiResponse(
      {
        success: false,
        error: "Failed to update Phase 3 configuration",
        details: { error: error instanceof Error ? error.message : "Unknown error" },
      },
      500
    );
  }
});

// ======================
// Helper Functions
// ======================

async function getPhase3Configuration(): Promise<Phase3Configuration> {
  // In a real implementation, this would fetch from database
  // For now, return default configuration with environment checks
  return {
    ...defaultConfiguration,
    aiIntelligence: {
      ...defaultConfiguration.aiIntelligence,
      cohereEnabled: !!process.env.COHERE_API_KEY,
      perplexityEnabled: !!process.env.PERPLEXITY_API_KEY,
      openaiEnabled: !!process.env.OPENAI_API_KEY,
    },
  };
}

async function savePhase3Configuration(configuration: Phase3Configuration): Promise<Phase3Configuration> {
  // In a real implementation, this would save to database
  // For now, just return the configuration as if it was saved
  console.info("[Phase3 Config] Configuration would be saved:", { context: configuration });
  return configuration;
}

function validateConfiguration(config: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  // Validate AI Intelligence section
  if (!config.aiIntelligence) {
    errors.push("aiIntelligence section is required");
  } else {
    if (typeof config.aiIntelligence.enabled !== "boolean") {
      errors.push("aiIntelligence.enabled must be a boolean");
    }
    if (typeof config.aiIntelligence.confidenceThreshold !== "number" ||
        config.aiIntelligence.confidenceThreshold < 0 ||
        config.aiIntelligence.confidenceThreshold > 100) {
      errors.push("aiIntelligence.confidenceThreshold must be a number between 0 and 100");
    }
  }

  // Validate Pattern Detection section
  if (!config.patternDetection) {
    errors.push("patternDetection section is required");
  } else {
    if (typeof config.patternDetection.targetAdvanceHours !== "number" ||
        config.patternDetection.targetAdvanceHours < 0) {
      errors.push("patternDetection.targetAdvanceHours must be a positive number");
    }
  }

  // Validate Cache Warming section
  if (!config.cacheWarming) {
    errors.push("cacheWarming section is required");
  } else {
    if (typeof config.cacheWarming.enabled !== "boolean") {
      errors.push("cacheWarming.enabled must be a boolean");
    }
    if (!config.cacheWarming.strategies || typeof config.cacheWarming.strategies !== "object") {
      errors.push("cacheWarming.strategies must be an object");
    }
  }

  // Validate Performance section
  if (!config.performance) {
    errors.push("performance section is required");
  } else {
    if (!config.performance.performanceThresholds) {
      errors.push("performance.performanceThresholds is required");
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
