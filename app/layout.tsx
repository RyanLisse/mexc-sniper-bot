import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "../src/components/query-provider";
import { KindeAuthProvider } from "../src/components/auth/kinde-auth-provider";

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
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <KindeAuthProvider>
          <QueryProvider>{children}</QueryProvider>
        </KindeAuthProvider>
      </body>
    </html>
  );
}
