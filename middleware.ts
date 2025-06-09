import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Create response
  const response = NextResponse.next();
  
  // Basic security headers that work in edge runtime
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;
  
  if (isProduction) {
    // Production security headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-DNS-Prefetch-Control', 'off');
    response.headers.set('X-Download-Options', 'noopen');
    response.headers.set('X-XSS-Protection', '1; mode=block');
  }
  
  // Generate simple request ID without crypto API
  const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  response.headers.set('X-Request-ID', requestId);
  
  // Remove sensitive server information
  response.headers.delete('Server');
  response.headers.delete('X-Powered-By');
  
  return response;
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};