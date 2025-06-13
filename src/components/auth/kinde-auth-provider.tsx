"use client";

import { KindeProvider } from "@kinde-oss/kinde-auth-nextjs";
import type { ReactNode } from "react";

interface KindeAuthProviderProps {
  children: ReactNode;
}

export function KindeAuthProvider({ children }: KindeAuthProviderProps) {
  return <KindeProvider>{children}</KindeProvider>;
}
