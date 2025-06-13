"use client";

import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { signIn, signOut, signUp, useAuth } from "@/src/lib/kinde-auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function KindeAuthUI() {
  const { user, isAuthenticated, isLoading } = useAuth();
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
      signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const handleSignIn = () => {
    signIn();
  };

  const handleSignUp = () => {
    signUp();
  };

  // Don't render anything until mounted to prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  // Show loading state
  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="text-center text-slate-400">Loading...</div>
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
      <CardHeader>
        <CardTitle className="text-white">{isSignUp ? "Create Account" : "Welcome Back"}</CardTitle>
        <CardDescription className="text-slate-400">
          {isSignUp ? "Sign up to start using MEXC Sniper Bot" : "Sign in to your account"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isSignUp ? (
          <>
            <Button
              onClick={handleSignUp}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Sign Up
            </Button>
            <Button
              onClick={() => setIsSignUp(false)}
              variant="outline"
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              Already have an account? Sign In
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={handleSignIn}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Sign In
            </Button>
            <Button
              onClick={() => setIsSignUp(true)}
              variant="outline"
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              Don't have an account? Sign Up
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
