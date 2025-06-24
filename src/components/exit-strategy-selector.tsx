/**
 * Exit Strategy Selector Component
 *
 * Provides a comprehensive interface for selecting and configuring
 * exit strategies for trading positions with real-time validation.
 */

import React, { useState } from "react";
import type { ExitStrategy } from "../types/exit-strategies";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export interface ExitStrategySelectorProps {
  value?: ExitStrategy;
  onChange?: (value: ExitStrategy) => void;
  disabled?: boolean;
  className?: string;
}

const DEFAULT_STRATEGIES = [
  {
    id: "multi-phase",
    name: "Multi-Phase Exit",
    description: "Exit positions in multiple phases as price targets are reached",
    riskLevel: "medium" as const,
    phases: 3,
  },
  {
    id: "trailing-stop",
    name: "Trailing Stop Loss",
    description: "Dynamic stop loss that follows price movements",
    riskLevel: "low" as const,
    trailPercent: 5,
  },
  {
    id: "time-based",
    name: "Time-Based Exit",
    description: "Exit position after specified time duration",
    riskLevel: "medium" as const,
    duration: 24,
  },
  {
    id: "profit-target",
    name: "Fixed Profit Target",
    description: "Exit when specific profit percentage is reached",
    riskLevel: "high" as const,
    targetPercent: 20,
  },
];

export function ExitStrategySelector({
  value,
  onChange,
  disabled = false,
  className = "",
}: ExitStrategySelectorProps) {
  const [selectedStrategy, setSelectedStrategy] = useState(value?.id || "");
  const [customParams, setCustomParams] = useState<Record<string, any>>(value?.parameters || {});

  const handleStrategyChange = (strategyId: string) => {
    setSelectedStrategy(strategyId);
    const strategy = DEFAULT_STRATEGIES.find((s) => s.id === strategyId);

    if (strategy && onChange) {
      const exitStrategy: ExitStrategy = {
        id: strategy.id,
        name: strategy.name,
        type: strategy.id,
        description: strategy.description,
        riskLevel: strategy.riskLevel,
        parameters: {
          ...strategy,
          ...customParams,
        },
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      onChange(exitStrategy);
    }
  };

  const handleParameterChange = (key: string, value: any) => {
    const newParams = { ...customParams, [key]: value };
    setCustomParams(newParams);

    if (selectedStrategy && onChange) {
      const strategy = DEFAULT_STRATEGIES.find((s) => s.id === selectedStrategy);
      if (strategy) {
        const exitStrategy: ExitStrategy = {
          id: strategy.id,
          name: strategy.name,
          type: strategy.id,
          description: strategy.description,
          riskLevel: strategy.riskLevel,
          parameters: newParams,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        onChange(exitStrategy);
      }
    }
  };

  const selectedStrategyData = DEFAULT_STRATEGIES.find((s) => s.id === selectedStrategy);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Exit Strategy Configuration</CardTitle>
        <CardDescription>Choose how you want to exit your trading positions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="strategy-select">Strategy Type</Label>
          <Select value={selectedStrategy} onValueChange={handleStrategyChange} disabled={disabled}>
            <SelectTrigger id="strategy-select">
              <SelectValue placeholder="Select an exit strategy" />
            </SelectTrigger>
            <SelectContent>
              {DEFAULT_STRATEGIES.map((strategy) => (
                <SelectItem key={strategy.id} value={strategy.id}>
                  <div className="flex items-center gap-2">
                    <span>{strategy.name}</span>
                    <Badge
                      variant={
                        strategy.riskLevel === "low"
                          ? "secondary"
                          : strategy.riskLevel === "medium"
                            ? "default"
                            : "destructive"
                      }
                    >
                      {strategy.riskLevel}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedStrategyData && (
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">{selectedStrategyData.description}</p>
            </div>

            {/* Strategy-specific parameters */}
            {selectedStrategy === "multi-phase" && (
              <div className="space-y-2">
                <Label htmlFor="phases">Number of Phases</Label>
                <Input
                  id="phases"
                  type="number"
                  min="2"
                  max="5"
                  value={customParams.phases || 3}
                  onChange={(e) => handleParameterChange("phases", parseInt(e.target.value))}
                  disabled={disabled}
                />
              </div>
            )}

            {selectedStrategy === "trailing-stop" && (
              <div className="space-y-2">
                <Label htmlFor="trail-percent">Trail Percentage (%)</Label>
                <Input
                  id="trail-percent"
                  type="number"
                  min="1"
                  max="20"
                  step="0.5"
                  value={customParams.trailPercent || 5}
                  onChange={(e) =>
                    handleParameterChange("trailPercent", parseFloat(e.target.value))
                  }
                  disabled={disabled}
                />
              </div>
            )}

            {selectedStrategy === "time-based" && (
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (hours)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  max="168"
                  value={customParams.duration || 24}
                  onChange={(e) => handleParameterChange("duration", parseInt(e.target.value))}
                  disabled={disabled}
                />
              </div>
            )}

            {selectedStrategy === "profit-target" && (
              <div className="space-y-2">
                <Label htmlFor="target-percent">Profit Target (%)</Label>
                <Input
                  id="target-percent"
                  type="number"
                  min="5"
                  max="100"
                  step="1"
                  value={customParams.targetPercent || 20}
                  onChange={(e) => handleParameterChange("targetPercent", parseInt(e.target.value))}
                  disabled={disabled}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
