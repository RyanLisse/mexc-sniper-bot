import { NextRequest, NextResponse } from 'next/server';

// Simple middleware that allows access to all routes
export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Log the request for debugging
  console.log(`Middleware: Processing request for ${pathname}`);
  
  try {
    // Create response and allow access
    const response = NextResponse.next();
    
    // Apply basic security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    
    // Allow access to all routes
    console.log(`Middleware: Allowing access to ${pathname}`);
    return response;
    
  } catch (error) {
    console.error('Middleware error:', error);
    // If anything fails, just allow the request through
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Apply to all routes except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};