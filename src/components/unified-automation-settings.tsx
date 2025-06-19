"use client";
import { Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { Switch } from "./ui/switch";

interface AutomationSettings {
  autoSnipeEnabled: boolean;
  autoBuyEnabled: boolean;
  autoSellEnabled: boolean;
}

interface AutomationSettingsProps {
  settings: AutomationSettings;
  onSettingsChange: (updater: (prev: AutomationSettings) => AutomationSettings) => void;
  onDirty: () => void;
}

export function UnifiedAutomationSettings({
  settings,
  onSettingsChange,
  onDirty,
}: AutomationSettingsProps) {
  const updateSetting = (key: string, value: boolean) => {
    onSettingsChange((prev) => ({ ...prev, [key]: value }));
    onDirty();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Automation Settings
        </CardTitle>
        <CardDescription>Configure automated trading behaviors</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-snipe">Auto-Snipe New Listings</Label>
              <p className="text-xs text-muted-foreground">
                Automatically execute trades when patterns are detected
              </p>
            </div>
            <Switch
              id="auto-snipe"
              checked={settings.autoSnipeEnabled}
              onCheckedChange={(checked) => updateSetting("autoSnipeEnabled", checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-buy">Auto-Buy on Ready State</Label>
              <p className="text-xs text-muted-foreground">
                Automatically place buy orders when coins are ready
              </p>
            </div>
            <Switch
              id="auto-buy"
              checked={settings.autoBuyEnabled}
              onCheckedChange={(checked) => updateSetting("autoBuyEnabled", checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="auto-sell">Auto-Sell at Targets</Label>
              <p className="text-xs text-muted-foreground">
                Automatically sell when take profit targets are reached
              </p>
            </div>
            <Switch
              id="auto-sell"
              checked={settings.autoSellEnabled}
              onCheckedChange={(checked) => updateSetting("autoSellEnabled", checked)}
            />
          </div>
        </div>

        <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/20 p-4">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            <strong>Warning:</strong> Automated trading carries risks. Always monitor your positions
            and ensure you understand the implications of automated execution.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
