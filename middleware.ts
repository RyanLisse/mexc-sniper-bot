import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from "@kinde-oss/kinde-auth-nextjs/middleware";

// Protected routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/config',
  '/sniper',
  '/trading',
  '/portfolio',
  '/analytics',
  '/reports',
  '/settings'
];

export default withAuth(
  async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Check if the current path is a protected route
    const isProtectedRoute = PROTECTED_ROUTES.some(route =>
      pathname.startsWith(route)
    );

    if (isProtectedRoute) {
      // Check for Kinde session cookie
      const kindeToken = request.cookies.get('kinde_token')?.value;

      if (!kindeToken) {
        // No session - redirect to login
        console.log(`Middleware: No Kinde session found for ${pathname}, redirecting to login`);
        return NextResponse.redirect(new URL('/api/auth/login', request.url));
      }

      // Kinde middleware will handle session validation
      console.log(`Middleware: Kinde session found for ${pathname}, allowing access`);
    }

    // For auth page, redirect authenticated users to dashboard
    if (pathname === '/auth') {
      const kindeToken = request.cookies.get('kinde_token')?.value;

      if (kindeToken) {
        // Authenticated user trying to access auth page - redirect to dashboard
        console.log('Middleware: Authenticated user accessing auth page, redirecting to dashboard');
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    return NextResponse.next();
  },
  {
    isReturnToCurrentPage: true,
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (Kinde auth routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};