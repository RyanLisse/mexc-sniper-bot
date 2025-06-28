/**
 * Config Editor Component
 *
 * Advanced configuration editor with Zod validation and form handling
 */

import { Settings } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { AutoSnipingConfig } from "@/src/components/auto-sniping-control-panel";
import type { CoreTradingConfig } from "@/src/services/trading/consolidated/core-trading/types";
import { type AutoSnipingConfigForm, configFormSchema } from "../schemas/validation-schemas";

interface ConfigEditorProps {
  config: AutoSnipingConfig | null;
  configEditMode: boolean;
  tempConfig: Partial<AutoSnipingConfig>;
  isUpdatingConfig: boolean;
  onConfigChange: (field: string, value: string | number | boolean) => void;
  onSaveConfig: () => void;
  onCancelEdit: () => void;
  onEnterEditMode: () => void;
}

interface ValidationErrors {
  [key: string]: string;
}

export function ConfigEditor({
  config,
  configEditMode,
  tempConfig,
  isUpdatingConfig,
  onConfigChange,
  onSaveConfig,
  onCancelEdit,
  onEnterEditMode,
}: ConfigEditorProps) {
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  // AutoSnipingConfig has the following fields:
  // enabled, maxPositionSize, takeProfitPercentage, stopLossPercentage,
  // patternConfidenceThreshold, maxConcurrentTrades, enableSafetyChecks, enablePatternDetection

  const getConfigValue = useCallback(
    (field: keyof AutoSnipingConfig): string | number | boolean | undefined => {
      if (!config) return undefined;

      return configEditMode ? (tempConfig[field] ?? config[field]) : config[field];
    },
    [configEditMode, tempConfig, config]
  );

  // Validate configuration changes
  const validateField = useCallback((field: string, value: unknown) => {
    try {
      const fieldSchema = configFormSchema.shape[field as keyof AutoSnipingConfigForm];
      if (fieldSchema) {
        fieldSchema.parse(value);
        setValidationErrors((prev) => {
          const { [field]: _, ...rest } = prev;
          return rest;
        });
      }
    } catch (error) {
      if (error instanceof Error) {
        setValidationErrors((prev) => ({
          ...prev,
          [field]: error.message,
        }));
      }
    }
  }, []);

  // Enhanced change handler with validation
  const handleConfigChange = useCallback(
    (field: string, value: string | number | boolean) => {
      validateField(field, value);
      onConfigChange(field, value);
    },
    [onConfigChange, validateField]
  );

  // Validate all fields when entering edit mode
  useEffect(() => {
    if (configEditMode && config) {
      const formData = { ...config, ...tempConfig };
      try {
        configFormSchema.parse(formData);
        setValidationErrors({});
      } catch (_error) {
        // Set validation errors for invalid fields
      }
    }
  }, [configEditMode, config, tempConfig]);

  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  if (!config) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-gray-500">Configuration not available</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Execution Configuration
          </CardTitle>
          <CardDescription>
            Configure auto-sniping execution parameters and risk management
          </CardDescription>
        </div>
        <div className="flex gap-2">
          {configEditMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onCancelEdit}
                disabled={isUpdatingConfig}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={onSaveConfig}
                disabled={isUpdatingConfig || hasValidationErrors}
              >
                Save Changes
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={onEnterEditMode}>
              Edit Configuration
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Basic Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Basic Settings</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="enabled">Enable Auto-Sniping</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enabled"
                    checked={getConfigValue("enabled") as boolean}
                    onCheckedChange={(checked) => handleConfigChange("enabled", checked)}
                    disabled={!configEditMode}
                  />
                  <span className="text-sm text-gray-600">
                    {getConfigValue("enabled") ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxPositions">Maximum Positions</Label>
                <Input
                  id="maxPositions"
                  type="number"
                  min="1"
                  max="50"
                  value={getConfigValue("maxConcurrentTrades") as number}
                  onChange={(e) =>
                    handleConfigChange("maxConcurrentTrades", Number.parseInt(e.target.value))
                  }
                  disabled={!configEditMode}
                  className={validationErrors.maxPositions ? "border-red-500" : ""}
                />
                {validationErrors.maxPositions && (
                  <p className="text-sm text-red-500">{validationErrors.maxPositions}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxConcurrentTrades2">Maximum Daily Trades</Label>
                <Input
                  id="maxConcurrentTrades2"
                  type="number"
                  min="1"
                  max="100"
                  value={getConfigValue("maxConcurrentTrades") as number}
                  onChange={(e) =>
                    handleConfigChange("maxConcurrentTrades", Number.parseInt(e.target.value))
                  }
                  disabled={!configEditMode}
                  className={validationErrors.maxConcurrentTrades ? "border-red-500" : ""}
                />
                {validationErrors.maxConcurrentTrades && (
                  <p className="text-sm text-red-500">{validationErrors.maxConcurrentTrades}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="positionSizeUSDT">Position Size (USDT)</Label>
                <Input
                  id="positionSizeUSDT"
                  type="number"
                  min="10"
                  step="10"
                  value={getConfigValue("maxPositionSize") as number}
                  onChange={(e) =>
                    handleConfigChange("maxPositionSize", Number.parseFloat(e.target.value))
                  }
                  disabled={!configEditMode}
                  className={validationErrors.positionSizeUSDT ? "border-red-500" : ""}
                />
                {validationErrors.positionSizeUSDT && (
                  <p className="text-sm text-red-500">{validationErrors.positionSizeUSDT}</p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Pattern Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Pattern Settings</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minConfidence">Minimum Confidence (%)</Label>
                <Input
                  id="minConfidence"
                  type="number"
                  min="0"
                  max="100"
                  value={getConfigValue("patternConfidenceThreshold") as number}
                  onChange={(e) =>
                    handleConfigChange(
                      "patternConfidenceThreshold",
                      Number.parseFloat(e.target.value)
                    )
                  }
                  disabled={!configEditMode}
                  className={validationErrors.minConfidence ? "border-red-500" : ""}
                />
                {validationErrors.minConfidence && (
                  <p className="text-sm text-red-500">{validationErrors.minConfidence}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="enableAdvanceDetection">Enable Advance Detection</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableAdvanceDetection"
                    checked={getConfigValue("enablePatternDetection") as boolean}
                    onCheckedChange={(checked) =>
                      handleConfigChange("enablePatternDetection", checked)
                    }
                    disabled={!configEditMode}
                  />
                  <span className="text-sm text-gray-600">
                    {getConfigValue("enablePatternDetection") ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Risk Management */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Risk Management</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stopLossPercentage">Stop Loss (%)</Label>
                <Input
                  id="stopLossPercentage"
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  value={getConfigValue("stopLossPercentage") as number}
                  onChange={(e) =>
                    handleConfigChange("stopLossPercentage", Number.parseFloat(e.target.value))
                  }
                  disabled={!configEditMode}
                  className={validationErrors.stopLossPercentage ? "border-red-500" : ""}
                />
                {validationErrors.stopLossPercentage && (
                  <p className="text-sm text-red-500">{validationErrors.stopLossPercentage}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="takeProfitPercentage">Take Profit (%)</Label>
                <Input
                  id="takeProfitPercentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={getConfigValue("takeProfitPercentage") as number}
                  onChange={(e) =>
                    handleConfigChange("takeProfitPercentage", Number.parseFloat(e.target.value))
                  }
                  disabled={!configEditMode}
                  className={validationErrors.takeProfitPercentage ? "border-red-500" : ""}
                />
                {validationErrors.takeProfitPercentage && (
                  <p className="text-sm text-red-500">{validationErrors.takeProfitPercentage}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="enableSafetyChecks">Enable Safety Checks</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableSafetyChecks"
                    checked={getConfigValue("enableSafetyChecks") as boolean}
                    onCheckedChange={(checked) => handleConfigChange("enableSafetyChecks", checked)}
                    disabled={!configEditMode}
                  />
                  <span className="text-sm text-gray-600">
                    {getConfigValue("enableSafetyChecks") ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Validation Summary */}
          {hasValidationErrors && configEditMode && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h5 className="text-sm font-medium text-red-800 mb-2">Configuration Errors</h5>
              <ul className="text-sm text-red-700 space-y-1">
                {Object.entries(validationErrors).map(([field, error]) => (
                  <li key={field}>
                    • {field}: {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
