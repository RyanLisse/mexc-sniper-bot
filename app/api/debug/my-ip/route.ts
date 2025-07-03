import { type NextRequest, NextResponse } from "next/server";
import { getClientIP } from "@/src/lib/rate-limiter";

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);

  return NextResponse.json({
    success: true,
    data: {
      clientIP: ip,
      timestamp: new Date().toISOString(),
      headers: {
        "x-forwarded-for": request.headers.get("x-forwarded-for"),
        "x-real-ip": request.headers.get("x-real-ip"),
        "cf-connecting-ip": request.headers.get("cf-connecting-ip"),
        "user-agent": request.headers.get("user-agent"),
      },
    },
  });
}
