"use client";
import { Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Separator } from "./ui/separator";

interface RiskSettings {
  stopLossPercent: number;
  riskTolerance: "low" | "medium" | "high";
  maxConcurrentSnipes: number;
  defaultBuyAmount: number;
}

interface RiskManagementProps {
  settings: RiskSettings;
  exitStrategy: string;
  onSettingsChange: (updater: (prev: RiskSettings) => RiskSettings) => void;
  onExitStrategyChange: (strategy: string) => void;
  onDirty: () => void;
}

export function UnifiedRiskManagement({
  settings,
  exitStrategy,
  onSettingsChange,
  onExitStrategyChange,
  onDirty,
}: RiskManagementProps) {
  const updateSetting = (key: string, value: any) => {
    onSettingsChange((prev) => ({ ...prev, [key]: value }));
    onDirty();
  };

  const updateExitStrategy = (strategy: string) => {
    onExitStrategyChange(strategy);
    onDirty();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Risk Management
        </CardTitle>
        <CardDescription>Control your risk exposure and position sizing</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="stop-loss">Stop Loss</Label>
            <div className="flex items-center gap-2">
              <Input
                id="stop-loss"
                type="number"
                min="1"
                max="50"
                step="0.5"
                value={settings.stopLossPercent}
                onChange={(e) =>
                  updateSetting("stopLossPercent", Number.parseFloat(e.target.value) || 5)
                }
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="risk-tolerance">Risk Tolerance</Label>
            <Select
              value={settings.riskTolerance}
              onValueChange={(value) => updateSetting("riskTolerance", value)}
            >
              <SelectTrigger id="risk-tolerance">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low Risk</SelectItem>
                <SelectItem value="medium">Medium Risk</SelectItem>
                <SelectItem value="high">High Risk</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-concurrent">Max Concurrent Positions</Label>
            <Input
              id="max-concurrent"
              type="number"
              min="1"
              max="10"
              value={settings.maxConcurrentSnipes}
              onChange={(e) =>
                updateSetting("maxConcurrentSnipes", Number.parseInt(e.target.value) || 3)
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-buy">Default Buy Amount</Label>
            <div className="flex items-center gap-2">
              <Input
                id="default-buy"
                type="number"
                min="10"
                max="10000"
                step="10"
                value={settings.defaultBuyAmount}
                onChange={(e) =>
                  updateSetting("defaultBuyAmount", Number.parseFloat(e.target.value) || 100)
                }
              />
              <span className="text-sm text-muted-foreground">USDT</span>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="exit-strategy">Exit Strategy</Label>
          <Select value={exitStrategy} onValueChange={updateExitStrategy}>
            <SelectTrigger id="exit-strategy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="conservative">
                Conservative - Early exits, preserve capital
              </SelectItem>
              <SelectItem value="balanced">Balanced - Mix of safety and growth</SelectItem>
              <SelectItem value="aggressive">Aggressive - Hold for maximum gains</SelectItem>
              <SelectItem value="custom">Custom - Define your own strategy</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
