"use client";

import { createAuthClient } from "better-auth/client";
import { useEffect, useState } from "react";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:3008",
});

export const { signIn, signUp, signOut } = authClient;

// Custom useSession hook that uses the correct endpoint
export const useSession = () => {
  const [session, setSession] = useState<any>(null);
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchSession = async () => {
    try {
      setIsPending(true);
      setError(null);
      const response = await fetch("/api/auth/get-session", {
        credentials: "include", // Important for cookies
      });

      if (response.ok) {
        const sessionData = await response.json();
        setSession(sessionData);
      } else {
        setSession(null);
      }
    } catch (err) {
      setError(err);
      setSession(null);
    } finally {
      setIsPending(false);
    }
  };

  useEffect(() => {
    fetchSession();

    // Listen for auth events to refetch session
    const handleAuthChange = () => {
      fetchSession();
    };

    window.addEventListener("auth-state-change", handleAuthChange);

    return () => {
      window.removeEventListener("auth-state-change", handleAuthChange);
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
