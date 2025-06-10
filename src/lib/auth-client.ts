"use client";

import { createAuthClient } from "better-auth/client";
import { usernameClient } from "better-auth/client/plugins";
import { useEffect, useState } from "react";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:3008",
  plugins: [usernameClient()],
});

export const { signIn, signUp, signOut, forgetPassword, resetPassword, updateUser } = authClient;

// Use Better Auth's built-in session hook with improved error handling
export const useSession = () => {
  const [session, setSession] = useState<unknown>(null);
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const fetchSession = async () => {
    try {
      setIsPending(true);
      setError(null);

      // Add timeout to prevent hanging requests
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Session fetch timeout")), 10000)
      );

      const sessionPromise = authClient.getSession();
      const sessionData = (await Promise.race([sessionPromise, timeoutPromise])) as unknown;

      // Validate session data structure
      if (sessionData && typeof sessionData === "object") {
        setSession(sessionData.data || sessionData);
      } else {
        console.warn("Invalid session data received:", sessionData);
        setSession(null);
      }
    } catch (err) {
      console.error("Session fetch error:", err);
      setError(err);
      setSession(null);
    } finally {
      setIsPending(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchSession stable
  useEffect(() => {
    // Add a small delay to prevent race conditions
    const timer = setTimeout(() => {
      fetchSession();
    }, 100);

    // Listen for auth events to refetch session
    const handleAuthChange = () => {
      console.log("Auth state change detected, refetching session");
      fetchSession();
    };

    // Listen for storage changes (for cross-tab auth state sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.includes("better-auth") || e.key?.includes("session")) {
        console.log("Auth storage change detected, refetching session");
        fetchSession();
      }
    };

    window.addEventListener("auth-state-change", handleAuthChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("auth-state-change", handleAuthChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return {
    data: session,
    isPending,
    error,
    refetch: fetchSession,
  };
};

// Helper hook for getting current user with loading state
export const useAuth = () => {
  const session = useSession();

  return {
    user: session.data?.user || null,
    isLoading: session.isPending,
    isAuthenticated: !!session.data?.user && !session.isPending,
    isAnonymous: !session.data?.user && !session.isPending, // Only consider anonymous if not loading
    session: session.data,
  };
};
