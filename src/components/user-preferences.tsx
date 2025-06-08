"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { useUserPreferences } from "@/src/hooks/use-user-preferences";
import { ApiCredentialsForm } from "./api-credentials-form";
import { TakeProfitLevels } from "./take-profit-levels";
import { TradingConfiguration } from "./trading-configuration";

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
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-5/6"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <TakeProfitLevels userId={userId} />
      <TradingConfiguration preferences={preferences} />
      <ApiCredentialsForm userId={userId} />
    </div>
  );
}
