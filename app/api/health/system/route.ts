import { NextResponse } from "next/server";
export async function GET() {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3008";

    // Run all health checks in parallel
    const [
      dbResponse,
      mexcResponse,
      openaiResponse,
      environmentResponse,
      workflowResponse,
    ] = await Promise.allSettled([
      fetch(`${baseUrl}/api/health/db`),
      fetch(`${baseUrl}/api/mexc/connectivity`),
      fetch(`${baseUrl}/api/health/openai`),
      fetch(`${baseUrl}/api/health/environment`),
      fetch(`${baseUrl}/api/workflow-status`),
    ]);

    // Process results
    const results = {
      database: await processHealthCheck(dbResponse, "Database"),
      mexcApi: await processHealthCheck(mexcResponse, "MEXC API"),
      openaiApi: await processHealthCheck(openaiResponse, "OpenAI API"),
      environment: await processHealthCheck(environmentResponse, "Environment"),
      workflows: await processHealthCheck(workflowResponse, "Workflows"),
    };

    // Calculate overall system health
    const healthStatuses = Object.values(results).map((r) => r.status);
    const healthyCount = healthStatuses.filter((s) => s === "healthy").length;
    const warningCount = healthStatuses.filter((s) => s === "warning").length;
    const unhealthyCount = healthStatuses.filter(
      (s) => s === "unhealthy" || s === "error"
    ).length;

    let overallStatus: "healthy" | "warning" | "unhealthy";
    let overallMessage: string;

    if (unhealthyCount > 0) {
      overallStatus = "unhealthy";
      overallMessage = `System has ${unhealthyCount} critical issue(s)`;
    } else if (warningCount > 0) {
      overallStatus = "warning";
      overallMessage = `System operational with ${warningCount} warning(s)`;
    } else {
      overallStatus = "healthy";
      overallMessage = "All systems operational";
    }

    return NextResponse.json({
      status: overallStatus,
      message: overallMessage,
      summary: {
        healthy: healthyCount,
        warnings: warningCount,
        unhealthy: unhealthyCount,
        total: healthStatuses.length,
      },
      components: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[System Health Check] Error:", { error: error });
    const errorObj = error as Error | { message?: string };
    return NextResponse.json(
      {
        status: "error",
        error: errorObj?.message || "System health check failed",
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
      }
    );
  }
}

async function processHealthCheck(
  response: PromiseSettledResult<Response>,
  componentName: string
): Promise<{ status: string; message: string; details?: any }> {
  if (response.status === "rejected") {
    return {
      status: "error",
      message: `${componentName} check failed: ${response.reason}`,
    };
  }

  try {
    const data = await response.value.json();

    if (response.value.ok) {
      return {
        status: data.status || "healthy",
        message: data.message || `${componentName} is operational`,
        details: data,
      };
    } else {
      return {
        status: "unhealthy",
        message: data.error || `${componentName} has issues`,
        details: data,
      };
    }
  } catch (_error) {
    return {
      status: "error",
      message: `Failed to parse ${componentName} response`,
    };
  }
}
