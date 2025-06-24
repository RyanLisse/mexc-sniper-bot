import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '../../../src/lib/structured-logger';

const logger = createLogger('route');

export async function GET(request: NextRequest) {
  try {
    // Get various IP-related headers from Vercel
    const headers = {
      'x-forwarded-for': request.headers.get('x-forwarded-for'),
      'x-real-ip': request.headers.get('x-real-ip'),
      'x-vercel-forwarded-for': request.headers.get('x-vercel-forwarded-for'),
      'x-forwarded-proto': request.headers.get('x-forwarded-proto'),
      'x-vercel-ip-city': request.headers.get('x-vercel-ip-city'),
      'x-vercel-ip-country': request.headers.get('x-vercel-ip-country'),
      'x-vercel-ip-country-region': request.headers.get('x-vercel-ip-country-region'),
      'x-vercel-ip-latitude': request.headers.get('x-vercel-ip-latitude'),
      'x-vercel-ip-longitude': request.headers.get('x-vercel-ip-longitude'),
    };

    // Get outbound IP by making a request to external service
    let outboundIP = null;
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      outboundIP = ipData.ip;
    } catch (error) {
      logger.error('Failed to get outbound IP:', error);
    }

    // Alternative IP detection services
    const ipServices = [
      'https://httpbin.org/ip',
      'https://api.ipify.org?format=json',
      'https://ipapi.co/json/',
    ];

    const ipResults = [];
    for (const service of ipServices) {
      try {
        const response = await fetch(service, { 
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        const data = await response.json();
        ipResults.push({
          service,
          data,
        });
      } catch (error) {
        ipResults.push({
          service,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      region: process.env.VERCEL_REGION || 'unknown',
      deployment: {
        url: process.env.VERCEL_URL,
        deployment_id: process.env.VERCEL_DEPLOYMENT_ID,
        region: process.env.VERCEL_REGION,
      },
      request_headers: headers,
      outbound_ip: outboundIP,
      ip_detection_results: ipResults,
      recommendations: {
        mexc_api_setup: [
          "1. Run this endpoint multiple times to collect different IP addresses",
          "2. Vercel uses dynamic IPs, so you may see different addresses",
          "3. For production, consider these options:",
          "   - Use API key restrictions by domain instead of IP",
          "   - Implement additional authentication (API secrets)",
          "   - Consider Vercel Enterprise for dedicated IPs",
          "4. If you must use IP allowlisting, collect IPs over time",
        ],
        alternative_security: [
          "- Use MEXC API with domain restrictions if available",
          "- Implement request signing with timestamps",
          "- Use environment-specific API keys",
          "- Add custom headers for additional verification",
        ]
      }
    }, { status: 200 });

  } catch (error) {
    logger.error('IP info endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get IP information',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Allow POST for testing from different regions/times
  return GET(request);
}