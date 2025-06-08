"use client";

import { createAuthClient } from "better-auth/react";

export const { signIn, signUp, signOut, useSession } = createAuthClient({
  baseURL: "http://localhost:3000",
});

// Helper hook for getting current user with loading state
export const useAuth = () => {
  const session = useSession();

  return {
    user: session.data?.user || null,
    isLoading: session.isPending,
    isAuthenticated: !!session.data?.user,
    isAnonymous: !session.data?.user, // Not authenticated = anonymous
    session: session.data,
  };
};
