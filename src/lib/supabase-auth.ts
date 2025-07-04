import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import {
  isBrowserEnvironment,
  isNodeEnvironment,
} from "@/src/lib/browser-compatible-events";
import { db, hasSupabaseConfig } from "../db";
import { user as originalUser } from "../db/schemas/auth";
import { users as supabaseUsers } from "../db/schemas/supabase-auth";

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

/**
 * Create Supabase server client with cookie handling
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
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

/**
 * Create admin client for server-side operations
 */
export function createSupabaseAdminClient() {
  return createServerClient(
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

// Export types for use in other files
export type { SupabaseUser as User, SupabaseSession as Session };
