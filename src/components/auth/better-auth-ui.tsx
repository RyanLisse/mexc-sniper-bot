"use client";

import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { useAuth } from "@/src/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CustomSignInForm, CustomSignUpForm } from "./better-auth-forms";

export function BetterAuthUI() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Fix hydration by ensuring consistent rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (mounted && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [mounted, isAuthenticated, router]);

  const handleSignOut = async () => {
    try {
      // Better Auth UI handles sign out through the authClient
      const { signOut } = await import("@/src/lib/auth-client");
      await signOut();
      router.push("/");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  // Handle pre-hydration state
  if (!mounted) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
            <span className="ml-2 text-slate-300">Loading...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isAuthenticated) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">Welcome back!</CardTitle>
          <CardDescription className="text-slate-400">Signed in as {user?.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            Sign Out
          </Button>
          <Button
            onClick={() => router.push("/dashboard")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl text-white">
          {isSignUp ? "Create Account" : "Sign In"}
        </CardTitle>
        <CardDescription className="text-slate-400">
          {isSignUp
            ? "Create your account to start trading with AI-powered strategies"
            : "Sign in to access your trading dashboard"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Custom Auth Forms with proper HTTP methods */}
        <div className="better-auth-form">
          {isSignUp ? (
            <CustomSignUpForm className="space-y-4" />
          ) : (
            <CustomSignInForm className="space-y-4" />
          )}
        </div>

        {/* Toggle Sign In/Sign Up */}
        <div className="text-center pt-4 border-t border-slate-700 space-y-2">
          <p className="text-sm text-slate-400">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}
          </p>
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-blue-400 hover:text-blue-300 text-sm font-medium"
          >
            {isSignUp ? "Sign in here" : "Create account here"}
          </button>
          <br />
          <a href="/dashboard" className="text-slate-500 hover:text-slate-400 text-xs">
            ← Back to dashboard
          </a>
        </div>

        {/* Security Notice */}
        <div className="text-center text-xs text-slate-500 pt-2">
          <p>Your data is encrypted and stored securely</p>
        </div>
      </CardContent>
    </Card>
  );
}
