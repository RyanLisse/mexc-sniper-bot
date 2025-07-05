/**
 * Environment Health Check API Route
 *
 * Comprehensive environment variable validation and health reporting.
 * Provides detailed analysis of missing variables, invalid values, and
 * recommendations for proper configuration.
 */

import type { NextRequest } from "next/server";
import { apiResponse } from "@/src/lib/api-response";
import { environmentValidation } from "@/src/services/risk/enhanced-environment-validation";

/**
 * GET /api/health/environment
 * Comprehensive environment variable health check
 */
export async function GET(_request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get comprehensive environment validation with error handling
    let validation: any;
    let healthSummary: any;
    let missingByCategory: any;

    try {
      validation = environmentValidation.validateEnvironment();
      healthSummary = environmentValidation.getHealthSummary();
      missingByCategory = environmentValidation.getMissingByCategory();
    } catch (validationError) {
      console.warn(
        "[Environment Health] Validation service failed, using fallback:",
        {
          error:
            validationError instanceof Error
              ? validationError.message
              : String(validationError),
        }
      );

      // Fallback validation response
      validation = {
        isValid: false,
        status: "warning",
        summary: { total: 0, configured: 0, missing: 0, invalid: 0 },
        results: [],
        recommendations: [
          "Environment validation service temporarily unavailable",
        ],
        developmentDefaults: {},
      };

      healthSummary = {
        status: "warning",
        score: 50,
        issues: ["Environment validation service error"],
        recommendedActions: [
          "Check environment validation service configuration",
        ],
      };

      missingByCategory = {};
    }

    const responseTime = Date.now() - startTime;

    // Always return 200 for environment checks in production to prevent frontend errors
    // Use response data to indicate actual health status
    const statusCode = 200;

    const responseData = {
      status: healthSummary && typeof healthSummary === 'object' && 'status' in healthSummary ? healthSummary.status : 'unknown',
      timestamp: new Date().toISOString(),
      responseTime,
      environment: process.env.NODE_ENV || "development",
      validation: {
        isValid: validation.isValid,
        status: validation.status,
        summary: validation.summary,
        health: {
          status: healthSummary.status,
          configured: healthSummary.configured,
          missing: healthSummary.missing,
          invalid: healthSummary.invalid,
          total: healthSummary.total,
          criticalMissing: healthSummary.criticalMissing,
          recommendations: healthSummary.recommendations,
        },
      },
      categories: {
        core: {
          total: validation.results.filter((r: any) => r.category === "core").length,
          configured: validation.results.filter(
            (r: any) =>
              r.category === "core" &&
              (r.status === "configured" || r.status === "default")
          ).length,
          missing: validation.results.filter(
            (r: any) => r.category === "core" && r.status === "missing"
          ).length,
        },
        api: {
          total: validation.results.filter((r: any) => r.category === "api").length,
          configured: validation.results.filter(
            (r: any) =>
              r.category === "api" &&
              (r.status === "configured" || r.status === "default")
          ).length,
          missing: validation.results.filter(
            (r: any) => r.category === "api" && r.status === "missing"
          ).length,
        },
        database: {
          total: validation.results.filter((r: any) => r.category === "database")
            .length,
          configured: validation.results.filter(
            (r: any) =>
              r.category === "database" &&
              (r.status === "configured" || r.status === "default")
          ).length,
          missing: validation.results.filter(
            (r: any) => r.category === "database" && r.status === "missing"
          ).length,
        },
        cache: {
          total: validation.results.filter((r: any) => r.category === "cache")
            .length,
          configured: validation.results.filter(
            (r: any) =>
              r.category === "cache" &&
              (r.status === "configured" || r.status === "default")
          ).length,
          missing: validation.results.filter(
            (r: any) => r.category === "cache" && r.status === "missing"
          ).length,
        },
        monitoring: {
          total: validation.results.filter((r: any) => r.category === "monitoring")
            .length,
          configured: validation.results.filter(
            (r: any) =>
              r.category === "monitoring" &&
              (r.status === "configured" || r.status === "default")
          ).length,
          missing: validation.results.filter(
            (r: any) => r.category === "monitoring" && r.status === "missing"
          ).length,
        },
        security: {
          total: validation.results.filter((r: any) => r.category === "security")
            .length,
          configured: validation.results.filter(
            (r: any) =>
              r.category === "security" &&
              (r.status === "configured" || r.status === "default")
          ).length,
          missing: validation.results.filter(
            (r: any) => r.category === "security" && r.status === "missing"
          ).length,
        },
      },
      missingByCategory: missingByCategory,
      recommendations: validation.recommendations,
    };

    const message =
      healthSummary.status === "healthy"
        ? "Environment configuration is healthy"
        : healthSummary.status === "warning"
          ? "Environment configuration has minor issues"
          : "Environment configuration has critical issues";

    return statusCode === 200
      ? apiResponse.success(responseData, { message })
      : apiResponse.error(message, statusCode, responseData);
  } catch (error) {
    const responseTime = Date.now() - startTime;

    console.error("[Environment Health] Environment health check failed:", {
      error,
    });

    return apiResponse.error("Environment health check failed", 500, {
      status: "error",
      responseTime,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * POST /api/health/environment
 * Generate development environment template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action } = body;

    if (action === "generate_template") {
      const template = environmentValidation.generateDevelopmentTemplate();
      const validation = environmentValidation.validateEnvironment();

      return apiResponse.success(
        {
          template,
          filename: ".env.development.template",
          missingCount: validation.summary.missing,
          instructions: [
            "1. Copy the template to .env.local",
            "2. Fill in the required values marked as REQUIRED_VALUE",
            "3. Customize optional values as needed",
            "4. Never commit .env.local to version control",
            "5. Run the health check again to verify configuration",
          ],
        },
        {
          message: "Development environment template generated successfully",
        }
      );
    }

    if (action === "validate_specific") {
      const { variables } = body;
      if (!Array.isArray(variables)) {
        return apiResponse.error(
          "Variables array required for specific validation",
          400
        );
      }

      const validation = environmentValidation.validateEnvironment();
      const specificResults = validation.results.filter((r) =>
        variables.includes(r.key)
      );

      return apiResponse.success(
        {
          results: specificResults,
          summary: {
            total: specificResults.length,
            configured: specificResults.filter((r) => r.status === "configured")
              .length,
            missing: specificResults.filter((r) => r.status === "missing")
              .length,
            invalid: specificResults.filter((r) => r.status === "invalid")
              .length,
          },
        },
        {
          message: "Specific variable validation completed",
        }
      );
    }

    return apiResponse.error(
      'Invalid action. Use "generate_template" or "validate_specific"',
      400
    );
  } catch (error) {
    console.error("[Environment Health] POST request failed:", { error });

    return apiResponse.error("Environment health action failed", 500, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
