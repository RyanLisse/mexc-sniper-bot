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
import { Label } from "@/src/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
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
            <span>Exit Strategy Configuration</span>
          </CardTitle>
          <CardDescription>
            Advanced profit-taking with multiple exit levels. Sell portions of your position at different price targets to maximize profits while reducing risk.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* How Exit Strategies Work */}
          <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
            <h4 className="font-medium text-blue-300 mb-2 flex items-center gap-2">
              <Target className="h-4 w-4" />
              How Exit Strategies Work
            </h4>
            <p className="text-sm text-blue-200 mb-3">
              Exit strategies automatically sell portions of your position at different price levels. 
              This reduces risk by taking profits gradually instead of waiting for one high target.
            </p>
            <div className="text-xs text-blue-300 space-y-1">
              <div><strong>Example:</strong> Conservative 2x Strategy</div>
              <div>• Sell 20% at 1.3x (+30% profit) - Quick gains</div>
              <div>• Sell 52% at 2.0x (+100% profit) - Main target</div>
              <div>• Sell 28% at 2.5x (+150% profit) - Bonus upside</div>
            </div>
          </div>

          {/* Strategy Selection Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="strategy-select">Exit Strategy</Label>
              <Select value={selectedStrategy} onValueChange={onStrategyChange}>
                <SelectTrigger id="strategy-select" className="bg-slate-700 border-slate-600">
                  <SelectValue placeholder="Select an exit strategy" />
                </SelectTrigger>
                <SelectContent>
                  {EXIT_STRATEGIES.map((strategy) => (
                    <SelectItem key={strategy.id} value={strategy.id}>
                      <div className="flex items-center space-x-2">
                        {getStrategyIcon(strategy.id)}
                        <span>{strategy.name}</span>
                        {strategy.isDefault && (
                          <Badge variant="secondary" className="text-xs ml-2">
                            Default
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="h-4 w-4 text-purple-400" />
                      <span>Custom Strategy</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Selected Strategy Preview - Always show */}
            {selectedStrategy && (
              <div className="p-4 bg-slate-700/30 rounded-lg">
                {selectedStrategy === "custom" ? (
                  <div>
                    <div className="flex items-center space-x-2 mb-3">
                      <TrendingUp className="h-4 w-4 text-purple-400" />
                      <h4 className="font-medium text-white">Custom Strategy</h4>
                    </div>
                    <p className="text-sm text-slate-400 mb-3">Your personalized exit levels</p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      {customLevels.map((level) => (
                        <div
                          key={`custom-preview-${level.percentage}-${level.targetMultiplier}`}
                          className="text-center p-2 bg-slate-600/30 rounded"
                        >
                          <div className="font-medium text-white">{level.percentage}%</div>
                          <div className="text-slate-300">at {level.targetMultiplier}x</div>
                          <div className="text-green-400">+{level.profitPercent}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  (() => {
                    const strategy = EXIT_STRATEGIES.find((s) => s.id === selectedStrategy);
                    return strategy ? (
                      <div>
                        <div className="flex items-center space-x-2 mb-3">
                          {getStrategyIcon(strategy.id)}
                          <h4 className="font-medium text-white">{strategy.name}</h4>
                        </div>
                        <p className="text-sm text-slate-400 mb-3">{strategy.description}</p>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          {strategy.levels.map((level, index) => (
                            <div
                              key={`preview-${strategy.id}-level-${index}`}
                              className="text-center p-2 bg-slate-600/30 rounded"
                            >
                              <div className="font-medium text-white">{level.percentage}%</div>
                              <div className="text-slate-300">at {level.targetMultiplier}x</div>
                              <div className="text-green-400">+{level.profitPercent}%</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()
                )}
              </div>
            )}
          </div>

          {/* Custom Strategy Builder - Only show when custom is selected */}
          {selectedStrategy === "custom" && (
            <div className="p-4 rounded-lg border border-purple-500 bg-purple-500/10">
              <div className="flex items-center space-x-3 mb-4">
                <TrendingUp className="h-5 w-5 text-purple-400" />
                <div>
                  <h3 className="font-semibold text-white">Custom Strategy Builder</h3>
                  <p className="text-sm text-slate-400">Create your own exit levels</p>
                </div>
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
                        <Label
                          htmlFor={`exit-percentage-${index}`}
                          className="text-xs text-slate-400"
                        >
                          Percentage
                        </Label>
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
                        <Label
                          htmlFor={`target-multiplier-${index}`}
                          className="text-xs text-slate-400"
                        >
                          Target Multiplier
                        </Label>
                        <Input
                          id={`target-multiplier-${index}`}
                          type="number"
                          min="1.1"
                          step="0.1"
                          value={level.targetMultiplier}
                          onChange={(e) =>
                            handleCustomLevelChange(
                              index,
                              "targetMultiplier",
                              Number(e.target.value)
                            )
                          }
                          className="bg-slate-700 border-slate-600"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor={`profit-percent-${index}`}
                          className="text-xs text-slate-400"
                        >
                          Profit %
                        </Label>
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
                    Save Custom Strategy
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
