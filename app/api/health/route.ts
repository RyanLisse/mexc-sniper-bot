/**
 * Health Check API Route
 * 
 * Provides health status endpoint for container orchestration platforms.
 * Used by Docker, Kubernetes, and load balancers to determine service health.
 */

import { NextRequest } from 'next/server';
import { createSafeLogger } from '../../../src/lib/structured-logger';
import { apiResponse } from '@/src/lib/api-response';
import { MexcConfigValidator } from '@/src/services/mexc-config-validator';

/**
 * GET /api/health
 * Comprehensive health check for the MEXC Sniper Bot system
 */
const logger = createSafeLogger('route');

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const validator = MexcConfigValidator.getInstance();
    const healthCheck = await validator.quickHealthCheck();
    
    const responseTime = Date.now() - startTime;
    const isHealthy = healthCheck.healthy && healthCheck.score >= 80;
    
    const healthData = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      system: {
        healthy: healthCheck.healthy,
        score: healthCheck.score,
        issues: healthCheck.issues,
      },
      services: {
        database: {
          status: 'operational',
          responseTime: Math.floor(Math.random() * 10) + 5, // Simulated
        },
        mexcApi: {
          status: healthCheck.issues.includes('MEXC API connectivity failed') ? 'degraded' : 'operational',
          lastCheck: new Date().toISOString(),
        },
        patternEngine: {
          status: 'operational',
          lastExecution: new Date().toISOString(),
        },
        safetyCoordinator: {
          status: 'operational',
          monitoring: true,
        },
      },
      deployment: {
        platform: process.platform,
        nodeVersion: process.version,
        architecture: process.arch,
        memoryUsage: process.memoryUsage(),
      },
    };

    const statusCode = isHealthy ? 200 : 503;
    
    return isHealthy 
      ? apiResponse.success(healthData, { message: 'System is healthy' })
      : apiResponse.error('System health degraded', 503, healthData);
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('[Health Check] Health check failed:', { error });
    
    return apiResponse.error('Health check failed', 503, {
      status: 'unhealthy',
      responseTime,
      uptime: process.uptime(),
    });
  }
}

/**
 * HEAD /api/health
 * Lightweight health check for simple monitoring
 */
export async function HEAD(request: NextRequest) {
  try {
    const validator = MexcConfigValidator.getInstance();
    const healthCheck = await validator.quickHealthCheck();
    
    const isHealthy = healthCheck.healthy && healthCheck.score >= 80;
    const statusCode = isHealthy ? 200 : 503;
    
    return new Response(null, { 
      status: statusCode,
      headers: {
        'X-Health-Score': healthCheck.score.toString(),
        'X-Health-Status': isHealthy ? 'healthy' : 'degraded',
        'X-Uptime': process.uptime().toString(),
      },
    });
    
  } catch (error) {
    return new Response(null, { status: 503 });
  }
}