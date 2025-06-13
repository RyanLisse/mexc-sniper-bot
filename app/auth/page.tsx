"use client";

import { KindeAuthUI } from "@/src/components/auth/kinde-auth-ui";

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            MEXC Sniper Bot
          </h1>
          <p className="text-gray-400">
            AI-powered cryptocurrency trading platform
          </p>
        </div>

        <KindeAuthUI />

        <div className="mt-8 text-center">
          <a
            href="/"
            className="text-sm text-blue-400 hover:underline"
          >
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}