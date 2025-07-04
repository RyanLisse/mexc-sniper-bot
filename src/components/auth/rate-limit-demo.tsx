"use client";

import { useState } from "react";
import { RateLimitNotice } from "./rate-limit-notice";
import { SupabaseRateLimitHandler } from "@/src/lib/supabase-rate-limit-handler";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

/**
 * Demo component to showcase rate limit integration functionality
 * This shows how the RateLimitNotice component works with different scenarios
 */
export function RateLimitDemo() {
  const [rateLimitInfo, setRateLimitInfo] = useState<any>(null);
  const [testEmail, setTestEmail] = useState("test@example.com");

  const simulateEmailRateLimit = () => {
    const mockError = {
      message: "email rate limit exceeded",
      status: 429,
      headers: {
        'retry-after': '1800'
      }
    };

    const analysis = SupabaseRateLimitHandler.analyzeRateLimitError(mockError);
    setRateLimitInfo(analysis);
  };

  const simulateOTPRateLimit = () => {
    const mockError = {
      message: "otp rate limit exceeded",
      status: 429,
      headers: {
        'retry-after': '60'
      }
    };

    const analysis = SupabaseRateLimitHandler.analyzeRateLimitError(mockError);
    setRateLimitInfo(analysis);
  };

  const simulateMFARateLimit = () => {
    const mockError = {
      message: "mfa rate limit exceeded",
      status: 429,
      headers: {
        'retry-after': '300'
      }
    };

    const analysis = SupabaseRateLimitHandler.analyzeRateLimitError(mockError);
    setRateLimitInfo(analysis);
  };

  const clearRateLimit = () => {
    setRateLimitInfo(null);
  };

  const handleRetry = () => {
    console.log("Retry button clicked");
    clearRateLimit();
  };

  const handleBypassEmail = async (email: string) => {
    console.log(`Bypass email clicked for: ${email}`);
    // In a real scenario, this would call the actual bypass function
    setTimeout(() => {
      setRateLimitInfo(null);
    }, 1000);
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Rate Limit Integration Demo</CardTitle>
          <CardDescription>
            This demonstrates how the authentication UI handles different rate limit scenarios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-email">Test Email</Label>
            <Input
              id="test-email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Enter test email"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Simulate Rate Limits</h3>
              <div className="space-y-2">
                <Button 
                  onClick={simulateEmailRateLimit}
                  variant="outline"
                  className="w-full"
                >
                  Email Rate Limit (30 min)
                </Button>
                <Button 
                  onClick={simulateOTPRateLimit}
                  variant="outline"
                  className="w-full"
                >
                  OTP Rate Limit (1 min)
                </Button>
                <Button 
                  onClick={simulateMFARateLimit}
                  variant="outline"
                  className="w-full"
                >
                  MFA Rate Limit (5 min)
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Controls</h3>
              <Button 
                onClick={clearRateLimit}
                variant="destructive"
                className="w-full"
              >
                Clear Rate Limit
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {rateLimitInfo?.isRateLimited && (
        <RateLimitNotice
          rateLimitInfo={rateLimitInfo}
          onRetry={handleRetry}
          onBypassEmail={handleBypassEmail}
          userEmail={testEmail}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Rate Limit Analysis</CardTitle>
          <CardDescription>
            Current rate limit information (for debugging)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rateLimitInfo ? (
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(rateLimitInfo, null, 2)}
            </pre>
          ) : (
            <p className="text-muted-foreground">No rate limit active</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integration Features</CardTitle>
          <CardDescription>
            Key features of the rate limit integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Automatic rate limit detection from Supabase errors</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Real-time countdown timer with progress indicator</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Different handling for email, OTP, and MFA rate limits</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Development mode bypass functionality</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>User-friendly error messages and suggestions</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Automatic retry when rate limit expires</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Global error handling for auth state changes</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}