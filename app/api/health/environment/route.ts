import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Define required environment variables
    const requiredEnvVars = [
      'KINDE_CLIENT_ID',
      'KINDE_CLIENT_SECRET',
      'KINDE_ISSUER_URL',
      'DATABASE_URL'
    ];

    // Define optional but recommended environment variables
    const optionalEnvVars = [
      'OPENAI_API_KEY',
      'MEXC_API_KEY',
      'MEXC_SECRET_KEY',
      'TURSO_DATABASE_URL',
      'TURSO_AUTH_TOKEN',
      'INNGEST_SIGNING_KEY',
      'INNGEST_EVENT_KEY'
    ];

    // Check required variables
    const requiredStatus = requiredEnvVars.map(varName => ({
      name: varName,
      configured: !!process.env[varName],
      required: true
    }));

    // Check optional variables
    const optionalStatus = optionalEnvVars.map(varName => ({
      name: varName,
      configured: !!process.env[varName],
      required: false
    }));

    const allVariables = [...requiredStatus, ...optionalStatus];
    
    // Count statuses
    const requiredMissing = requiredStatus.filter(v => !v.configured);
    const optionalConfigured = optionalStatus.filter(v => v.configured);
    
    // Determine overall health
    const isHealthy = requiredMissing.length === 0;
    const hasWarnings = requiredMissing.length === 0 && optionalConfigured.length < optionalStatus.length;
    
    let status: 'healthy' | 'unhealthy' | 'warning';
    let message: string;
    
    if (!isHealthy) {
      status = 'unhealthy';
      message = `Missing required environment variables: ${requiredMissing.map(v => v.name).join(', ')}`;
    } else if (hasWarnings) {
      status = 'warning';
      message = `All required variables configured, but some optional variables are missing`;
    } else {
      status = 'healthy';
      message = 'All environment variables are properly configured';
    }
    
    return NextResponse.json({
      status,
      message,
      variables: allVariables,
      summary: {
        requiredConfigured: requiredStatus.length - requiredMissing.length,
        requiredTotal: requiredStatus.length,
        optionalConfigured: optionalConfigured.length,
        optionalTotal: optionalStatus.length,
        missingRequired: requiredMissing.map(v => v.name),
      },
      timestamp: new Date().toISOString(),
    }, {
      status: isHealthy ? 200 : 503,
    });
  } catch (error) {
    console.error("[Environment Health Check] Error:", error);
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