import { checkDatabaseHealth, checkAuthTables } from "../../../../src/lib/db-health-check";
import { createHealthResponse, apiResponse, handleApiError } from "../../../../src/lib/api-response";

export async function GET() {
  let dbHealth: { healthy: boolean; message: string; error: string | null } = { healthy: false, message: 'Database check not performed', error: 'Unknown error' };
  let authTables: { healthy: boolean; message: string; error: string | null; tables?: Record<string, any> } = { healthy: false, message: 'Auth tables check not performed', error: 'Unknown error' };
  
  try {
    // Check basic database connectivity with timeout
    try {
      dbHealth = await Promise.race([
        checkDatabaseHealth(),
        new Promise<{ healthy: false; message: string; error: string }>((_, reject) => 
          setTimeout(() => reject(new Error('Database health check timeout')), 5000)
        )
      ]);
    } catch (dbError) {
      dbHealth = {
        healthy: false,
        message: 'Database connectivity failed',
        error: dbError instanceof Error ? dbError.message : String(dbError)
      };
      console.error("[Health Check] Database connectivity error:", dbError);
    }
    
    // Only check auth tables if basic connectivity works
    if (dbHealth.healthy) {
      try {
        authTables = await Promise.race([
          checkAuthTables(),
          new Promise<{ healthy: false; message: string; error: string }>((_, reject) =>
            setTimeout(() => reject(new Error('Auth tables check timeout')), 3000)
          )
        ]);
      } catch (authError) {
        authTables = {
          healthy: false,
          message: 'Auth tables check failed',
          error: authError instanceof Error ? authError.message : String(authError)
        };
        console.error("[Health Check] Auth tables check error:", authError);
      }
    } else {
      authTables = {
        healthy: false,
        message: 'Skipped due to database connectivity issues',
        error: 'Database unavailable'
      };
    }
    
    // Check environment variables
    const envCheck = {
      AUTH_SECRET: !!process.env.AUTH_SECRET,
      DATABASE_URL: !!process.env.DATABASE_URL,
      DATABASE_URL_PROTOCOL: process.env.DATABASE_URL?.split('://')[0] || 'unknown',
      NODE_ENV: process.env.NODE_ENV || 'development',
    };
    
    const isHealthy = dbHealth.healthy && authTables.healthy;
    const timestamp = new Date().toISOString();
    
    const healthResult = {
      status: isHealthy ? 'healthy' as const : 'unhealthy' as const,
      message: isHealthy ? 'Database is healthy' : 'Database has connectivity or configuration issues',
      timestamp,
      details: {
        database: dbHealth,
        authTables: authTables,
        environment: envCheck,
      },
      // Add diagnostic information for troubleshooting
      diagnostics: {
        dbConnectivityIssue: !dbHealth.healthy,
        authTablesIssue: !authTables.healthy && dbHealth.healthy,
        configurationIssue: !envCheck.DATABASE_URL || !envCheck.AUTH_SECRET,
        cascadeRisk: !dbHealth.healthy // Indicates if this could cause downstream 500 errors
      }
    };
    
    const response = createHealthResponse(healthResult);
    return apiResponse(response, isHealthy ? 200 : 503);
  } catch (error) {
    // Fallback error handling - should never reach here due to individual try/catch blocks
    console.error("[Health Check] Unexpected error:", error);
    
    const criticalHealthResult = {
      status: 'critical' as const,
      message: 'Database health check failed completely',
      timestamp: new Date().toISOString(),
      details: {
        database: dbHealth,
        authTables: authTables,
        environment: {
          AUTH_SECRET: !!process.env.AUTH_SECRET,
          DATABASE_URL: !!process.env.DATABASE_URL,
          DATABASE_URL_PROTOCOL: process.env.DATABASE_URL?.split('://')[0] || 'unknown',
          NODE_ENV: process.env.NODE_ENV || 'development',
        }
      },
      error: error instanceof Error ? error.message : String(error),
      diagnostics: {
        dbConnectivityIssue: true,
        authTablesIssue: true,
        configurationIssue: !process.env.DATABASE_URL || !process.env.AUTH_SECRET,
        cascadeRisk: true // High risk of causing downstream failures
      }
    };
    
    const response = createHealthResponse(criticalHealthResult);
    return apiResponse(response, 503);
  }
}