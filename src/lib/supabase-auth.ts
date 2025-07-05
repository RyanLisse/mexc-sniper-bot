import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import {
  isBrowserEnvironment,
  isNodeEnvironment,
} from "@/src/lib/browser-compatible-events";

// Build-time detection to prevent database access during Next.js build
const isBuildTime = () => {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE === "phase-development-server" ||
    (process.env.NODE_ENV === "production" && !process.env.VERCEL) ||
    process.env.WEBPACK === "true" ||
    process.env.npm_lifecycle_event === "build" ||
    process.env.npm_lifecycle_script?.includes("next build")
  );
};

// Lazy imports to prevent build-time database access
let db: any = null;
let hasSupabaseConfig: any = null;
let originalUser: any = null;
let supabaseUsers: any = null;

// Dynamic imports for build-time safety
async function getDbDependencies() {
  if (!db || !hasSupabaseConfig || !originalUser || !supabaseUsers) {
    // During build time, return safe mocks
    if (isBuildTime()) {
      return {
        db: {
          select: () => ({
            from: () => ({
              where: () => ({ limit: () => Promise.resolve([]) }),
            }),
          }),
        },
        hasSupabaseConfig: () => false,
        originalUser: null,
        supabaseUsers: null,
      };
    }

    // Dynamic import during runtime
    const dbModule = await import("../db");
    const authSchema = await import("../db/schemas/auth");
    const supabaseSchema = await import("../db/schemas/supabase-auth");

    db = dbModule.db;
    hasSupabaseConfig = dbModule.hasSupabaseConfig;
    originalUser = authSchema.user;
    supabaseUsers = supabaseSchema.users;
  }

  return { db, hasSupabaseConfig, originalUser, supabaseUsers };
}

export interface SupabaseUser {
  id: string;
  email: string;
  name?: string;
  username?: string;
  picture?: string;
  emailVerified?: boolean;
}

export interface SupabaseSession {
  user: SupabaseUser | null;
  isAuthenticated: boolean;
  accessToken?: string;
}

// Lazy logger initialization to prevent build-time errors
let _logger: any = null;

function getLogger() {
  if (!_logger) {
    _logger = {
      info: (message: string, context?: any) =>
        console.info("[supabase-auth]", message, context || ""),
      warn: (message: string, context?: any) =>
        console.warn("[supabase-auth]", message, context || ""),
      error: (message: string, context?: any, error?: Error) =>
        console.error("[supabase-auth]", message, context || "", error || ""),
      debug: (message: string, context?: any) =>
        console.debug("[supabase-auth]", message, context || ""),
    };
  }
  return _logger;
}

// Singleton pattern for server Supabase client to prevent multiple GoTrueClient instances
let supabaseServerClient: ReturnType<typeof createServerClient> | null = null;
let lastCookieState: string | null = null;

/**
 * Create Supabase server client with cookie handling (Singleton Pattern)
 * This prevents the "Multiple GoTrueClient instances" error
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  // Create a simple hash of cookie state to detect changes
  const currentCookieState = JSON.stringify({
    accessToken: cookieStore.get("sb-access-token")?.value,
    refreshToken: cookieStore.get("sb-refresh-token")?.value,
  });

  // Only create new client if cookies changed or client doesn't exist
  if (!supabaseServerClient || lastCookieState !== currentCookieState) {
    lastCookieState = currentCookieState;

    supabaseServerClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder_key",
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (_error) {
              // The `set` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: "", ...options });
            } catch (_error) {
              // The `delete` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
  }

  return supabaseServerClient;
}

/**
 * Get the current Supabase session from server
 */
export async function getSession(): Promise<SupabaseSession> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      getLogger().error("Error getting Supabase session:", error);
      return { user: null, isAuthenticated: false };
    }

    if (!session?.user) {
      return { user: null, isAuthenticated: false };
    }

    const user = session.user;
    const supabaseUser: SupabaseUser = {
      id: user.id,
      email: user.email ?? "",
      name:
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email ||
        "User",
      username: user.user_metadata?.username,
      picture: user.user_metadata?.picture || user.user_metadata?.avatar_url,
      emailVerified: !!user.email_confirmed_at,
    };

    return {
      user: supabaseUser,
      isAuthenticated: true,
      accessToken: session.access_token,
    };
  } catch (error) {
    getLogger().error("Error getting Supabase session:", error);
    return { user: null, isAuthenticated: false };
  }
}

/**
 * Get user from server-side
 */
export async function getUser(): Promise<SupabaseUser | null> {
  const session = await getSession();
  return session.user;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session.isAuthenticated;
}

/**
 * Sync Supabase user with local database
 */
export async function syncUserWithDatabase(supabaseUser: SupabaseUser) {
  try {
    // Skip during build time
    if (isBuildTime()) {
      getLogger().info("Skipping user sync during build time");
      return true;
    }

    const { db, hasSupabaseConfig, originalUser, supabaseUsers } =
      await getDbDependencies();
    const isSupabase = hasSupabaseConfig();
    const userTable = isSupabase ? supabaseUsers : originalUser;

    // Check if user exists in our database
    const existingUser = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, supabaseUser.id))
      .limit(1);

    if (existingUser.length === 0) {
      // Create new user
      const newUserData = {
        id: supabaseUser.id,
        email: supabaseUser.email,
        name: supabaseUser.name || supabaseUser.email,
        username: supabaseUser.username,
        emailVerified: supabaseUser.emailVerified || false,
        image: supabaseUser.picture,
        ...(isSupabase
          ? {
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          : {
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
      };

      await db.insert(userTable).values(newUserData);
      getLogger().info(`Created new user: ${supabaseUser.email}`);
    } else {
      // Update existing user
      const updateData = {
        email: supabaseUser.email,
        name: supabaseUser.name || supabaseUser.email,
        username: supabaseUser.username,
        emailVerified: supabaseUser.emailVerified,
        image: supabaseUser.picture,
        updatedAt: new Date(),
      };

      await db
        .update(userTable)
        .set(updateData)
        .where(eq(userTable.id, supabaseUser.id));

      getLogger().info(`Updated user: ${supabaseUser.email}`);
    }

    return true;
  } catch (error) {
    getLogger().error("Error syncing user with database:", error);
    return false;
  }
}

/**
 * Get user from database by Supabase ID
 */
export async function getUserFromDatabase(supabaseId: string) {
  try {
    // Skip during build time
    if (isBuildTime()) {
      getLogger().info("Skipping user database query during build time");
      return null;
    }

    const { db, hasSupabaseConfig, originalUser, supabaseUsers } =
      await getDbDependencies();
    const isSupabase = hasSupabaseConfig();
    const userTable = isSupabase ? supabaseUsers : originalUser;

    const users = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, supabaseId))
      .limit(1);
    return users[0] || null;
  } catch (error) {
    getLogger().error("Error getting user from database:", error);
    return null;
  }
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<SupabaseUser> {
  const session = await getSession();

  if (!session.isAuthenticated || !session.user) {
    throw new Error("Authentication required");
  }

  // Sync user with database
  await syncUserWithDatabase(session.user);

  return session.user;
}

// Singleton pattern for admin Supabase client
let supabaseAdminClient: ReturnType<typeof createServerClient> | null = null;

/**
 * Create admin client for server-side operations (Singleton Pattern)
 * This prevents the "Multiple GoTrueClient instances" error
 */
export function createSupabaseAdminClient() {
  if (!supabaseAdminClient) {
    supabaseAdminClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
      process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder_service_role_key",
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

  return supabaseAdminClient;
}

// Export types for use in other files
export type { SupabaseUser as User, SupabaseSession as Session };
