import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '../../../../src/lib/structured-logger';
import { 
  clearAllRateLimitData, 
  clearSecurityEvents,
  getClientIP
} from "../../../../src/lib/rate-limiter";

const logger = createLogger('route');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = 'clear' } = body;
    
    const ip = getClientIP(request);

    if (action === 'clear') {
      // Clear all rate limiting data
      clearAllRateLimitData();
      clearSecurityEvents();
      
      logger.info(`[DEBUG] Rate limits cleared by IP: ${ip}`);
      
      return NextResponse.json({
        success: true,
        message: 'Rate limits and security events cleared',
        clientIP: ip,
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action. Use action: "clear"'
    }, { status: 400 });

  } catch (error) {
    logger.error('[DEBUG] Failed to clear rate limits:', { error });
    
    return NextResponse.json({
      success: false,
      error: 'Failed to clear rate limits',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}