import { NextRequest } from 'next/server';
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

    // Log for debugging
    console.log(`Middleware: Processing request for ${pathname}`);

    // Only apply auth to protected routes
    const isProtectedRoute = PROTECTED_ROUTES.some(route =>
      pathname.startsWith(route)
    );

    if (isProtectedRoute) {
      console.log(`Middleware: Protected route ${pathname} - requiring authentication`);
      // Let Kinde handle authentication for protected routes
      return undefined;
    }

    // For non-protected routes (including homepage), allow access
    console.log(`Middleware: Non-protected route ${pathname} - allowing access`);
    return undefined;
  },
  {
    isReturnToCurrentPage: true,
    loginPage: '/api/auth/login',
    isAuthorized: ({ token }: { token: any }) => !!token,
  }
);

export const config = {
  matcher: [
    /*
     * Only match protected routes, exclude:
     * - api/auth (Kinde auth routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - / (homepage)
     * - /auth (auth page)
     */
    '/dashboard/:path*',
    '/config/:path*',
    '/sniper/:path*',
    '/trading/:path*',
    '/portfolio/:path*',
    '/analytics/:path*',
    '/reports/:path*',
    '/settings/:path*'
  ],
};