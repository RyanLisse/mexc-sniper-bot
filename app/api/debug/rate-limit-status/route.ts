import { type NextRequest, NextResponse } from "next/server";
import {
  getClientIP,
  getIPAnalysis,
  getRateLimitStats,
  getSecurityEvents,
  isIPSuspicious,
} from "@/src/lib/rate-limiter";

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const stats = getRateLimitStats();
  const ipAnalysis = getIPAnalysis(ip);
  const isSuspicious = isIPSuspicious(ip);
  const recentEvents = getSecurityEvents(50);

  return NextResponse.json({
    success: true,
    data: {
      clientIP: ip,
      isSuspicious,
      ipAnalysis,
      systemStats: stats,
      recentEvents: recentEvents.slice(0, 20), // Last 20 events
      debug: {
        timestamp: new Date().toISOString(),
        userAgent: request.headers.get("user-agent"),
        headers: {
          "x-forwarded-for": request.headers.get("x-forwarded-for"),
          "x-real-ip": request.headers.get("x-real-ip"),
          "cf-connecting-ip": request.headers.get("cf-connecting-ip"),
        },
      },
    },
  });
}
