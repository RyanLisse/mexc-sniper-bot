"use client";

import { createBrowserClient } from '@supabase/ssr';

// Singleton pattern for browser Supabase client
let supabaseBrowserClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Get or create a single Supabase browser client instance
 * This prevents the "Multiple GoTrueClient instances" error
 */
export function createSupabaseBrowserClient() {
  // Only create client in browser environment
  if (typeof window === 'undefined') {
    throw new Error('Supabase browser client can only be used in browser environment');
  }

  if (!supabaseBrowserClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Missing Supabase environment variables. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
      );
    }

    supabaseBrowserClient = createBrowserClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            if (typeof document === 'undefined') return undefined;
            return document.cookie
              .split('; ')
              .find(row => row.startsWith(`${name}=`))
              ?.split('=')[1];
          },
          set(name: string, value: string, options: any) {
            if (typeof document === 'undefined') return;
            let cookieString = `${name}=${value}`;
            if (options?.maxAge) cookieString += `; max-age=${options.maxAge}`;
            if (options?.path) cookieString += `; path=${options.path}`;
            if (options?.domain) cookieString += `; domain=${options.domain}`;
            if (options?.secure) cookieString += '; secure';
            if (options?.httpOnly) cookieString += '; httponly';
            if (options?.sameSite) cookieString += `; samesite=${options.sameSite}`;
            document.cookie = cookieString;
          },
          remove(name: string, options: any) {
            if (typeof document === 'undefined') return;
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${options?.path || '/'}`;
          },
        },
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          flowType: 'pkce'
        }
      }
    );
  }
  
  return supabaseBrowserClient;
}

/**
 * Get Supabase client instance safely (lazy initialization)
 * Only call this in browser environment
 */
export function getSupabaseBrowserClient() {
  if (typeof window === 'undefined') {
    return null; // Return null on server side
  }
  return createSupabaseBrowserClient();
}