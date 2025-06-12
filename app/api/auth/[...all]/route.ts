import { auth } from "@/src/lib/auth";
import { checkRateLimit, createRateLimitResponse, getClientIP } from "@/src/lib/rate-limiter";

// Auth endpoints that need strict rate limiting
const AUTH_ENDPOINTS = [
  '/sign-up/email',
  '/sign-in/email',
  '/reset-password',
  '/verify-email'
];

function isAuthEndpoint(pathname: string): boolean {
  return AUTH_ENDPOINTS.some(endpoint => pathname.includes(endpoint));
}

// Add OPTIONS handler for CORS preflight
export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}

export async function GET(request: Request) {
  try {
    // Log the request for debugging
    const url = new URL(request.url);
    console.log(`[Auth] GET ${url.pathname}`);
    
    // Check if this is a get-session request
    if (url.pathname.includes('get-session')) {
      console.log('[Auth] Processing get-session request');
    }
    
    const response = await auth.handler(request);
    
    // Log response status for debugging
    console.log(`[Auth] Response status: ${response.status}`);
    
    return response;
  } catch (error) {
    console.error("[Auth] GET error:", error);
    console.error("[Auth] Stack trace:", error?.stack);
    
    // Check for specific database errors
    if (error?.message?.includes('database') || error?.message?.includes('sqlite')) {
      console.error("[Auth] Database connection error detected");
      return new Response(JSON.stringify({ 
        error: "Database connection error", 
        details: "Unable to connect to the authentication database",
        suggestion: "Please check database configuration and ensure migrations are applied"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    return new Response(JSON.stringify({ 
      error: "Auth system error", 
      details: error?.toString(),
      message: error?.message || "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    console.log(`[Auth] POST ${pathname}`);
    
    // Apply rate limiting to authentication endpoints
    if (isAuthEndpoint(pathname)) {
      const clientIP = getClientIP(request);
      const rateLimit = checkRateLimit(clientIP, pathname, 'auth');
      
      if (!rateLimit.success) {
        console.warn(`Rate limit exceeded for IP ${clientIP} on ${pathname}`);
        return createRateLimitResponse(rateLimit.resetTime);
      }
      
      // Process the auth request
      const response = await auth.handler(request);
      
      // Add rate limit headers to the response
      const headers = new Headers(response.headers);
      headers.set('X-RateLimit-Limit', '5');
      headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
      headers.set('X-RateLimit-Reset', Math.ceil(rateLimit.resetTime / 1000).toString());
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    
    // Non-auth endpoints go through without additional rate limiting
    return auth.handler(request);
  } catch (error) {
    console.error("Auth POST error:", error);
    return new Response(JSON.stringify({ 
      error: "Auth system error", 
      details: error?.toString() 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function PUT(request: Request) {
  try {
    return auth.handler(request);
  } catch (error) {
    console.error("Auth PUT error:", error);
    return new Response(JSON.stringify({ 
      error: "Auth system error", 
      details: error?.toString() 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function DELETE(request: Request) {
  try {
    return auth.handler(request);
  } catch (error) {
    console.error("Auth DELETE error:", error);
    return new Response(JSON.stringify({ 
      error: "Auth system error", 
      details: error?.toString() 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function PATCH(request: Request) {
  try {
    return auth.handler(request);
  } catch (error) {
    console.error("Auth PATCH error:", error);
    return new Response(JSON.stringify({ 
      error: "Auth system error", 
      details: error?.toString() 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}