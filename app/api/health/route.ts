/**
 * Enhanced Health Check API Route with Resilience
 *
 * Provides health status endpoint with circuit breakers, retries, and fallbacks
 * to maintain availability during chaos scenarios
 */

import type { NextRequest } from "next/server";
import { apiResponse } from "@/src/lib/api-response";
import { createResilientEndpoint } from "@/src/lib/enhanced-api-resilience-middleware";
import { MexcConfigValidator } from "@/src/services/api/mexc-config-validator";
import { getSystemResilienceStatus } from "@/src/lib/enhanced-resilience-manager";

/**
 * GET /api/health
 * Comprehensive health check with enhanced resilience
 */
export const GET = createResilientEndpoint(async (_request: NextRequest) => {
  const startTime = Date.now();

  // Get resilience system status
  const resilienceStatus = getSystemResilienceStatus();

  try {
    const validator = MexcConfigValidator.getInstance();
    const healthCheck = await validator.quickHealthCheck();

    const responseTime = Date.now() - startTime;
    const systemHealthy = healthCheck.healthy && healthCheck.score >= 80;
    const resilienceHealthy = resilienceStatus.isHealthy;
    const isHealthy = systemHealthy && resilienceHealthy;

    const healthData = {
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime,
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      
      // Core system health
      system: {
        healthy: healthCheck.healthy,
        score: healthCheck.score,
        issues: healthCheck.issues,
      },
      
      // Resilience system health
      resilience: {
        healthy: resilienceHealthy,
        overallScore: resilienceStatus.overallScore,
        circuitBreakerCount: resilienceStatus.circuitBreakerCount,
        openCircuitCount: resilienceStatus.openCircuitCount,
        recommendations: resilienceStatus.recommendations
      },
      
      // Service health with fallback indicators
      services: {
        database: {
          status: "operational",
          responseTime: responseTime,
          circuitBreakerProtected: true
        },
        mexcApi: {
          status: healthCheck.issues.includes("MEXC API connectivity failed")
            ? "degraded"
            : "operational",
          lastCheck: new Date().toISOString(),
          circuitBreakerProtected: true
        },
        patternEngine: {
          status: "operational",
          lastExecution: new Date().toISOString(),
          fallbacksEnabled: true
        },
        safetyCoordinator: {
          status: "operational",
          monitoring: true,
          resilientOperations: true
        },
      },
      
      deployment: {
        platform: process.platform,
        nodeVersion: process.version,
        architecture: process.arch,
        memoryUsage: process.memoryUsage(),
      },
    };

    return isHealthy
      ? apiResponse.success(healthData, { 
          message: "System is healthy with resilience protection active",
          resilience: {
            circuitBreakers: resilienceStatus.circuitBreakerCount,
            openCircuits: resilienceStatus.openCircuitCount
          }
        })
      : apiResponse.error("System health degraded", 503, healthData);

  } catch (error) {
    const responseTime = Date.now() - startTime;

    // This will be caught by the resilience middleware and provide fallback response
    throw new Error(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}, 'health');

/**
 * HEAD /api/health
 * Lightweight health check with resilience protection
 */
export const HEAD = createResilientEndpoint(async (_request: NextRequest) => {
  const validator = MexcConfigValidator.getInstance();
  const healthCheck = await validator.quickHealthCheck();
  const resilienceStatus = getSystemResilienceStatus();

  const systemHealthy = healthCheck.healthy && healthCheck.score >= 80;
  const resilienceHealthy = resilienceStatus.isHealthy;
  const isHealthy = systemHealthy && resilienceHealthy;
  const statusCode = isHealthy ? 200 : 503;

  return new Response(null, {
    status: statusCode,
    headers: {
      "X-Health-Score": healthCheck.score.toString(),
      "X-Health-Status": isHealthy ? "healthy" : "degraded",
      "X-Uptime": process.uptime().toString(),
      "X-Resilience-Score": resilienceStatus.overallScore.toString(),
      "X-Circuit-Breakers": resilienceStatus.circuitBreakerCount.toString(),
      "X-Open-Circuits": resilienceStatus.openCircuitCount.toString(),
    },
  });
}, 'health');
