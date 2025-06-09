import { NextRequest, NextResponse } from 'next/server';
import { getDevelopmentSecurityHeaders, getProductionSecurityHeaders } from './src/lib/security-headers';

export function middleware(request: NextRequest) {
  // Get the appropriate security headers based on environment
  const isProduction = process.env.NODE_ENV === 'production';
  const securityHeaders = isProduction 
    ? getProductionSecurityHeaders() 
    : getDevelopmentSecurityHeaders();
  
  // Create response
  const response = NextResponse.next();
  
  // Apply security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  // Additional request-specific headers
  response.headers.set('X-Request-ID', crypto.randomUUID());
  
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