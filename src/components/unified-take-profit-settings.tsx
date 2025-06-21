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
    <div className={`space-y-6 ${className}`}>
      {/* Strategy Selection */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Target className="h-5 w-5 text-primary" />
            Profit Strategy
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Choose your profit-taking approach
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2 relative">
              <Label htmlFor="strategy-select" className="text-foreground">
                Strategy Type
              </Label>
              <div className="relative z-50">
                <Select value={selectedStrategy} onValueChange={handleStrategySelect}>
                  <SelectTrigger
                    id="strategy-select"
                    className="bg-background border-border text-foreground hover:bg-accent/50 focus:ring-primary/50"
                  >
                    <SelectValue placeholder="Select strategy" />
                  </SelectTrigger>
                  <SelectContent
                    className="bg-popover border-border shadow-lg backdrop-blur-sm z-[999999] max-h-80 overflow-y-auto"
                    position="popper"
                    sideOffset={8}
                  >
                    {TAKE_PROFIT_STRATEGIES.map((strategy) => (
                      <SelectItem
                        key={strategy.id}
                        value={strategy.id}
                        className="focus:bg-accent focus:text-accent-foreground cursor-pointer"
                      >
                        <div className="flex items-center gap-2 w-full">
                          {getStrategyIcon(strategy.id)}
                          <span className="flex-1">{strategy.name}</span>
                          <Badge
                            className={`${getRiskBadgeColor(strategy.riskLevel)} text-xs`}
                            variant="outline"
                          >
                            {strategy.riskLevel}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem
                      value="custom"
                      className="focus:bg-accent focus:text-accent-foreground cursor-pointer"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Target className="h-4 w-4 text-primary" />
                        <span className="flex-1">Custom Strategy</span>
                        <Badge variant="outline" className="text-xs">
                          Advanced
                        </Badge>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedStrategy !== "custom" && (
              <>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Levels</div>
                  <div className="flex items-center justify-center gap-1">
                    <Target className="h-3 w-3 text-primary" />
                    <span className="font-medium text-foreground">
                      {currentStrategy.levels.length}
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-muted-foreground mb-1">Total Coverage</div>
                  <div className="flex items-center justify-center gap-1">
                    <DollarSign className="h-3 w-3 text-primary" />
                    <span className="font-medium text-foreground">
                      {currentStrategy.levels.reduce((sum, l) => sum + l.sellQuantity, 0)}%
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {selectedStrategy !== "custom" && (
            <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border">
              <p className="text-sm text-muted-foreground">{currentStrategy.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Strategy Configuration */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Strategy Configuration</CardTitle>
          <CardDescription className="text-muted-foreground">
            Fine-tune your selected strategy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Visual Chart */}
          <div className="bg-muted/30 rounded-lg p-4 sm:p-6 relative overflow-hidden border border-border/50">
            <div className="absolute inset-0 opacity-5">
              <svg width="100%" height="100%">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            </div>

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-foreground">Profit Distribution</h3>
                <Badge variant="outline" className="gap-1 border-border">
                  <TrendingUp className="h-3 w-3 text-primary" />
                  <span className="text-foreground">{currentStrategy.name}</span>
                </Badge>
              </div>

              <div className="flex items-end justify-between h-32 sm:h-40 mb-4 gap-2">
                {currentStrategy.levels.map((level, index) => (
                  <div key={level.id} className="flex-1 flex flex-col items-center min-w-0">
                    <div
                      className="w-full max-w-12 sm:max-w-16 bg-primary rounded-t transition-all mx-auto shadow-sm"
                      style={{ height: `${(level.sellQuantity / 40) * 100}%` }}
                    />
                    <div className="text-center mt-2 w-full">
                      <p className="text-xs text-muted-foreground truncate">
                        +{level.profitPercentage}%
                      </p>
                      <p className="text-xs sm:text-sm font-semibold text-foreground">
                        {level.sellQuantity}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {totalSellQuantity !== 100 && (
                <Alert variant="destructive" className="mt-4 border-destructive bg-destructive/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-destructive-foreground">
                    Total sell percentage is {totalSellQuantity}%. Adjust levels to reach 100%.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          <Tabs defaultValue="levels" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto bg-muted border border-border">
              <TabsTrigger
                value="levels"
                className="text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:text-foreground"
              >
                Profit Levels
              </TabsTrigger>
              <TabsTrigger
                value="risk"
                className="text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:text-foreground"
              >
                Safety Controls
              </TabsTrigger>
              <TabsTrigger
                value="advanced"
                className="text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:text-foreground"
              >
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
                    <p className="text-sm text-muted-foreground">Automatically adjust positions</p>
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
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Strategy Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Strategy Type</p>
              <p className="text-lg font-semibold text-foreground">{currentStrategy.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Profit Levels</p>
              <p className="text-lg font-semibold text-foreground">
                {currentStrategy.levels.length}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Stop Loss</p>
              <p className="text-lg font-semibold text-foreground">-{stopLoss}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Max Position</p>
              <p className="text-lg font-semibold text-foreground">${maxPosition}</p>
            </div>
          </div>
        </CardContent>
      </Card>
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
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background/50">
      <span className="text-sm font-medium w-16 text-foreground">Level {index + 1}</span>
      <div className="flex items-center gap-2 flex-1">
        <Label className="text-sm text-foreground">Profit:</Label>
        <Input
          type="number"
          value={level.profitPercentage}
          onChange={(e) => onUpdate({ profitPercentage: Number.parseFloat(e.target.value) || 0 })}
          className="w-20 h-8 bg-background border-border text-foreground"
          min="0.1"
          max="1000"
          step="0.1"
        />
        <span className="text-sm text-muted-foreground">%</span>
      </div>
      <div className="flex items-center gap-2 flex-1">
        <Label className="text-sm text-foreground">Sell:</Label>
        <Input
          type="number"
          value={level.sellQuantity}
          onChange={(e) => onUpdate({ sellQuantity: Number.parseFloat(e.target.value) || 0 })}
          className="w-20 h-8 bg-background border-border text-foreground"
          min="1"
          max="100"
          step="1"
        />
        <span className="text-sm text-muted-foreground">%</span>
      </div>
      <div className="flex items-center gap-2">
        {errors.length === 0 ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}
        {index > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
