"use client";

import { useKindeBrowserClient } from "@kinde-oss/kinde-auth-nextjs";
import { useCallback, useEffect, useState } from "react";

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  username?: string;
  picture?: string;
}

interface AuthSession {
  user?: AuthUser;
  isAuthenticated: boolean;
}

interface AuthError extends Error {
  message: string;
}

/**
 * Custom hook for Kinde authentication
 */
export const useAuth = () => {
  const { user, isAuthenticated, isLoading, getToken } = useKindeBrowserClient();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      setIsPending(true);
      setError(null);

      if (isLoading) {
        return;
      }

      if (isAuthenticated && user) {
        const authUser: AuthUser = {
          id: user.id,
          email: user.email ?? "",
          name:
            `${user.given_name ?? ""} ${user.family_name ?? ""}`.trim() || (user.email ?? "User"),
          username: undefined, // Kinde doesn't provide username field
          picture: user.picture ?? undefined,
        };

        setSession({
          user: authUser,
          isAuthenticated: true,
        });
      } else {
        setSession({
          isAuthenticated: false,
        });
      }
    } catch (err) {
      const error = err as AuthError;
      setError(error);
      setSession(null);
    } finally {
      setIsPending(false);
    }
  }, [user, isAuthenticated, isLoading]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  return {
    user: session?.user || null,
    isLoading: isPending,
    isAuthenticated: session?.isAuthenticated || false,
    isAnonymous: !session?.isAuthenticated && !isPending,
    session,
    error,
    refetch: fetchSession,
    getToken,
  };
};

/**
 * Hook for session data compatible with better-auth interface
 */
export const useSession = () => {
  const auth = useAuth();

  return {
    data: auth.session,
    isPending: auth.isLoading,
    error: auth.error,
    refetch: auth.refetch,
  };
};

/**
 * Sign in with Kinde
 */
export const signIn = () => {
  window.location.href = "/api/auth/login";
};

/**
 * Sign up with Kinde
 */
export const signUp = () => {
  window.location.href = "/api/auth/register";
};

/**
 * Sign out with Kinde
 */
export const signOut = () => {
  window.location.href = "/api/auth/logout";
};

// Export for compatibility
export { signIn as login, signUp as register, signOut as logout };
