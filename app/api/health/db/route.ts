import { checkDatabaseHealth, checkAuthTables } from "../../../../src/lib/db-health-check";
import { createSafeLogger } from '../../../../src/lib/structured-logger';
import { createHealthResponse, apiResponse, handleApiError } from "../../../../src/lib/api-response";

const logger = createSafeLogger('route');

export async function GET() {
  try {
    // Check basic database connectivity
    const dbHealth = await checkDatabaseHealth();
    
    // Check auth tables
    const authTables = await checkAuthTables();
    
    // Check environment variables
    const envCheck = {
      AUTH_SECRET: !!process.env.AUTH_SECRET,
      DATABASE_URL: !!process.env.DATABASE_URL,
      DATABASE_URL_PROTOCOL: process.env.DATABASE_URL?.split('://')[0] || 'unknown',
      NODE_ENV: process.env.NODE_ENV || 'development',
    };
    
    const isHealthy = dbHealth.healthy && authTables.healthy;
    
    const healthResult = {
      status: isHealthy ? 'healthy' as const : 'unhealthy' as const,
      message: isHealthy ? 'Database is healthy' : 'Database has issues',
      details: {
        database: dbHealth,
        authTables: authTables,
        environment: envCheck,
      }
    };
    
    const response = createHealthResponse(healthResult);
    return apiResponse(response, isHealthy ? 200 : 503);
  } catch (error) {
    logger.error("[Health Check] Error:", { error: error });
    return handleApiError(error, "Database health check failed");
  }
}