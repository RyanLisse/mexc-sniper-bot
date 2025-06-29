import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    try {
      await supabase.auth.exchangeCodeForSession(code);
    } catch (error) {
      console.error('Error exchanging code for session:', error);
      // Redirect to error page or login page
      return NextResponse.redirect(new URL('/auth/error', request.url));
    }
  }

  // URL to redirect to after sign in process completes
  const redirectUrl = requestUrl.searchParams.get('redirect_to') || '/dashboard';
  return NextResponse.redirect(new URL(redirectUrl, request.url));
}