import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Minimal middleware - just pass through
  return NextResponse.next();
}

// Only run on specific routes to minimize edge runtime issues
export const config = {
  matcher: [
    // Only match dashboard and auth pages, exclude API routes and static files
    '/dashboard/:path*',
    '/auth/:path*',
  ],
};