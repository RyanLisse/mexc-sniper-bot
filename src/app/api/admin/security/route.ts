import type { NextRequest } from "next/server";
import {
  apiResponse,
  createErrorResponse,
  createSuccessResponse,
  HTTP_STATUS,
} from "../../../../lib/api-response";
import { adminRoute } from "../../../../lib/auth-decorators";
import {
  getIPAnalysis,
  getRateLimitStats,
  getSecurityEvents,
  isIPSuspicious,
} from "../../../../lib/rate-limiter";

/**
 * GET /api/admin/security
 * Get security monitoring data (admin only)
 */
interface AdminUser {
  id: string;
  email: string;
  name?: string;
}

export const GET = adminRoute(async (request: NextRequest, _user: AdminUser) => {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const ip = url.searchParams.get("ip");

  switch (action) {
    case "stats": {
      const stats = getRateLimitStats();
      return apiResponse(createSuccessResponse(stats));
    }

    case "events": {
      const limit = Number.parseInt(url.searchParams.get("limit") || "50");
      const type = url.searchParams.get("type") as
        | "AUTH_ATTEMPT"
        | "RATE_LIMIT_EXCEEDED"
        | "SUSPICIOUS_ACTIVITY"
        | undefined;
      const events = getSecurityEvents(limit, type);
      return apiResponse(createSuccessResponse({ events }));
    }

    case "ip-analysis": {
      if (!ip) {
        return apiResponse(createErrorResponse("IP parameter required"), HTTP_STATUS.BAD_REQUEST);
      }

      const analysis = getIPAnalysis(ip);
      const suspicious = isIPSuspicious(ip);

      return apiResponse(
        createSuccessResponse({
          ip,
          analysis,
          suspicious,
        })
      );
    }

    case "dashboard": {
      // Return comprehensive security dashboard data
      const dashboardStats = getRateLimitStats();
      const recentEvents = getSecurityEvents(100);
      const suspiciousIPs = recentEvents
        .filter((event) => event.type === "SUSPICIOUS_ACTIVITY")
        .map((event) => event.ip)
        .filter((ip, index, arr) => arr.indexOf(ip) === index) // unique IPs
        .slice(0, 10);

      return apiResponse(
        createSuccessResponse({
          stats: dashboardStats,
          recentEvents: recentEvents.slice(0, 20),
          suspiciousIPs: suspiciousIPs.map((ip) => ({
            ip,
            analysis: getIPAnalysis(ip),
            suspicious: isIPSuspicious(ip),
          })),
        })
      );
    }

    default:
      return apiResponse(
        createErrorResponse("Invalid action parameter", {
          message: "Valid actions: stats, events, ip-analysis, dashboard",
          code: "INVALID_ACTION",
        }),
        HTTP_STATUS.BAD_REQUEST
      );
  }
});

/**
 * POST /api/admin/security
 * Security management actions (admin only)
 */
export const POST = adminRoute(async (request: NextRequest, _user: AdminUser) => {
  const body = await request.json();
  const { action, ip } = body;

  switch (action) {
    case "clear-events":
      // This would clear security events in a real implementation
      // For now, just return success (events auto-cleanup after 24h)
      return apiResponse(
        createSuccessResponse({
          message: "Security events will be cleared automatically after 24 hours",
        })
      );

    case "whitelist-ip":
      if (!ip) {
        return apiResponse(createErrorResponse("IP parameter required"), HTTP_STATUS.BAD_REQUEST);
      }

      // TODO: Implement IP whitelisting functionality
      return apiResponse(
        createSuccessResponse({
          message: `IP ${ip} whitelisting functionality not yet implemented`,
        })
      );

    default:
      return apiResponse(
        createErrorResponse("Invalid action", {
          message: "Valid actions: clear-events, whitelist-ip",
          code: "INVALID_ACTION",
        }),
        HTTP_STATUS.BAD_REQUEST
      );
  }
});
