"use client";

import { LogoutLink } from "@kinde-oss/kinde-auth-nextjs/components";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signIn, signUp, useAuth } from "../../lib/kinde-auth-client";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

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
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (isAuthenticated) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Welcome back!</CardTitle>
          <CardDescription className="text-muted-foreground">
            Signed in as {user?.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LogoutLink className="w-full">
            <Button variant="outline" className="w-full">
              Sign Out
            </Button>
          </LogoutLink>
          <Button onClick={() => router.push("/dashboard")} className="w-full">
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border shadow-lg">
      <CardHeader>
        <CardTitle className="text-foreground">
          {isSignUp ? "Create Account" : "Welcome Back"}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {isSignUp ? "Sign up to start using MEXC Sniper Bot" : "Sign in to your account"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isSignUp ? (
          <>
            <Button onClick={handleSignUp} className="w-full" size="lg">
              Sign Up
            </Button>
            <Button
              onClick={() => setIsSignUp(false)}
              variant="outline"
              className="w-full"
              size="lg"
            >
              Already have an account? Sign In
            </Button>
          </>
        ) : (
          <>
            <Button onClick={handleSignIn} className="w-full" size="lg">
              Sign In
            </Button>
            <Button
              onClick={() => setIsSignUp(true)}
              variant="outline"
              className="w-full"
              size="lg"
            >
              Don't have an account? Sign Up
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
