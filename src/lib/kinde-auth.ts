import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { user } from "../db/schema";
export interface KindeUser {
  id: string;
  email: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  username?: string;
}

export interface KindeSession {
  user: KindeUser | null;
  isAuthenticated: boolean;
}

/**
 * Get the current Kinde session
 */
// Lazy logger initialization to prevent build-time errors
function getLogger() {
  if (!_logger) {
    _logger = {
      info: (message: string, context?: any) =>
        console.info("[kinde-auth]", message, context || ""),
      warn: (message: string, context?: any) =>
        console.warn("[kinde-auth]", message, context || ""),
      error: (message: string, context?: any, error?: Error) =>
        console.error("[kinde-auth]", message, context || "", error || ""),
      debug: (message: string, context?: any) =>
        console.debug("[kinde-auth]", message, context || ""),
    };
  }
  return _logger;
}

export async function getSession(): Promise<KindeSession> {
  try {
    const { getUser, isAuthenticated } = getKindeServerSession();
    const kindeUser = await getUser();
    const authenticated = await isAuthenticated();

    if (!authenticated || !kindeUser) {
      return { user: null, isAuthenticated: false };
    }

    return {
      user: {
        id: kindeUser.id,
        email: kindeUser.email ?? "",
        given_name: kindeUser.given_name ?? undefined,
        family_name: kindeUser.family_name ?? undefined,
        picture: kindeUser.picture ?? undefined,
        username: undefined, // Kinde doesn't provide username field
      },
      isAuthenticated: true,
    };
  } catch (error) {
    getLogger().error("Error getting Kinde session:", error);
    return { user: null, isAuthenticated: false };
  }
}

/**
 * Sync Kinde user with local database
 */
export async function syncUserWithDatabase(kindeUser: KindeUser) {
  try {
    // Check if user exists in our database
    const existingUser = await db.select().from(user).where(eq(user.id, kindeUser.id)).limit(1);

    const fullName =
      `${kindeUser.given_name ?? ""} ${kindeUser.family_name ?? ""}`.trim() || kindeUser.email;

    if (existingUser.length === 0) {
      // Create new user
      await db.insert(user).values({
        id: kindeUser.id,
        email: kindeUser.email,
        name: fullName,
        username: kindeUser.username,
        emailVerified: true, // Kinde handles email verification
        image: kindeUser.picture,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      getLogger().info(`Created new user: ${kindeUser.email}`);
    } else {
      // Update existing user
      await db
        .update(user)
        .set({
          email: kindeUser.email,
          name: fullName,
          username: kindeUser.username,
          image: kindeUser.picture,
          updatedAt: new Date(),
        })
        .where(eq(user.id, kindeUser.id));

      getLogger().info(`Updated user: ${kindeUser.email}`);
    }

    return true;
  } catch (error) {
    getLogger().error("Error syncing user with database:", error);
    return false;
  }
}

/**
 * Get user from database by Kinde ID
 */
export async function getUserFromDatabase(kindeId: string) {
  try {
    const users = await db.select().from(user).where(eq(user.id, kindeId)).limit(1);

    return users[0] || null;
  } catch (error) {
    getLogger().error("Error getting user from database:", error);
    return null;
  }
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<KindeUser> {
  const session = await getSession();

  if (!session.isAuthenticated || !session.user) {
    throw new Error("Authentication required");
  }

  // Sync user with database
  await syncUserWithDatabase(session.user);

  return session.user;
}

// Export types for use in other files
export type { KindeUser as User, KindeSession as Session };
