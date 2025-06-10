import { NextRequest, NextResponse } from 'next/server';

// Protected routes that require authentication
const PROTECTED_ROUTES = ['/dashboard', '/config'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the current path is a protected route
  const isProtectedRoute = PROTECTED_ROUTES.some(route => 
    pathname.startsWith(route)
  );

  if (isProtectedRoute) {
    // Check for session cookie
    const sessionToken = request.cookies.get('better-auth.session_token')?.value;
    
    if (!sessionToken) {
      // No session - redirect to homepage
      console.log(`Middleware: No session found for ${pathname}, redirecting to homepage`);
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Verify session with auth API
    try {
      const sessionResponse = await fetch(new URL('/api/auth/get-session', request.url), {
        method: 'GET',
        headers: {
          Cookie: request.headers.get('cookie') || '',
        },
      });

      if (!sessionResponse.ok || sessionResponse.status === 401) {
        // Invalid session - redirect to homepage
        console.log(`Middleware: Invalid session for ${pathname}, redirecting to homepage`);
        return NextResponse.redirect(new URL('/', request.url));
      }

      const sessionData = await sessionResponse.json();
      if (!sessionData?.user) {
        // No user in session - redirect to homepage
        console.log(`Middleware: No user in session for ${pathname}, redirecting to homepage`);
        return NextResponse.redirect(new URL('/', request.url));
      }

      // Valid session - allow access
      console.log(`Middleware: Valid session for ${pathname}, allowing access`);
    } catch (error) {
      // Error checking session - redirect to homepage for safety
      console.log(`Middleware: Error checking session for ${pathname}:`, error);
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // For auth page, redirect authenticated users to dashboard
  if (pathname === '/auth') {
    const sessionToken = request.cookies.get('better-auth.session_token')?.value;
    
    if (sessionToken) {
      try {
        const sessionResponse = await fetch(new URL('/api/auth/get-session', request.url), {
          method: 'GET',
          headers: {
            Cookie: request.headers.get('cookie') || '',
          },
        });

        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          if (sessionData?.user) {
            // Authenticated user trying to access auth page - redirect to dashboard
            console.log('Middleware: Authenticated user accessing auth page, redirecting to dashboard');
            return NextResponse.redirect(new URL('/dashboard', request.url));
          }
        }
      } catch (error) {
        // Ignore errors, let user proceed to auth page
        console.log('Middleware: Error checking session for auth page:', error);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/config/:path*',
    '/auth',
  ],
};