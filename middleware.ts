import { type NextRequest } from 'next/server';
import { updateSession } from '@/src/lib/supabase-middleware';

export async function middleware(request: NextRequest) {
  // Use Supabase middleware for proper session handling
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};