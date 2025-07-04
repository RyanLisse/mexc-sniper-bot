"use client";

import { AlertTriangle, Clock, Mail, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import {
  isBrowserEnvironment,
  isNodeEnvironment,
} from "@/src/lib/browser-compatible-events";
import {
  type RateLimitInfo,
  SupabaseRateLimitHandler,
} from "@/src/lib/supabase-rate-limit-handler";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";

interface RateLimitNoticeProps {
  rateLimitInfo: RateLimitInfo;
  onRetry?: () => void;
  onBypassEmail?: (email: string) => void;
  userEmail?: string;
}

export function RateLimitNotice({
  rateLimitInfo,
  onRetry,
  onBypassEmail,
  userEmail,
}: RateLimitNoticeProps) {
  const [timeRemaining, setTimeRemaining] = useState(
    rateLimitInfo.retryAfter || 0
  );
  const [canRetry, setCanRetry] = useState(false);

  useEffect(() => {
    if (!rateLimitInfo.retryAfter) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setCanRetry(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [rateLimitInfo.retryAfter]);

  const handleBypassEmail = async () => {
    if (!userEmail || !onBypassEmail) return;
    await onBypassEmail(userEmail);
  };

  const getIcon = () => {
    switch (rateLimitInfo.limitType) {
      case "email":
        return <Mail className="h-5 w-5" />;
      case "mfa":
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <Clock className="h-5 w-5" />;
    }
  };

  const getProgressValue = () => {
    if (!rateLimitInfo.retryAfter) return 0;
    return (
      ((rateLimitInfo.retryAfter - timeRemaining) / rateLimitInfo.retryAfter) *
      100
    );
  };

  const isDevelopment = process.env.NODE_ENV === "development";

  return (
    <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
          {getIcon()}
          Rate Limit Exceeded
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Authentication Temporarily Limited</AlertTitle>
          <AlertDescription className="mt-2">
            {rateLimitInfo.message}
          </AlertDescription>
        </Alert>

        {rateLimitInfo.suggestion && (
          <div className="text-sm text-muted-foreground">
            <strong>Suggestion:</strong> {rateLimitInfo.suggestion}
          </div>
        )}

        {timeRemaining > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Time remaining:</span>
              <span className="font-mono">
                {SupabaseRateLimitHandler.formatTimeRemaining(timeRemaining)}
              </span>
            </div>
            <Progress value={getProgressValue()} className="h-2" />
          </div>
        )}

        <div className="flex flex-col gap-2">
          {canRetry && onRetry && (
            <Button onClick={onRetry} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}

          {isDevelopment &&
            userEmail &&
            onBypassEmail &&
            rateLimitInfo.limitType === "email" && (
              <Button
                onClick={handleBypassEmail}
                variant="outline"
                className="w-full"
              >
                <Mail className="h-4 w-4 mr-2" />
                Bypass Email Confirmation (Dev Only)
              </Button>
            )}
        </div>

        {isDevelopment && (
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <AlertDescription className="text-xs">
              <strong>Development Mode:</strong> You can use the bypass tools to
              work around rate limits. This is not available in production.
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <div>
            <strong>Limit Type:</strong> {rateLimitInfo.limitType || "Unknown"}
          </div>
          <div>
            <strong>Environment:</strong> {process.env.NODE_ENV}
          </div>
          {rateLimitInfo.limitType === "email" && (
            <div className="text-yellow-600 dark:text-yellow-400">
              ⚠️ Supabase allows only 2 emails per hour without custom SMTP
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
