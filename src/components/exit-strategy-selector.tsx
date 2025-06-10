"use client";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import {
  EXIT_STRATEGIES,
  type ExitLevel,
  type ExitStrategy,
  createCustomStrategy,
  validateExitStrategy,
} from "@/src/types/exit-strategies";
import { Plus, Shield, Target, Trash2, TrendingUp, Zap } from "lucide-react";
import { useCallback } from "react";
import { useEffect, useState } from "react";

interface ExitStrategySelectorProps {
  selectedStrategy: string;
  customStrategy?: ExitStrategy;
  autoBuyEnabled: boolean;
  autoSellEnabled: boolean;
  onStrategyChange: (strategyId: string) => void;
  onCustomStrategyChange: (strategy: ExitStrategy) => void;
  onAutoBuyToggle: (enabled: boolean) => void;
  onAutoSellToggle: (enabled: boolean) => void;
}

export function ExitStrategySelector({
  selectedStrategy,
  customStrategy,
  autoBuyEnabled,
  autoSellEnabled,
  onStrategyChange,
  onCustomStrategyChange,
  onAutoBuyToggle,
  onAutoSellToggle,
}: ExitStrategySelectorProps) {
  const [customLevels, setCustomLevels] = useState<ExitLevel[]>(
    customStrategy?.levels || [
      { percentage: 25, targetMultiplier: 1.5, profitPercent: 50 },
      { percentage: 35, targetMultiplier: 2.0, profitPercent: 100 },
      { percentage: 40, targetMultiplier: 3.0, profitPercent: 200 },
    ]
  );
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const getStrategyIcon = (strategyId: string) => {
    switch (strategyId) {
      case "conservative":
        return <Shield className="h-5 w-5 text-blue-400" />;
      case "balanced":
        return <Target className="h-5 w-5 text-green-400" />;
      case "aggressive":
        return <Zap className="h-5 w-5 text-red-400" />;
      default:
        return <TrendingUp className="h-5 w-5 text-purple-400" />;
    }
  };

  const validateCustomStrategy = useCallback(() => {
    const strategy = createCustomStrategy(customLevels);
    const errors = validateExitStrategy(strategy);
    setValidationErrors(errors);
    return errors.length === 0;
  }, [customLevels]);

  useEffect(() => {
    if (selectedStrategy === "custom") {
      validateCustomStrategy();
    }
  }, [selectedStrategy, validateCustomStrategy]);

  const handleCustomLevelChange = (index: number, field: keyof ExitLevel, value: number) => {
    const newLevels = [...customLevels];
    newLevels[index] = { ...newLevels[index], [field]: value };

    // Auto-calculate profit percent when multiplier changes
    if (field === "targetMultiplier") {
      newLevels[index].profitPercent = (value - 1) * 100;
    }
    // Auto-calculate multiplier when profit percent changes
    if (field === "profitPercent") {
      newLevels[index].targetMultiplier = 1 + value / 100;
    }

    setCustomLevels(newLevels);

    const customStrategy = createCustomStrategy(newLevels);
    onCustomStrategyChange(customStrategy);
  };

  const addCustomLevel = () => {
    const lastLevel = customLevels[customLevels.length - 1];
    const newLevel: ExitLevel = {
      percentage: 10,
      targetMultiplier: lastLevel ? lastLevel.targetMultiplier + 0.5 : 2.0,
      profitPercent: lastLevel ? lastLevel.profitPercent + 50 : 100,
    };
    setCustomLevels([...customLevels, newLevel]);
  };

  const removeCustomLevel = (index: number) => {
    if (customLevels.length > 1) {
      const newLevels = customLevels.filter((_, i) => i !== index);
      setCustomLevels(newLevels);
      onCustomStrategyChange(createCustomStrategy(newLevels));
    }
  };

  const saveCustomStrategy = () => {
    if (validateCustomStrategy()) {
      const strategy = createCustomStrategy(customLevels);
      onCustomStrategyChange(strategy);
      onStrategyChange("custom");
    }
  };

  return (
    <div className="space-y-6">
      {/* Auto-Buy/Auto-Sell Controls */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-green-400" />
            <span>Auto-Trading Controls</span>
          </CardTitle>
          <CardDescription>Configure automatic buy and sell execution</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
              <div>
                <p className="font-medium text-white">Auto-Buy</p>
                <p className="text-sm text-slate-400">Buy when ready state detected</p>
              </div>
              <Button
                variant={autoBuyEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => onAutoBuyToggle(!autoBuyEnabled)}
                className={autoBuyEnabled ? "bg-green-600 hover:bg-green-700" : ""}
              >
                {autoBuyEnabled ? "ON" : "OFF"}
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
              <div>
                <p className="font-medium text-white">Auto-Sell</p>
                <p className="text-sm text-slate-400">Sell at target levels</p>
              </div>
              <Button
                variant={autoSellEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => onAutoSellToggle(!autoSellEnabled)}
                className={autoSellEnabled ? "bg-green-600 hover:bg-green-700" : ""}
              >
                {autoSellEnabled ? "ON" : "OFF"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exit Strategy Selection */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-blue-400" />
            <span>Exit Strategies</span>
          </CardTitle>
          <CardDescription>Choose how to automatically sell your positions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Predefined Strategies */}
          <div className="grid gap-4">
            {EXIT_STRATEGIES.map((strategy) => (
              <button
                key={strategy.id}
                type="button"
                className={`w-full p-4 rounded-lg border transition-all text-left ${
                  selectedStrategy === strategy.id
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-slate-600 bg-slate-700/30 hover:border-slate-500"
                }`}
                onClick={() => onStrategyChange(strategy.id)}
                aria-pressed={selectedStrategy === strategy.id}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    {getStrategyIcon(strategy.id)}
                    <div>
                      <h3 className="font-semibold text-white flex items-center space-x-2">
                        <span>{strategy.name}</span>
                        {strategy.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </h3>
                      <p className="text-sm text-slate-400">{strategy.description}</p>
                    </div>
                  </div>
                  {selectedStrategy === strategy.id && (
                    <Badge className="bg-blue-600">Selected</Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  {strategy.levels.map((level, _index) => (
                    <div
                      key={`${strategy.id}-level-${level.percentage}-${level.targetMultiplier}`}
                      className="text-center p-2 bg-slate-600/30 rounded"
                    >
                      <div className="font-medium text-white">{level.percentage}%</div>
                      <div className="text-slate-300">at {level.targetMultiplier}x</div>
                      <div className="text-green-400">+{level.profitPercent}%</div>
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>

          {/* Custom Strategy */}
          <div
            className={`p-4 rounded-lg border transition-all ${
              selectedStrategy === "custom"
                ? "border-purple-500 bg-purple-500/10"
                : "border-slate-600 bg-slate-700/30"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <TrendingUp className="h-5 w-5 text-purple-400" />
                <div>
                  <h3 className="font-semibold text-white">Custom Strategy</h3>
                  <p className="text-sm text-slate-400">Create your own exit levels</p>
                </div>
              </div>
              {selectedStrategy === "custom" && <Badge className="bg-purple-600">Selected</Badge>}
            </div>

            {/* Custom Strategy Builder */}
            <div className="space-y-3">
              {customLevels.map((level, index) => (
                <div
                  key={`custom-level-${index}-${level.percentage}-${level.targetMultiplier}`}
                  className="flex items-center space-x-3 p-3 bg-slate-600/30 rounded"
                >
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <div>
                      <label
                        htmlFor={`exit-percentage-${index}`}
                        className="text-xs text-slate-400"
                      >
                        Percentage
                      </label>
                      <Input
                        id={`exit-percentage-${index}`}
                        type="number"
                        min="1"
                        max="100"
                        value={level.percentage}
                        onChange={(e) =>
                          handleCustomLevelChange(index, "percentage", Number(e.target.value))
                        }
                        className="bg-slate-700 border-slate-600"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`target-multiplier-${index}`}
                        className="text-xs text-slate-400"
                      >
                        Target Multiplier
                      </label>
                      <Input
                        id={`target-multiplier-${index}`}
                        type="number"
                        min="1.1"
                        step="0.1"
                        value={level.targetMultiplier}
                        onChange={(e) =>
                          handleCustomLevelChange(index, "targetMultiplier", Number(e.target.value))
                        }
                        className="bg-slate-700 border-slate-600"
                      />
                    </div>
                    <div>
                      <label htmlFor={`profit-percent-${index}`} className="text-xs text-slate-400">
                        Profit %
                      </label>
                      <Input
                        id={`profit-percent-${index}`}
                        type="number"
                        min="10"
                        value={level.profitPercent}
                        onChange={(e) =>
                          handleCustomLevelChange(index, "profitPercent", Number(e.target.value))
                        }
                        className="bg-slate-700 border-slate-600"
                      />
                    </div>
                  </div>
                  {customLevels.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeCustomLevel(index)}
                      className="border-red-600 text-red-400 hover:bg-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addCustomLevel}
                  className="border-slate-600 text-slate-300"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Level
                </Button>

                <Button
                  onClick={saveCustomStrategy}
                  disabled={validationErrors.length > 0}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Use Custom Strategy
                </Button>
              </div>

              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="p-3 bg-red-900/20 border border-red-700 rounded-lg">
                  <p className="text-sm font-medium text-red-400 mb-1">Validation Errors:</p>
                  <ul className="text-sm text-red-300 space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={`validation-error-${index}-${error.slice(0, 10)}`}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
