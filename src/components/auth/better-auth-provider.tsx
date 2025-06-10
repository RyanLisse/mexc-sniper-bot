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
  const compatibleAuthClient = authClient as unknown as Parameters<
    typeof AuthUIProvider
  >[0]["authClient"];

  return <AuthUIProvider authClient={compatibleAuthClient}>{children}</AuthUIProvider>;
}
