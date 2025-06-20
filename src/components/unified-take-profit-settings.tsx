"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Plus,
  Shield,
  Target,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_CUSTOM_CONFIG,
  TAKE_PROFIT_STRATEGIES,
  type TakeProfitLevel,
  type TakeProfitStrategy,
  createCustomTakeProfitLevel,
  validateTakeProfitLevel,
  validateTakeProfitStrategy,
} from "../types/take-profit-strategies";

interface UnifiedTakeProfitSettingsProps {
  selectedStrategy: string;
  customStrategy?: TakeProfitStrategy;
  onStrategyChange: (strategyId: string) => void;
  onCustomStrategyChange: (strategy: TakeProfitStrategy) => void;
  investmentAmount?: number;
  className?: string;
}

export function UnifiedTakeProfitSettings({
  selectedStrategy,
  customStrategy,
  onStrategyChange,
  onCustomStrategyChange,
  investmentAmount = 1000,
  className = "",
}: UnifiedTakeProfitSettingsProps) {
  const [customLevels, setCustomLevels] = useState<TakeProfitLevel[]>(customStrategy?.levels || []);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [stopLoss, setStopLoss] = useState(15);
  const [trailingStop, setTrailingStop] = useState(true);
  const [maxPosition, setMaxPosition] = useState(investmentAmount);

  // Get current strategy for display
  const currentStrategy = useMemo(() => {
    if (selectedStrategy === "custom") {
      return {
        ...DEFAULT_CUSTOM_CONFIG.strategy,
        levels: customLevels,
        name: "Custom Strategy",
      };
    }
    return (
      TAKE_PROFIT_STRATEGIES.find((s) => s.id === selectedStrategy) || TAKE_PROFIT_STRATEGIES[0]
    );
  }, [selectedStrategy, customLevels]);

  // Update custom levels when customStrategy prop changes
  useEffect(() => {
    if (customStrategy?.levels) {
      setCustomLevels(customStrategy.levels);
    }
  }, [customStrategy]);

  // Validate custom strategy whenever levels change
  useEffect(() => {
    if (customLevels.length > 0) {
      const strategy: TakeProfitStrategy = {
        ...DEFAULT_CUSTOM_CONFIG.strategy,
        levels: customLevels,
      };
      const errors = validateTakeProfitStrategy(strategy);
      setValidationErrors(errors);
    } else {
      setValidationErrors([]);
    }
  }, [customLevels]);

  const handleStrategySelect = (strategyId: string) => {
    onStrategyChange(strategyId);
  };

  const handleCustomLevelAdd = () => {
    if (customLevels.length < 6) {
      const lastPercent = customLevels[customLevels.length - 1]?.profitPercentage || 0;
      const newLevel = createCustomTakeProfitLevel(
        lastPercent + 10,
        25,
        `Level ${customLevels.length + 1}`
      );
      const newLevels = [...customLevels, newLevel];
      setCustomLevels(newLevels);
      updateCustomStrategy(newLevels);
    }
  };

  const handleCustomLevelUpdate = (index: number, updates: Partial<TakeProfitLevel>) => {
    const newLevels = [...customLevels];
    newLevels[index] = { ...newLevels[index], ...updates };
    setCustomLevels(newLevels);
    updateCustomStrategy(newLevels);
  };

  const handleCustomLevelRemove = (index: number) => {
    if (customLevels.length > 1) {
      const newLevels = customLevels.filter((_, i) => i !== index);
      setCustomLevels(newLevels);
      updateCustomStrategy(newLevels);
    }
  };

  const updateCustomStrategy = (levels: TakeProfitLevel[]) => {
    const strategy: TakeProfitStrategy = {
      ...DEFAULT_CUSTOM_CONFIG.strategy,
      levels,
    };
    onCustomStrategyChange(strategy);
  };

  const totalSellQuantity = useMemo(() => {
    return currentStrategy.levels
      .filter((level) => level.isActive)
      .reduce((sum, level) => sum + level.sellQuantity, 0);
  }, [currentStrategy]);

  const getRiskBadgeColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStrategyIcon = (strategyId: string) => {
    switch (strategyId) {
      case "conservative":
        return <Shield className="h-5 w-5 text-green-600" />;
      case "balanced":
        return <Target className="h-5 w-5 text-blue-600" />;
      case "aggressive":
        return <TrendingUp className="h-5 w-5 text-red-600" />;
      default:
        return <Target className="h-5 w-5 text-purple-600" />;
    }
  };

  return (
    <div className={`min-h-screen bg-background p-4 sm:p-6 ${className}`}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Take Profit Settings</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Configure your profit-taking strategy and exit levels
            </p>
          </div>
          <Button size="lg" className="gap-2 w-full sm:w-auto">
            <Shield className="h-4 w-4" />
            Save Strategy
          </Button>
        </div>

        {/* Strategy Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Profit Strategy
            </CardTitle>
            <CardDescription>Choose your profit-taking approach</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="strategy-select">Strategy Type</Label>
                <Select value={selectedStrategy} onValueChange={handleStrategySelect}>
                  <SelectTrigger id="strategy-select">
                    <SelectValue placeholder="Select strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    {TAKE_PROFIT_STRATEGIES.map((strategy) => (
                      <SelectItem key={strategy.id} value={strategy.id}>
                        <div className="flex items-center gap-2">
                          {getStrategyIcon(strategy.id)}
                          <span>{strategy.name}</span>
                          <Badge
                            className={getRiskBadgeColor(strategy.riskLevel)}
                            variant="outline"
                          >
                            {strategy.riskLevel}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-purple-600" />
                        <span>Custom Strategy</span>
                        <Badge variant="outline">Advanced</Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedStrategy !== "custom" && (
                <>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Levels</div>
                    <div className="flex items-center justify-center gap-1">
                      <Target className="h-3 w-3" />
                      <span className="font-medium">{currentStrategy.levels.length}</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">Total Coverage</div>
                    <div className="flex items-center justify-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      <span className="font-medium">
                        {currentStrategy.levels.reduce((sum, l) => sum + l.sellQuantity, 0)}%
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {selectedStrategy !== "custom" && (
              <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">{currentStrategy.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Strategy Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Strategy Configuration</CardTitle>
            <CardDescription>Fine-tune your selected strategy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Visual Chart */}
            <div className="bg-muted/30 rounded-lg p-4 sm:p-6 relative overflow-hidden">
              <div className="absolute inset-0 opacity-5">
                <svg width="100%" height="100%">
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path
                        d="M 40 0 L 0 0 0 40"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                      />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              </div>

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium">Profit Distribution</h3>
                  <Badge variant="outline" className="gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {currentStrategy.name}
                  </Badge>
                </div>

                <div className="flex items-end justify-between h-32 sm:h-40 mb-4 gap-2">
                  {currentStrategy.levels.map((level, index) => (
                    <div key={level.id} className="flex-1 flex flex-col items-center min-w-0">
                      <div
                        className="w-full max-w-12 sm:max-w-16 bg-primary rounded-t transition-all mx-auto"
                        style={{ height: `${(level.sellQuantity / 40) * 100}%` }}
                      />
                      <div className="text-center mt-2 w-full">
                        <p className="text-xs text-muted-foreground truncate">
                          +{level.profitPercentage}%
                        </p>
                        <p className="text-xs sm:text-sm font-semibold">{level.sellQuantity}%</p>
                      </div>
                    </div>
                  ))}
                </div>

                {totalSellQuantity !== 100 && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Total sell percentage is {totalSellQuantity}%. Adjust levels to reach 100%.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            <Tabs defaultValue="levels" className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-auto">
                <TabsTrigger value="levels" className="text-xs sm:text-sm">
                  Profit Levels
                </TabsTrigger>
                <TabsTrigger value="risk" className="text-xs sm:text-sm">
                  Risk Management
                </TabsTrigger>
                <TabsTrigger value="advanced" className="text-xs sm:text-sm">
                  Advanced
                </TabsTrigger>
              </TabsList>

              <TabsContent value="levels" className="space-y-4 mt-6">
                {selectedStrategy === "custom" ? (
                  <div className="space-y-3">
                    {/* Validation Errors */}
                    {validationErrors.length > 0 && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <div className="space-y-1">
                            {validationErrors.map((error, index) => (
                              <div key={index} className="text-sm">
                                {error}
                              </div>
                            ))}
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {customLevels.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No custom levels configured yet.</p>
                        <p className="text-sm">
                          Click "Add Level" to create your first profit level.
                        </p>
                      </div>
                    ) : (
                      customLevels.map((level, index) => (
                        <CustomLevelEditor
                          key={level.id}
                          level={level}
                          index={index}
                          onUpdate={(updates) => handleCustomLevelUpdate(index, updates)}
                          onRemove={() => handleCustomLevelRemove(index)}
                          totalSellQuantity={totalSellQuantity}
                        />
                      ))
                    )}

                    {customLevels.length < 6 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCustomLevelAdd}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Level
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {currentStrategy.levels.map((level, index) => (
                      <div
                        key={level.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
                      >
                        <div className="flex items-center gap-4">
                          <Badge variant="outline">Level {index + 1}</Badge>
                          <span className="text-sm">Take profit at +{level.profitPercentage}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Sell {level.sellQuantity}%</span>
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="risk" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="stop-loss" className="flex items-center gap-2 mb-2">
                      Stop Loss
                      <Badge variant="outline" className="text-xs">
                        Protects downside
                      </Badge>
                    </Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[stopLoss]}
                        onValueChange={([value]) => setStopLoss(value)}
                        min={5}
                        max={30}
                        step={1}
                        className="flex-1"
                      />
                      <div className="w-20 text-right">
                        <span className="text-lg font-semibold">-{stopLoss}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <div>
                        <Label htmlFor="trailing-stop" className="text-base">
                          Trailing Stop
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Lock in profits as price rises
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="trailing-stop"
                      checked={trailingStop}
                      onCheckedChange={setTrailingStop}
                    />
                  </div>

                  <div>
                    <Label htmlFor="max-position" className="flex items-center gap-2 mb-2">
                      Maximum Position Size
                      <Badge variant="outline" className="text-xs">
                        Per trade
                      </Badge>
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">$</span>
                      <Input
                        id="max-position"
                        type="number"
                        value={maxPosition}
                        onChange={(e) => setMaxPosition(Number.parseInt(e.target.value) || 0)}
                        className="flex-1"
                      />
                      <span className="text-muted-foreground">USDT</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-6 mt-6">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Advanced settings for experienced traders. Use with caution.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <Label className="text-base">Enable Partial Fills</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow orders to be partially filled
                      </p>
                    </div>
                    <Switch />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <Label className="text-base">Auto-Rebalance</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically adjust positions
                      </p>
                    </div>
                    <Switch />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <Label className="text-base">Pattern Discovery Integration</Label>
                      <p className="text-sm text-muted-foreground">
                        Use AI pattern detection for timing
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle>Strategy Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Strategy Type</p>
                <p className="text-lg font-semibold">{currentStrategy.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Profit Levels</p>
                <p className="text-lg font-semibold">{currentStrategy.levels.length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Stop Loss</p>
                <p className="text-lg font-semibold">-{stopLoss}%</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Max Position</p>
                <p className="text-lg font-semibold">${maxPosition}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Custom Level Editor Component
interface CustomLevelEditorProps {
  level: TakeProfitLevel;
  index: number;
  onUpdate: (updates: Partial<TakeProfitLevel>) => void;
  onRemove: () => void;
  totalSellQuantity: number;
}

function CustomLevelEditor({
  level,
  index,
  onUpdate,
  onRemove,
  totalSellQuantity,
}: CustomLevelEditorProps) {
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const validationErrors = validateTakeProfitLevel(level);
    setErrors(validationErrors);
  }, [level]);

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border">
      <span className="text-sm font-medium w-16">Level {index + 1}</span>
      <div className="flex items-center gap-2 flex-1">
        <Label className="text-sm">Profit:</Label>
        <Input
          type="number"
          value={level.profitPercentage}
          onChange={(e) => onUpdate({ profitPercentage: Number.parseFloat(e.target.value) || 0 })}
          className="w-20 h-8"
          min="0.1"
          max="1000"
          step="0.1"
        />
        <span className="text-sm">%</span>
      </div>
      <div className="flex items-center gap-2 flex-1">
        <Label className="text-sm">Sell:</Label>
        <Input
          type="number"
          value={level.sellQuantity}
          onChange={(e) => onUpdate({ sellQuantity: Number.parseFloat(e.target.value) || 0 })}
          className="w-20 h-8"
          min="1"
          max="100"
          step="1"
        />
        <span className="text-sm">%</span>
      </div>
      <div className="flex items-center gap-2">
        {errors.length === 0 ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <AlertCircle className="h-4 w-4 text-red-600" />
        )}
        {index > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
