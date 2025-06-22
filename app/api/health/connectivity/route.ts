/**
 * Connectivity Health Check API
 * 
 * Provides lightweight connectivity monitoring with fast response times
 * for real-time health monitoring and dashboard updates.
 */

import { NextResponse } from "next/server";
import { getRecommendedMexcService } from "../../../../src/services/mexc-unified-exports";
import { getUserCredentials } from "../../../../src/services/user-credentials-service";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

interface HealthCheckResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: {
    network: {
      status: "pass" | "fail";
      latency?: number;
      error?: string;
    };
    authentication: {
      status: "pass" | "fail" | "skip";
      hasCredentials: boolean;
      source?: "database" | "environment" | "none";
      error?: string;
    };
    api: {
      status: "pass" | "fail" | "skip";
      latency?: number;
      error?: string;
    };
  };
  metadata: {
    retryCount: number;
    overallLatency: number;
    healthScore: number;
  };
}

export async function GET() {
  const startTime = Date.now();
  let retryCount = 0;
  
  const response: HealthCheckResponse = {
    status: "unhealthy",
    timestamp: new Date().toISOString(),
    checks: {
      network: { status: "fail" },
      authentication: { status: "skip", hasCredentials: false },
      api: { status: "skip" },
    },
    metadata: {
      retryCount: 0,
      overallLatency: 0,
      healthScore: 0,
    },
  };

  try {
    // Get user credentials
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    const userId = user?.id;

    let userCredentials = null;
    let hasCredentials = false;
    let credentialSource: "database" | "environment" | "none" = "none";

    // Check for user credentials
    if (userId) {
      try {
        userCredentials = await getUserCredentials(userId, 'mexc');
        hasCredentials = !!userCredentials;
        if (hasCredentials) {
          credentialSource = "database";
        }
      } catch (error) {
        console.warn("Failed to retrieve user credentials:", error);
      }
    }

    // Check for environment credentials if no user credentials
    if (!hasCredentials) {
      hasCredentials = !!(process.env.MEXC_API_KEY && process.env.MEXC_SECRET_KEY);
      if (hasCredentials) {
        credentialSource = "environment";
      }
    }

    response.checks.authentication = {
      status: "pass",
      hasCredentials,
      source: credentialSource,
    };

    // Perform network connectivity test with retry
    const maxRetries = 2;
    let networkSuccess = false;
    let networkLatency = 0;
    let lastNetworkError: string | undefined;

    for (let attempt = 0; attempt < maxRetries && !networkSuccess; attempt++) {
      const attemptStart = Date.now();
      retryCount = attempt;

      try {
        const mexcService = getRecommendedMexcService(userCredentials || undefined);
        const connectivityResult = await mexcService.testConnectivity();
        
        networkLatency = Date.now() - attemptStart;
        
        if (typeof connectivityResult === 'boolean') {
          networkSuccess = connectivityResult;
        } else {
          networkSuccess = connectivityResult?.success === true;
        }

        if (networkSuccess) {
          response.checks.network = {
            status: "pass",
            latency: networkLatency,
          };
          break;
        } else {
          lastNetworkError = connectivityResult?.error || "Network test failed";
        }
      } catch (error) {
        networkLatency = Date.now() - attemptStart;
        lastNetworkError = error instanceof Error ? error.message : "Unknown error";
        
        // Wait before retry (except on last attempt)
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    if (!networkSuccess) {
      response.checks.network = {
        status: "fail",
        latency: networkLatency,
        error: lastNetworkError,
      };
    }

    // Perform API test if we have credentials and network is working
    if (networkSuccess && hasCredentials) {
      const apiStart = Date.now();
      
      try {
        const mexcService = getRecommendedMexcService(userCredentials || undefined);
        const accountResult = await mexcService.getAccountBalances();
        
        const apiLatency = Date.now() - apiStart;
        
        if (accountResult.success) {
          response.checks.api = {
            status: "pass",
            latency: apiLatency,
          };
        } else {
          response.checks.api = {
            status: "fail",
            latency: apiLatency,
            error: accountResult.error || "API test failed",
          };
        }
      } catch (error) {
        const apiLatency = Date.now() - apiStart;
        response.checks.api = {
          status: "fail",
          latency: apiLatency,
          error: error instanceof Error ? error.message : "Unknown API error",
        };
      }
    }

    // Calculate overall status and health score
    const overallLatency = Date.now() - startTime;
    let healthScore = 100;
    let passedChecks = 0;
    let totalChecks = 0;

    // Network check
    totalChecks++;
    if (response.checks.network.status === "pass") {
      passedChecks++;
    } else {
      healthScore -= 50;
    }

    // Authentication check
    totalChecks++;
    if (response.checks.authentication.status === "pass" && hasCredentials) {
      passedChecks++;
    } else if (!hasCredentials) {
      healthScore -= 20; // Less penalty for no credentials
    } else {
      healthScore -= 30;
    }

    // API check (only if we have credentials)
    if (hasCredentials) {
      totalChecks++;
      if (response.checks.api.status === "pass") {
        passedChecks++;
      } else {
        healthScore -= 30;
      }
    }

    // Penalty for retries and high latency
    if (retryCount > 0) {
      healthScore -= retryCount * 10;
    }
    if (overallLatency > 5000) {
      healthScore -= 20;
    } else if (overallLatency > 2000) {
      healthScore -= 10;
    }

    healthScore = Math.max(0, Math.min(100, healthScore));

    // Determine overall status
    let status: "healthy" | "degraded" | "unhealthy" = "unhealthy";
    if (healthScore >= 80 && response.checks.network.status === "pass") {
      status = "healthy";
    } else if (healthScore >= 50 || response.checks.network.status === "pass") {
      status = "degraded";
    }

    response.status = status;
    response.metadata = {
      retryCount,
      overallLatency,
      healthScore,
    };

    return NextResponse.json(response, {
      status: status === "healthy" ? 200 : status === "degraded" ? 206 : 503,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });

  } catch (error) {
    console.error("Health check failed:", error);
    
    const overallLatency = Date.now() - startTime;
    response.status = "unhealthy";
    response.metadata = {
      retryCount,
      overallLatency,
      healthScore: 0,
    };
    response.checks.network.error = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(response, {
      status: 503,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  }
}

// Support for HEAD requests for basic connectivity testing
export async function HEAD() {
  try {
    const mexcService = getRecommendedMexcService();
    const result = await mexcService.testConnectivity();
    
    const isConnected = typeof result === 'boolean' ? result : result?.success === true;
    
    return new NextResponse(null, {
      status: isConnected ? 200 : 503,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Health-Status": isConnected ? "healthy" : "unhealthy",
      },
    });
  } catch (error) {
    return new NextResponse(null, {
      status: 503,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Health-Status": "unhealthy",
        "X-Error": error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}