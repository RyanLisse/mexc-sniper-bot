"use client";

import { KindeAuthUI } from "../../src/components/auth/kinde-auth-ui";
import { Zap, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              MEXC Sniper
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            AI-powered cryptocurrency trading platform
          </p>
        </div>

        <KindeAuthUI />

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}