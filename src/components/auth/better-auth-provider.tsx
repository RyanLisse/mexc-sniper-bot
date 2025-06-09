"use client";

import { authClient } from "@/src/lib/auth-client";
import { AuthUIProvider } from "@daveyplate/better-auth-ui";
import type { ReactNode } from "react";

interface BetterAuthProviderProps {
  children: ReactNode;
}

export function BetterAuthProvider({ children }: BetterAuthProviderProps) {
  return <AuthUIProvider authClient={authClient as any}>{children}</AuthUIProvider>;
}
