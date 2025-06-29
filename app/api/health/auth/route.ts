import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/supabase-auth";

/**
 * Validates URL format and protocol
 */
function validateUrlFormat(url: string | undefined, allowedProtocols: string[]): boolean {
  if (!url) {
    return false;
  }
  
  try {
    const parsedUrl = new URL(url);
    return allowedProtocols.includes(parsedUrl.protocol.slice(0, -1)); // Remove trailing ':'
  } catch {
    return false;
  }
}

/**
 * Health check endpoint for Supabase Auth configuration and functionality
 * 
 * This endpoint validates:
 * - Environment variables are properly configured
 * - Supabase SDK is functioning correctly
 * - Authentication service connectivity
 * 
 * Used by CI/CD pipelines and monitoring systems
 */
export async function GET() {
  try {
    // Required environment variables for Supabase Auth
    const requiredEnvs = [
      'DATABASE_URL',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];

    // Check for missing environment variables (undefined/null, not empty strings)
    const missing = requiredEnvs.filter(env => process.env[env] === undefined);
    
    if (missing.length > 0) {
      return NextResponse.json(
        { 
          status: 'error',
          error: 'Missing required environment variables',
          missing_env_vars: missing,
          timestamp: new Date().toISOString()
        }, 
        { status: 500 }
      );
    }

    // Test Supabase SDK functionality
    let supabaseStatus = 'unknown';
    let authTestResult = null;
    
    try {
      // This tests the SDK initialization without requiring a user session
      const session = await getSession();
      supabaseStatus = 'initialized';
      authTestResult = {
        sdk_accessible: true,
        session_check_working: true,
        auth_status: session.isAuthenticated || false,
        user_present: Boolean(session.user)
      };
    } catch (sdkError) {
      console.error('[Auth Health Check] Supabase SDK Error:', { error: sdkError instanceof Error ? sdkError.message : String(sdkError) });
      supabaseStatus = 'error';
      authTestResult = {
        sdk_accessible: false,
        error: sdkError instanceof Error ? sdkError.message : 'Unknown SDK error'
      };
    }

    // Validate configuration values with proper URL validation
    const configValidation = {
      supabase_url_format: validateUrlFormat(process.env.SUPABASE_URL, ['https']),
      database_url_format: validateUrlFormat(process.env.DATABASE_URL, ['postgresql']),
      anon_key_format: Boolean(process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY.length > 0),
      service_role_key_format: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.length > 0)
    };

    const allConfigValid = Object.values(configValidation).every(Boolean);

    // Determine overall health status
    let overallStatus: 'healthy' | 'warning' | 'unhealthy';
    let message: string;

    if (supabaseStatus === 'error' || !allConfigValid) {
      overallStatus = 'unhealthy';
      message = 'Authentication system has critical issues';
    } else if (supabaseStatus === 'unknown') {
      overallStatus = 'warning';
      message = 'Authentication system partially functional';
    } else {
      overallStatus = 'healthy';
      message = 'Authentication system fully operational';
    }

    // Additional deployment environment info
    let supabaseDomain = null;
    if (process.env.SUPABASE_URL) {
      try {
        supabaseDomain = new URL(process.env.SUPABASE_URL).hostname;
      } catch {
        supabaseDomain = 'invalid-url';
      }
    }
    
    const deploymentInfo = {
      environment: process.env.NODE_ENV || 'development',
      is_vercel: Boolean(process.env.VERCEL),
      is_production: process.env.NODE_ENV === 'production',
      supabase_domain: supabaseDomain,
      database_provider: 'supabase'
    };

    return NextResponse.json({
      status: overallStatus,
      message,
      auth_configured: allConfigValid,
      supabase_sdk_status: supabaseStatus,
      configuration_validation: configValidation,
      auth_test_result: authTestResult,
      deployment_info: deploymentInfo,
      environment_variables: {
        total_required: requiredEnvs.length,
        configured: requiredEnvs.length - missing.length,
        missing_count: missing.length
      },
      timestamp: new Date().toISOString(),
      version: '2.0.0-supabase'
    });

  } catch (error) {
    console.error("[Auth Health Check] Unexpected error:", { error: error });
    
    const errorObj = error as Error | { message?: string };
    return NextResponse.json({
      status: 'error',
      error: 'Auth health check failed',
      details: errorObj?.message || 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    }, {
      status: 500,
    });
  }
}

/**
 * Handle OPTIONS requests for CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'GET, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}