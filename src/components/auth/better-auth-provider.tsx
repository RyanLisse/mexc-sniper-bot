"use client";

import { authClient } from "@/src/lib/auth-client";
import { AuthUIProvider } from "@daveyplate/better-auth-ui";
import type { ReactNode } from "react";

interface BetterAuthProviderProps {
  children: ReactNode;
}

export function BetterAuthProvider({ children }: BetterAuthProviderProps) {
  // Type assertion: authClient from createAuthClient has compatible interface with AuthUIProvider
  // The difference is in useSession implementation (Atom vs function) but runtime behavior is correct
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const compatibleAuthClient = authClient as any;

  return <AuthUIProvider authClient={compatibleAuthClient}>{children}</AuthUIProvider>;
}
