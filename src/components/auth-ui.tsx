"use client";

import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { signIn, signOut, signUp, useAuth } from "@/src/lib/auth-client";
import {
  detectSuspiciousInput,
  sanitizeAuthInput,
  validateAuthInput,
} from "@/src/lib/input-sanitizer";
import { Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: authentication UI
export function AuthUI() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const validateForm = () => {
    // First sanitize the inputs
    const sanitizedInput = sanitizeAuthInput({
      email: formData.email,
      password: formData.password,
      name: isSignUp ? formData.name : undefined,
    });

    // Check for suspicious input patterns
    const allInputs = [formData.email, formData.password, formData.name].filter(Boolean);
    const hasSuspiciousInput = allInputs.some((input) => detectSuspiciousInput(input));

    if (hasSuspiciousInput) {
      setErrors({ general: "Invalid input detected. Please check your entries." });
      return false;
    }

    // Validate sanitized inputs
    const validationErrors = validateAuthInput(sanitizedInput);

    if (validationErrors.length > 0) {
      const errorMap: Record<string, string> = {};

      validationErrors.forEach((error) => {
        if (error.toLowerCase().includes("email")) {
          errorMap.email = error;
        } else if (error.toLowerCase().includes("password")) {
          errorMap.password = error;
        } else if (error.toLowerCase().includes("name")) {
          errorMap.name = error;
        } else {
          errorMap.general = error;
        }
      });

      setErrors(errorMap);
      return false;
    }

    // Update form data with sanitized values
    setFormData({
      email: sanitizedInput.email,
      password: sanitizedInput.password,
      name: sanitizedInput.name || "",
    });

    setErrors({});
    return true;
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: auth handler is verbose
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      if (isSignUp) {
        const result = await signUp.email({
          email: formData.email,
          password: formData.password,
          name: formData.name,
        });

        if (result.error) {
          setErrors({ general: result.error.message || "Failed to create account" });
        } else {
          // Success - emit auth change event and redirect to dashboard
          setErrors({ general: "" });
          window.dispatchEvent(new Event("auth-state-change"));
          router.push("/dashboard");
        }
      } else {
        const result = await signIn.email({
          email: formData.email,
          password: formData.password,
        });

        if (result.error) {
          setErrors({ general: result.error.message || "Invalid email or password" });
        } else {
          // Success - emit auth change event and redirect to dashboard
          setErrors({ general: "" });
          window.dispatchEvent(new Event("auth-state-change"));
          router.push("/dashboard");
        }
      }
    } catch (error) {
      console.error("Auth error:", error);
      setErrors({ general: "An unexpected error occurred. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field-specific error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      window.dispatchEvent(new Event("auth-state-change"));
      router.push("/");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  // Handle pre-hydration state
  if (!mounted || isLoading) {
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
        <CardContent>
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            Sign Out
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
        <form onSubmit={handleAuth} className="space-y-4">
          {/* Name Input (Sign Up Only) */}
          {isSignUp && (
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-white">
                Full Name
              </label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter your full name"
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                disabled={isSubmitting}
              />
              {errors.name && <p className="text-sm text-red-400">{errors.name}</p>}
            </div>
          )}

          {/* Email Input */}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-white">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              placeholder="Enter your email"
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
              disabled={isSubmitting}
            />
            {errors.email && <p className="text-sm text-red-400">{errors.email}</p>}
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-white">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                placeholder="Enter your password"
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 pr-10"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-sm text-red-400">{errors.password}</p>}
          </div>

          {/* General Error Message */}
          {errors.general && (
            <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg">
              <p className="text-sm text-red-400">{errors.general}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {isSignUp ? "Creating Account..." : "Signing In..."}
              </div>
            ) : (
              <div className="flex items-center">
                {isSignUp ? (
                  <UserPlus className="h-4 w-4 mr-2" />
                ) : (
                  <LogIn className="h-4 w-4 mr-2" />
                )}
                {isSignUp ? "Create Account" : "Sign In"}
              </div>
            )}
          </Button>
        </form>

        {/* Toggle Sign In/Sign Up */}
        <div className="text-center pt-4 border-t border-slate-700 space-y-2">
          <p className="text-sm text-slate-400">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}
          </p>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setFormData({ email: "", password: "", name: "" });
              setErrors({});
            }}
            className="text-blue-400 hover:text-blue-300 text-sm font-medium"
            disabled={isSubmitting}
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
