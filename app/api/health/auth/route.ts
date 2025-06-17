import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { NextResponse } from "next/server";

/**
 * Health check endpoint for Kinde Auth configuration and functionality
 * 
 * This endpoint validates:
 * - Environment variables are properly configured
 * - Kinde SDK is functioning correctly
 * - Authentication service connectivity
 * 
 * Used by CI/CD pipelines and monitoring systems
 */
export async function GET() {
  try {
    // Required environment variables for Kinde Auth
    const requiredEnvs = [
      'KINDE_CLIENT_ID',
      'KINDE_CLIENT_SECRET', 
      'KINDE_ISSUER_URL',
      'KINDE_SITE_URL',
      'KINDE_POST_LOGOUT_REDIRECT_URL',
      'KINDE_POST_LOGIN_REDIRECT_URL'
    ];

    // Check for missing environment variables
    const missing = requiredEnvs.filter(env => !process.env[env]);
    
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

    // Test Kinde SDK functionality
    let kindeStatus = 'unknown';
    let authTestResult = null;
    
    try {
      const { isAuthenticated, getUser } = getKindeServerSession();
      
      // This tests the SDK initialization without requiring a user session
      // We check if we can call the functions without errors
      const authResult = await isAuthenticated();
      kindeStatus = 'initialized';
      authTestResult = {
        sdk_accessible: true,
        session_check_working: true,
        auth_status: authResult || false
      };
    } catch (sdkError) {
      console.error('[Auth Health Check] Kinde SDK Error:', sdkError);
      kindeStatus = 'error';
      authTestResult = {
        sdk_accessible: false,
        error: sdkError instanceof Error ? sdkError.message : 'Unknown SDK error'
      };
    }

    // Validate configuration values
    const configValidation = {
      issuer_url_format: process.env.KINDE_ISSUER_URL?.startsWith('https://'),
      site_url_format: process.env.KINDE_SITE_URL?.startsWith('http'),
      client_id_format: process.env.KINDE_CLIENT_ID?.length > 0,
      redirect_urls_configured: Boolean(
        process.env.KINDE_POST_LOGIN_REDIRECT_URL && 
        process.env.KINDE_POST_LOGOUT_REDIRECT_URL
      )
    };

    const allConfigValid = Object.values(configValidation).every(Boolean);

    // Determine overall health status
    let overallStatus: 'healthy' | 'warning' | 'unhealthy';
    let message: string;

    if (kindeStatus === 'error' || !allConfigValid) {
      overallStatus = 'unhealthy';
      message = 'Authentication system has critical issues';
    } else if (kindeStatus === 'unknown') {
      overallStatus = 'warning';
      message = 'Authentication system partially functional';
    } else {
      overallStatus = 'healthy';
      message = 'Authentication system fully operational';
    }

    // Additional deployment environment info
    const deploymentInfo = {
      environment: process.env.NODE_ENV || 'development',
      is_vercel: Boolean(process.env.VERCEL),
      is_production: process.env.NODE_ENV === 'production',
      kinde_issuer_domain: process.env.KINDE_ISSUER_URL ? 
        new URL(process.env.KINDE_ISSUER_URL).hostname : null
    };

    return NextResponse.json({
      status: overallStatus,
      message,
      auth_configured: allConfigValid,
      kinde_sdk_status: kindeStatus,
      configuration_validation: configValidation,
      auth_test_result: authTestResult,
      deployment_info: deploymentInfo,
      environment_variables: {
        total_required: requiredEnvs.length,
        configured: requiredEnvs.length - missing.length,
        missing_count: missing.length
      },
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });

  } catch (error) {
    console.error("[Auth Health Check] Unexpected error:", error);
    
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