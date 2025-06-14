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

    // Let Kinde handle authentication for protected routes
    // The withAuth wrapper will automatically redirect to login if needed
    const isProtectedRoute = PROTECTED_ROUTES.some(route =>
      pathname.startsWith(route)
    );

    if (isProtectedRoute) {
      console.log(`Middleware: Protected route ${pathname} - letting Kinde handle auth`);
    }

    // No custom logic needed - let Kinde handle everything
    return undefined; // Let Kinde middleware continue
  },
  {
    isReturnToCurrentPage: true,
    loginPage: '/api/auth/login',
    isAuthorized: ({ token }) => !!token,
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