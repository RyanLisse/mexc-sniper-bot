"use client";

import { ExternalLink, Settings } from "lucide-react";
import { useUserPreferences } from "../hooks/use-user-preferences";
import { TakeProfitLevels } from "./take-profit-levels";
import { TradingConfiguration } from "./trading-configuration";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

interface UserPreferencesProps {
  userId: string;
}

export function UserPreferences({ userId }: UserPreferencesProps) {
  const { data: preferences, isLoading: preferencesLoading } = useUserPreferences(userId);

  if (preferencesLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Preferences</CardTitle>
          <CardDescription>Loading your trading preferences...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-5/6" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* API Configuration Notice */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Settings className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">API Configuration Required</p>
              <p className="text-xs text-muted-foreground">
                Configure your MEXC API credentials and system settings in System Check before using
                trading features
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("/config", "_self")}
              className="border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              System Check
            </Button>
          </div>
        </CardContent>
      </Card>

      <TakeProfitLevels userId={userId} />
      <TradingConfiguration preferences={preferences || null} />
    </div>
  );
}
