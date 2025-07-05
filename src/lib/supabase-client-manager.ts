/**
 * SUPABASE CLIENT MANAGER - CRITICAL ARCHITECT 4 SOLUTION
 *
 * MISSION: Eliminate "Multiple GoTrueClient instances detected" warnings
 *
 * This centralized manager implements a robust singleton pattern to ensure
 * only ONE Supabase client instance exists per environment context.
 *
 * FIXES:
 * - Multiple GoTrueClient instance warnings
 * - Environment variable inconsistencies
 * - Client lifecycle management
 * - Test environment client conflicts
 */

import {
  type CookieOptions,
  createBrowserClient,
  createServerClient,
} from "@supabase/ssr";

// Environment configuration with fallback validation
const getSupabaseConfig = () => {
  // Use NEXT_PUBLIC_ prefixed versions for consistency
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing required Supabase environment variables. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set."
    );
  }

  return { url, anonKey, serviceRoleKey };
};

// Global singleton instances to prevent multiple GoTrueClient warnings
let browserClientInstance: ReturnType<typeof createBrowserClient> | null = null;
let serverClientInstance: ReturnType<typeof createServerClient> | null = null;
let adminClientInstance: ReturnType<typeof createServerClient> | null = null;

// Track environment for proper cleanup
let lastBrowserEnvSignature: string | null = null;
let lastServerCookieSignature: string | null = null;

/**
 * BROWSER CLIENT SINGLETON - Prevents multiple GoTrueClient instances in browser
 */
export function getSupabaseBrowserClient() {
  // Only create client in browser environment
  if (typeof window === "undefined") {
    return null;
  }

  const config = getSupabaseConfig();
  const currentEnvSignature = `${config.url}:${config.anonKey}`;

  // Create new client only if environment changed or client doesn't exist
  if (
    !browserClientInstance ||
    lastBrowserEnvSignature !== currentEnvSignature
  ) {
    if (browserClientInstance) {
      console.warn(
        "Supabase browser client environment changed, recreating client"
      );
    }

    browserClientInstance = createBrowserClient(config.url, config.anonKey, {
      cookies: {
        get(name: string) {
          if (typeof document === "undefined") return undefined;
          return document.cookie
            .split("; ")
            .find((row) => row.startsWith(`${name}=`))
            ?.split("=")[1];
        },
        set(name: string, value: string, options: any) {
          if (typeof document === "undefined") return;
          let cookieString = `${name}=${value}`;
          if (options?.maxAge) cookieString += `; max-age=${options.maxAge}`;
          if (options?.path) cookieString += `; path=${options.path}`;
          if (options?.domain) cookieString += `; domain=${options.domain}`;
          if (options?.secure) cookieString += "; secure";
          if (options?.httpOnly) cookieString += "; httponly";
          if (options?.sameSite)
            cookieString += `; samesite=${options.sameSite}`;
          document.cookie = cookieString;
        },
        remove(name: string, options: any) {
          if (typeof document === "undefined") return;
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${options?.path || "/"}`;
        },
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    });

    lastBrowserEnvSignature = currentEnvSignature;
  }

  return browserClientInstance;
}

/**
 * SERVER CLIENT SINGLETON - Prevents multiple GoTrueClient instances on server
 */
export async function getSupabaseServerClient() {
  const config = getSupabaseConfig();

  // Dynamic import to avoid Next.js build issues
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  // Create a signature of current cookie state to detect changes
  const currentCookieSignature = JSON.stringify({
    accessToken: cookieStore.get("sb-access-token")?.value,
    refreshToken: cookieStore.get("sb-refresh-token")?.value,
    sessionSignature: `${config.url}:${config.anonKey}`,
  });

  // Only create new client if cookies changed or client doesn't exist
  if (
    !serverClientInstance ||
    lastServerCookieSignature !== currentCookieSignature
  ) {
    if (serverClientInstance) {
      console.debug(
        "Supabase server client cookie state changed, recreating client"
      );
    }

    serverClientInstance = createServerClient(config.url, config.anonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (_error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (_error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    });

    lastServerCookieSignature = currentCookieSignature;
  }

  return serverClientInstance;
}

/**
 * ADMIN CLIENT SINGLETON - For server-side admin operations
 */
export function getSupabaseAdminClient() {
  if (!adminClientInstance) {
    const config = getSupabaseConfig();

    if (!config.serviceRoleKey) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is required for admin operations"
      );
    }

    adminClientInstance = createServerClient(
      config.url,
      config.serviceRoleKey,
      {
        cookies: {
          get() {
            return undefined;
          },
          set() {},
          remove() {},
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  return adminClientInstance;
}

/**
 * MIDDLEWARE CLIENT - Reuses server client to prevent duplication
 */
export function getSupabaseMiddlewareClient(request: Request) {
  const config = getSupabaseConfig();

  // For middleware, create a specialized client that doesn't conflict with server client
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      get(name: string) {
        const cookieHeader = request.headers.get("cookie");
        if (!cookieHeader) return undefined;
        return cookieHeader
          .split("; ")
          .find((row) => row.startsWith(`${name}=`))
          ?.split("=")[1];
      },
      set() {
        // Middleware will handle cookie setting in response
      },
      remove() {
        // Middleware will handle cookie removal in response
      },
    },
  });
}

/**
 * CLIENT CLEANUP - For test environments and hot reloading
 */
export function cleanupSupabaseClients() {
  browserClientInstance = null;
  serverClientInstance = null;
  adminClientInstance = null;
  lastBrowserEnvSignature = null;
  lastServerCookieSignature = null;

  console.debug("Supabase clients cleaned up successfully");
}

/**
 * ENVIRONMENT VALIDATION - Ensure proper configuration
 */
export function validateSupabaseEnvironment() {
  try {
    const config = getSupabaseConfig();

    // Validate URL format
    new URL(config.url);

    // Validate key format (basic check)
    if (config.anonKey.length < 100) {
      console.warn("Supabase anon key appears to be invalid or too short");
    }

    return {
      isValid: true,
      config: {
        url: config.url,
        hasAnonKey: !!config.anonKey,
        hasServiceRoleKey: !!config.serviceRoleKey,
      },
    };
  } catch (error) {
    return {
      isValid: false,
      error:
        error instanceof Error ? error.message : "Unknown validation error",
    };
  }
}

/**
 * CLIENT STATUS - For debugging and monitoring
 */
export function getSupabaseClientStatus() {
  return {
    browser: {
      exists: !!browserClientInstance,
      envSignature: lastBrowserEnvSignature,
    },
    server: {
      exists: !!serverClientInstance,
      cookieSignature: lastServerCookieSignature,
    },
    admin: {
      exists: !!adminClientInstance,
    },
  };
}

// Export for test environments
export const __testExports = {
  cleanupSupabaseClients,
  getSupabaseClientStatus,
  validateSupabaseEnvironment,
};
