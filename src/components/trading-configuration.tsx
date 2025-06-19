"use client";

import type { UserTradingPreferences } from "../hooks/use-user-preferences";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

interface TradingConfigurationProps {
  preferences: UserTradingPreferences | null;
}

export function TradingConfiguration({ preferences }: TradingConfigurationProps) {
  if (!preferences) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trading Configuration</CardTitle>
          <CardDescription>Your current trading setup and risk management settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            No preferences found. Default settings will be used.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trading Configuration</CardTitle>
        <CardDescription>Your current trading setup and risk management settings</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TradingBasicSettings preferences={preferences} />
          <TradingAdvancedSettings preferences={preferences} />
        </div>
      </CardContent>
    </Card>
  );
}

function TradingBasicSettings({ preferences }: { preferences: UserTradingPreferences }) {
  return (
    <div className="space-y-4">
      <ConfigItem label="Default Buy Amount" value={`$${preferences.defaultBuyAmountUsdt} USDT`} />
      <ConfigItem
        label="Max Concurrent Snipes"
        value={preferences.maxConcurrentSnipes.toString()}
      />
      <ConfigItem
        label="Stop Loss"
        value={`${preferences.stopLossPercent}%`}
        valueClassName="text-red-500"
      />
    </div>
  );
}

function TradingAdvancedSettings({ preferences }: { preferences: UserTradingPreferences }) {
  const readyStatePattern = preferences.readyStatePattern as number[] | string;
  const pattern = Array.isArray(readyStatePattern)
    ? readyStatePattern
    : typeof readyStatePattern === "string"
      ? readyStatePattern.split(",").map(Number)
      : [2, 2, 4];

  return (
    <div className="space-y-4">
      <div>
        <span className="text-sm font-medium text-muted-foreground">Risk Tolerance</span>
        <div className="flex items-center space-x-2">
          <Badge
            variant={preferences.riskTolerance === "low" ? "default" : "secondary"}
            className={preferences.riskTolerance === "low" ? "bg-green-500" : ""}
          >
            {preferences.riskTolerance.toUpperCase()}
          </Badge>
        </div>
      </div>

      <div>
        <span className="text-sm font-medium text-muted-foreground">Ready State Pattern</span>
        <div className="text-lg font-semibold font-mono">
          sts:{pattern[0]}, st:{pattern[1]}, tt:{pattern[2]}
        </div>
      </div>

      <ConfigItem label="Target Advance Notice" value={`${preferences.targetAdvanceHours} hours`} />
    </div>
  );
}

interface ConfigItemProps {
  label: string;
  value: string;
  valueClassName?: string;
}

function ConfigItem({ label, value, valueClassName = "" }: ConfigItemProps) {
  return (
    <div>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className={`text-lg font-semibold ${valueClassName}`}>{value}</div>
    </div>
  );
}
