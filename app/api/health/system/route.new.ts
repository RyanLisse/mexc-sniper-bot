/**
 * System Health Check API - Migrated to new middleware system
 * 
 * This demonstrates how the new middleware system handles public endpoints
 * with optional authentication and standardized health check responses.
 */

import { NextRequest } from 'next/server';
import { checkDatabaseHealth, checkAuthTables } from "@/src/lib/db-health-check";
import { 
  publicHandler,
  type ApiContext 
} from '@/src/lib/api-middleware';
import { 
  HealthCheckQuerySchema 
} from '@/src/lib/api-schemas';

// GET /api/health/system?includeDetails=true
export const GET = publicHandler({
  validation: HealthCheckQuerySchema,
  rateLimit: 'general',
  logging: false, // Don't log health checks to reduce noise
  cors: true,
})(async (request: NextRequest, context: ApiContext) => {
  const includeDetails = context.searchParams.get('includeDetails') === 'true';

  try {
    // Check basic database connectivity
    const dbHealth = await checkDatabaseHealth();
    
    // Check auth tables
    const authTables = await checkAuthTables();
    
    // Check environment variables
    const envCheck = {
      AUTH_SECRET: !!process.env.AUTH_SECRET,
      DATABASE_URL: !!process.env.DATABASE_URL,
      TURSO_DATABASE_URL: !!process.env.TURSO_DATABASE_URL,
      TURSO_AUTH_TOKEN: !!process.env.TURSO_AUTH_TOKEN,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      NODE_ENV: process.env.NODE_ENV || 'development',
    };
    
    const isHealthy = dbHealth.healthy && authTables.healthy;
    
    // Basic health response
    const healthResponse: any = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
    };

    // Include detailed information if requested
    if (includeDetails) {
      healthResponse.details = {
        database: dbHealth,
        authTables: authTables,
        environment: envCheck,
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          external: process.memoryUsage().external,
        },
        platform: {
          node: process.version,
          platform: process.platform,
          arch: process.arch,
        },
      };
    }

    return context.success(healthResponse, {
      cacheable: true,
      cacheSeconds: 30, // Cache for 30 seconds
    });

  } catch (error) {
    console.error("[Health Check] Error:", error);
    const errorObj = error as Error | { message?: string };
    
    return context.error('Health check failed', 500, {
      code: 'HEALTH_CHECK_ERROR',
      details: errorObj?.message || 'Unknown error',
    });
  }
});