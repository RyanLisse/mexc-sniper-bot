"use client";

import { AlertTriangle, Info, Settings as SettingsIcon, Zap } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";

/**
 * Simplified Automation Settings
 *
 * Replaces the confusing multiple toggles (autoSnipeEnabled, autoBuyEnabled, autoSellEnabled)
 * with a single clear "Auto-Sniping" switch that users can easily understand.
 *
 * This consolidates all automation into one simple control:
 * - Auto-Sniping: Automatically trade when patterns are detected
 * - Includes buying, selling, and position management
 * - Clear on/off with descriptive explanations
 */

interface SimplifiedAutomationSettingsProps {
  autoSnipingEnabled?: boolean;
  onAutoSnipingChange?: (enabled: boolean) => void;
  isLoading?: boolean;
  className?: string;
}

export function SimplifiedAutomationSettings({
  autoSnipingEnabled = true,
  onAutoSnipingChange,
  isLoading = false,
  className = "",
}: SimplifiedAutomationSettingsProps) {
  const [_isDirty, setIsDirty] = useState(false);

  const handleToggle = (enabled: boolean) => {
    setIsDirty(true);
    onAutoSnipingChange?.(enabled);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Auto-Sniping Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Trading Automation
          </CardTitle>
          <CardDescription>
            Control automated trading behavior for new MEXC listings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Single Auto-Sniping Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="space-y-2 flex-1">
              <Label htmlFor="auto-sniping" className="text-base font-medium">
                Auto-Sniping
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically detect patterns, buy new listings, and manage positions
              </p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Detects ready-state patterns in new listings</p>
                <p>• Automatically places buy orders when patterns match</p>
                <p>• Manages positions with stop-loss and take-profit</p>
                <p>• Handles selling when targets are reached</p>
              </div>
            </div>
            <div className="ml-6">
              <Switch
                id="auto-sniping"
                checked={autoSnipingEnabled}
                onCheckedChange={handleToggle}
                disabled={isLoading}
                className="data-[state=checked]:bg-green-600"
              />
            </div>
          </div>

          {/* Status Explanation */}
          <div
            className={`p-3 rounded-lg border ${
              autoSnipingEnabled
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-gray-50 border-gray-200 text-gray-600"
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  autoSnipingEnabled ? "bg-green-500" : "bg-gray-400"
                }`}
              />
              <span className="font-medium">
                {autoSnipingEnabled ? "Auto-Sniping Active" : "Auto-Sniping Stopped"}
              </span>
            </div>
            <p className="text-sm mt-1">
              {autoSnipingEnabled
                ? "The system will automatically trade when profitable patterns are detected in new MEXC listings."
                : "No automated trading will occur. You can manually trade through the interface."}
            </p>
          </div>

          {/* Safety Information */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Auto-sniping uses real funds and carries trading risks.
              The system includes safety controls like stop-loss orders and position limits, but you
              should monitor your account regularly and understand the risks involved.
            </AlertDescription>
          </Alert>

          {/* Advanced Settings Link */}
          <div className="pt-4 border-t">
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              Advanced Configuration
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              Configure position sizes, risk limits, and pattern preferences
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Migration Information for Existing Users */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-blue-800">Simplified Controls</span>
          </div>
          <p className="text-sm text-blue-700">
            We've simplified the automation settings. The single "Auto-Sniping" toggle now controls
            all trading automation, including buying, selling, and position management. This
            replaces the previous separate toggles for a clearer user experience.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default SimplifiedAutomationSettings;
