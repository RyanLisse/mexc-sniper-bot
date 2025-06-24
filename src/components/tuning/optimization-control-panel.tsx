"use client";
import { createLogger } from "../../lib/structured-logger";

/**
 * Optimization Control Panel
 *
 * Controls for starting, configuring, and managing parameter optimization processes.
 */

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Play,
  Settings,
  Shield,
  Target,
  TrendingUp,
} from "lucide-react";
import React, { useState } from "react";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Slider } from "../ui/slider";

interface OptimizationConfig {
  algorithm: "bayesian" | "genetic" | "reinforcement_learning" | "multi_objective";
  parameterCategories: string[];
  objectives: Array<{
    name: string;
    weight: number;
    direction: "maximize" | "minimize";
  }>;
  maxIterations: number;
  convergenceThreshold: number;
  explorationRate: number;
  enableBacktesting: boolean;
  backtestingPeriodDays: number;
  enableABTesting: boolean;
  abTestTrafficSplit: number;
  safetyConstraints: {
    maxRiskLevel: number;
    minSharpeRatio: number;
    maxDrawdown: number;
    requireHumanApproval: boolean;
  };
}

interface SystemHealth {
  overallHealth: "excellent" | "good" | "warning" | "critical";
  components: {
    optimizationEngine: "healthy" | "degraded" | "down";
    parameterManager: "healthy" | "degraded" | "down";
    backtesting: "healthy" | "degraded" | "down";
    abTesting: "healthy" | "degraded" | "down";
  };
  activeOptimizations: number;
  lastOptimization: Date | null;
}

interface OptimizationControlPanelProps {
  onStartOptimization: (config: OptimizationConfig) => void;
  systemHealth: SystemHealth | null;
}

const logger = createLogger("optimization-control-panel");

export function OptimizationControlPanel({
  onStartOptimization,
  systemHealth,
}: OptimizationControlPanelProps) {
  const [config, setConfig] = useState<OptimizationConfig>({
    algorithm: "bayesian",
    parameterCategories: ["trading", "risk"],
    objectives: [
      { name: "Profitability", weight: 0.4, direction: "maximize" },
      { name: "Sharpe Ratio", weight: 0.3, direction: "maximize" },
      { name: "Max Drawdown", weight: 0.3, direction: "minimize" },
    ],
    maxIterations: 100,
    convergenceThreshold: 0.001,
    explorationRate: 0.2,
    enableBacktesting: true,
    backtestingPeriodDays: 30,
    enableABTesting: true,
    abTestTrafficSplit: 0.1,
    safetyConstraints: {
      maxRiskLevel: 0.2,
      minSharpeRatio: 1.0,
      maxDrawdown: 0.15,
      requireHumanApproval: true,
    },
  });

  const [isConfigValid, setIsConfigValid] = useState(true);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isStarting, setIsStarting] = useState(false);

  const parameterCategoryOptions = [
    { value: "trading", label: "Trading Strategy" },
    { value: "risk", label: "Risk Management" },
    { value: "agent", label: "Agent Configuration" },
    { value: "system", label: "System Performance" },
    { value: "pattern", label: "Pattern Detection" },
  ];

  const algorithmOptions = [
    {
      value: "bayesian",
      label: "Bayesian Optimization",
      description: "Efficient exploration using Gaussian processes",
    },
    {
      value: "genetic",
      label: "Genetic Algorithm",
      description: "Evolutionary approach for complex parameter spaces",
    },
    {
      value: "reinforcement_learning",
      label: "Reinforcement Learning",
      description: "Learn optimal policies through interaction",
    },
    {
      value: "multi_objective",
      label: "Multi-Objective",
      description: "Balance multiple competing objectives",
    },
  ];

  const validateConfiguration = () => {
    const errors: string[] = [];

    // Check objectives weights sum to 1
    const totalWeight = config.objectives.reduce((sum, obj) => sum + obj.weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      errors.push("Objective weights must sum to 1.0");
    }

    // Check parameter categories
    if (config.parameterCategories.length === 0) {
      errors.push("At least one parameter category must be selected");
    }

    // Check safety constraints
    if (config.safetyConstraints.maxRiskLevel > 1.0) {
      errors.push("Maximum risk level cannot exceed 100%");
    }

    if (config.safetyConstraints.minSharpeRatio < 0) {
      errors.push("Minimum Sharpe ratio must be positive");
    }

    // Check system health
    if (systemHealth?.overallHealth === "critical") {
      errors.push("System health is critical - optimization disabled");
    }

    if (config.enableBacktesting && systemHealth?.components.backtesting === "down") {
      errors.push("Backtesting is unavailable - disable or fix backtesting service");
    }

    if (config.enableABTesting && systemHealth?.components.abTesting === "down") {
      errors.push("A/B Testing is unavailable - disable or fix A/B testing service");
    }

    setValidationErrors(errors);
    setIsConfigValid(errors.length === 0);
  };

  React.useEffect(() => {
    validateConfiguration();
  }, [config, systemHealth]);

  const handleStartOptimization = async () => {
    if (!isConfigValid) return;

    setIsStarting(true);
    try {
      await onStartOptimization(config);
    } catch (error) {
      logger.error("Failed to start optimization:", error);
    } finally {
      setIsStarting(false);
    }
  };

  const updateObjectiveWeight = (index: number, weight: number) => {
    const newObjectives = [...config.objectives];
    newObjectives[index].weight = weight;
    setConfig({ ...config, objectives: newObjectives });
  };

  const getSystemHealthStatus = () => {
    if (!systemHealth) return null;

    const statusIcon = {
      excellent: <CheckCircle2 className="w-4 h-4 text-green-500" />,
      good: <CheckCircle2 className="w-4 h-4 text-blue-500" />,
      warning: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
      critical: <AlertTriangle className="w-4 h-4 text-red-500" />,
    };

    return (
      <div className="flex items-center space-x-2">
        {statusIcon[systemHealth.overallHealth]}
        <span className="text-sm capitalize">{systemHealth.overallHealth}</span>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Algorithm Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            Algorithm Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="algorithm">Optimization Algorithm</Label>
            <Select
              value={config.algorithm}
              onValueChange={(value) => setConfig({ ...config, algorithm: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {algorithmOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-gray-500">{option.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Parameter Categories</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {parameterCategoryOptions.map((category) => (
                <label key={category.value} className="flex items-center space-x-2">
                  <Checkbox
                    checked={config.parameterCategories.includes(category.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setConfig({
                          ...config,
                          parameterCategories: [...config.parameterCategories, category.value],
                        });
                      } else {
                        setConfig({
                          ...config,
                          parameterCategories: config.parameterCategories.filter(
                            (c) => c !== category.value
                          ),
                        });
                      }
                    }}
                  />
                  <span className="text-sm">{category.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="maxIterations">Max Iterations</Label>
              <Input
                id="maxIterations"
                type="number"
                value={config.maxIterations}
                onChange={(e) =>
                  setConfig({ ...config, maxIterations: Number.parseInt(e.target.value) })
                }
                min={10}
                max={1000}
              />
            </div>
            <div>
              <Label htmlFor="convergenceThreshold">Convergence Threshold</Label>
              <Input
                id="convergenceThreshold"
                type="number"
                step="0.001"
                value={config.convergenceThreshold}
                onChange={(e) =>
                  setConfig({ ...config, convergenceThreshold: Number.parseFloat(e.target.value) })
                }
                min={0.0001}
                max={0.1}
              />
            </div>
          </div>

          <div>
            <Label>Exploration Rate: {config.explorationRate}</Label>
            <Slider
              value={[config.explorationRate]}
              onValueChange={([value]) => setConfig({ ...config, explorationRate: value })}
              min={0.1}
              max={0.5}
              step={0.05}
              className="mt-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Optimization Objectives */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Optimization Objectives
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.objectives.map((objective, index) => (
            <div key={index} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{objective.name}</span>
                <span className="text-sm text-gray-500 capitalize">{objective.direction}</span>
              </div>
              <div>
                <Label>Weight: {objective.weight.toFixed(2)}</Label>
                <Slider
                  value={[objective.weight]}
                  onValueChange={([value]) => updateObjectiveWeight(index, value)}
                  min={0}
                  max={1}
                  step={0.05}
                  className="mt-1"
                />
              </div>
            </div>
          ))}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Objective weights must sum to 1.0. Current total:{" "}
              {config.objectives.reduce((sum, obj) => sum + obj.weight, 0).toFixed(2)}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Testing Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Testing Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="flex items-center space-x-2">
              <Checkbox
                checked={config.enableBacktesting}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, enableBacktesting: !!checked })
                }
              />
              <span>Enable Backtesting Validation</span>
            </label>

            {config.enableBacktesting && (
              <div className="mt-2">
                <Label htmlFor="backtestingDays">Backtesting Period (days)</Label>
                <Input
                  id="backtestingDays"
                  type="number"
                  value={config.backtestingPeriodDays}
                  onChange={(e) =>
                    setConfig({ ...config, backtestingPeriodDays: Number.parseInt(e.target.value) })
                  }
                  min={7}
                  max={365}
                />
              </div>
            )}
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <Checkbox
                checked={config.enableABTesting}
                onCheckedChange={(checked) => setConfig({ ...config, enableABTesting: !!checked })}
              />
              <span>Enable A/B Testing</span>
            </label>

            {config.enableABTesting && (
              <div className="mt-2">
                <Label>Traffic Split: {(config.abTestTrafficSplit * 100).toFixed(0)}%</Label>
                <Slider
                  value={[config.abTestTrafficSplit]}
                  onValueChange={([value]) => setConfig({ ...config, abTestTrafficSplit: value })}
                  min={0.01}
                  max={0.5}
                  step={0.01}
                  className="mt-1"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Safety Constraints */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Safety Constraints
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>
              Maximum Risk Level: {(config.safetyConstraints.maxRiskLevel * 100).toFixed(0)}%
            </Label>
            <Slider
              value={[config.safetyConstraints.maxRiskLevel]}
              onValueChange={([value]) =>
                setConfig({
                  ...config,
                  safetyConstraints: { ...config.safetyConstraints, maxRiskLevel: value },
                })
              }
              min={0.05}
              max={0.5}
              step={0.01}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="minSharpe">Minimum Sharpe Ratio</Label>
            <Input
              id="minSharpe"
              type="number"
              step="0.1"
              value={config.safetyConstraints.minSharpeRatio}
              onChange={(e) =>
                setConfig({
                  ...config,
                  safetyConstraints: {
                    ...config.safetyConstraints,
                    minSharpeRatio: Number.parseFloat(e.target.value),
                  },
                })
              }
              min={0}
              max={5}
            />
          </div>

          <div>
            <Label>
              Maximum Drawdown: {(config.safetyConstraints.maxDrawdown * 100).toFixed(0)}%
            </Label>
            <Slider
              value={[config.safetyConstraints.maxDrawdown]}
              onValueChange={([value]) =>
                setConfig({
                  ...config,
                  safetyConstraints: { ...config.safetyConstraints, maxDrawdown: value },
                })
              }
              min={0.05}
              max={0.3}
              step={0.01}
              className="mt-1"
            />
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <Checkbox
                checked={config.safetyConstraints.requireHumanApproval}
                onCheckedChange={(checked) =>
                  setConfig({
                    ...config,
                    safetyConstraints: {
                      ...config.safetyConstraints,
                      requireHumanApproval: !!checked,
                    },
                  })
                }
              />
              <span>Require Human Approval</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* System Status & Controls */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>System Status & Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">System Health</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Overall Status:</span>
                    {getSystemHealthStatus()}
                  </div>

                  {systemHealth && (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Optimization Engine:</span>
                        <span className="capitalize">
                          {systemHealth.components.optimizationEngine}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Parameter Manager:</span>
                        <span className="capitalize">
                          {systemHealth.components.parameterManager}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Backtesting:</span>
                        <span className="capitalize">{systemHealth.components.backtesting}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>A/B Testing:</span>
                        <span className="capitalize">{systemHealth.components.abTesting}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-3">Optimization Controls</h4>
                <div className="space-y-3">
                  <Button
                    onClick={handleStartOptimization}
                    disabled={
                      !isConfigValid || isStarting || systemHealth?.overallHealth === "critical"
                    }
                    className="w-full"
                    size="lg"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {isStarting ? "Starting..." : "Start Optimization"}
                  </Button>

                  {validationErrors.length > 0 && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription>
                        <div className="text-red-800">
                          <p className="font-medium mb-1">Configuration Issues:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {validationErrors.map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
