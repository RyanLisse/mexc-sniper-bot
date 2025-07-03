import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { HydrationWrapper } from "../src/components/auth/hydration-wrapper";
import { SupabaseAuthProvider } from "../src/components/auth/supabase-auth-provider-clean";
import { StatusProviderWrapper } from "../src/components/providers/status-provider-wrapper";
import { QueryProvider } from "../src/components/query-provider";
import { Toaster } from "../src/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MEXC Sniper Bot - AI Trading Platform",
  description:
    "Advanced AI-powered cryptocurrency trading bot for MEXC exchange with pattern detection and automated execution",
  icons: {
    icon: "/newspaper-icon.svg",
    shortcut: "/newspaper-icon.svg",
    apple: "/newspaper-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <HydrationWrapper fallback={<div className="min-h-screen bg-background animate-pulse" />}>
          <SupabaseAuthProvider>
            <QueryProvider>
              <StatusProviderWrapper>
                {children}
                <Toaster />
              </StatusProviderWrapper>
            </QueryProvider>
          </SupabaseAuthProvider>
        </HydrationWrapper>
      </body>
    </html>
  );
}
