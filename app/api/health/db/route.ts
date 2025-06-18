import { checkDatabaseHealth, checkAuthTables } from "../../../../src/lib/db-health-check";
import { NextResponse } from "next/server";

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
    
    return NextResponse.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      database: dbHealth,
      authTables: authTables,
      environment: envCheck,
      timestamp: new Date().toISOString(),
    }, {
      status: isHealthy ? 200 : 503,
    });
  } catch (error) {
    console.error("[Health Check] Error:", error);
    const errorObj = error as Error | { message?: string };
    return NextResponse.json({
      status: 'error',
      error: errorObj?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    }, {
      status: 500,
    });
  }
}