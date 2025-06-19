"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Alert, AlertDescription } from "./ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { 
  Shield, 
  Target, 
  Zap, 
  Plus, 
  Trash2, 
  Info, 
  TrendingUp, 
  DollarSign,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import {
  TakeProfitStrategy,
  TakeProfitLevel,
  TAKE_PROFIT_STRATEGIES,
  DEFAULT_CUSTOM_CONFIG,
  validateTakeProfitStrategy,
  validateTakeProfitLevel,
  createCustomTakeProfitLevel,
  calculatePotentialProfit
} from "../types/take-profit-strategies";

interface EnhancedTakeProfitConfigProps {
  selectedStrategy: string;
  customStrategy?: TakeProfitStrategy;
  onStrategyChange: (strategyId: string) => void;
  onCustomStrategyChange: (strategy: TakeProfitStrategy) => void;
  investmentAmount?: number;
  className?: string;
}

export function EnhancedTakeProfitConfig({
  selectedStrategy,
  customStrategy,
  onStrategyChange,
  onCustomStrategyChange,
  investmentAmount = 1000,
  className = ""
}: EnhancedTakeProfitConfigProps) {
  const [activeTab, setActiveTab] = useState("presets");
  const [customLevels, setCustomLevels] = useState<TakeProfitLevel[]>(
    customStrategy?.levels || []
  );
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

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
        levels: customLevels
      };
      const errors = validateTakeProfitStrategy(strategy);
      setValidationErrors(errors);
    } else {
      setValidationErrors([]);
    }
  }, [customLevels]);

  const handlePresetStrategySelect = (strategyId: string) => {
    onStrategyChange(strategyId);
    if (strategyId !== "custom") {
      setActiveTab("presets");
    } else {
      setActiveTab("custom");
    }
  };

  const handleCustomLevelAdd = () => {
    const newLevel = createCustomTakeProfitLevel(10, 25, "New level");
    setCustomLevels([...customLevels, newLevel]);
    updateCustomStrategy([...customLevels, newLevel]);
  };

  const handleCustomLevelUpdate = (index: number, updates: Partial<TakeProfitLevel>) => {
    const updatedLevels = customLevels.map((level, i) => 
      i === index ? { ...level, ...updates } : level
    );
    setCustomLevels(updatedLevels);
    updateCustomStrategy(updatedLevels);
  };

  const handleCustomLevelRemove = (index: number) => {
    const updatedLevels = customLevels.filter((_, i) => i !== index);
    setCustomLevels(updatedLevels);
    updateCustomStrategy(updatedLevels);
  };

  const updateCustomStrategy = (levels: TakeProfitLevel[]) => {
    const strategy: TakeProfitStrategy = {
      ...DEFAULT_CUSTOM_CONFIG.strategy,
      levels
    };
    onCustomStrategyChange(strategy);
  };

  const getStrategyIcon = (strategyId: string) => {
    switch (strategyId) {
      case "conservative": return <Shield className="h-5 w-5 text-green-600" />;
      case "balanced": return <Target className="h-5 w-5 text-blue-600" />;
      case "aggressive": return <Zap className="h-5 w-5 text-red-600" />;
      default: return <TrendingUp className="h-5 w-5 text-purple-600" />;
    }
  };

  const getRiskBadgeColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "low": return "bg-green-100 text-green-800 border-green-200";
      case "medium": return "bg-blue-100 text-blue-800 border-blue-200";
      case "high": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const calculateTotalSellQuantity = (levels: TakeProfitLevel[]) => {
    return levels
      .filter(level => level.isActive)
      .reduce((sum, level) => sum + level.sellQuantity, 0);
  };

  return (
    <TooltipProvider>
      <div className={`space-y-6 ${className}`}>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Take Profit Strategy Configuration
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure your take profit strategy to automatically sell portions of your position at different profit levels.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="presets">Preset Strategies</TabsTrigger>
            <TabsTrigger value="custom">Custom Strategy</TabsTrigger>
          </TabsList>

          <TabsContent value="presets" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
              {TAKE_PROFIT_STRATEGIES.map((strategy) => (
                <Card 
                  key={strategy.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedStrategy === strategy.id 
                      ? "ring-2 ring-primary border-primary" 
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => handlePresetStrategySelect(strategy.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStrategyIcon(strategy.id)}
                        <CardTitle className="text-base">{strategy.name}</CardTitle>
                      </div>
                      <Badge className={getRiskBadgeColor(strategy.riskLevel)}>
                        {strategy.riskLevel} risk
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      {strategy.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        Profit Levels:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {strategy.levels.map((level, index) => (
                          <Badge 
                            key={level.id} 
                            variant="outline" 
                            className="text-xs"
                          >
                            {level.profitPercentage}% ({level.sellQuantity}%)
                          </Badge>
                        ))}
                      </div>
                      
                      {/* Profit Preview */}
                      <div className="mt-3 p-2 bg-muted/50 rounded text-xs">
                        <div className="flex items-center gap-1 mb-1">
                          <DollarSign className="h-3 w-3" />
                          <span className="font-medium">Potential with ${investmentAmount}:</span>
                        </div>
                        {calculatePotentialProfit(strategy, investmentAmount)
                          .slice(0, 2)
                          .map((result, index) => (
                            <div key={index} className="text-muted-foreground">
                              Level {index + 1}: +${result.profit.toFixed(0)} 
                              ({result.level.profitPercentage}%)
                            </div>
                          ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Custom Strategy Card */}
            <Card 
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedStrategy === "custom" 
                  ? "ring-2 ring-primary border-primary" 
                  : "hover:border-primary/50"
              }`}
              onClick={() => handlePresetStrategySelect("custom")}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                    <CardTitle className="text-base">Custom Strategy</CardTitle>
                  </div>
                  <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                    custom
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Create your own personalized take profit levels with custom percentages and sell quantities.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xs text-muted-foreground">
                  {customLevels.length > 0 
                    ? `${customLevels.length} custom levels configured`
                    : "Click to configure custom levels"
                  }
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Custom Take Profit Levels</CardTitle>
                    <CardDescription className="text-sm">
                      Add up to 6 custom take profit levels with your preferred percentages.
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleCustomLevelAdd}
                    disabled={customLevels.length >= 6}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Level
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Validation Errors */}
                {validationErrors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        {validationErrors.map((error, index) => (
                          <div key={index} className="text-sm">{error}</div>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Custom Levels */}
                {customLevels.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No custom levels configured yet.</p>
                    <p className="text-sm">Click "Add Level" to create your first take profit level.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customLevels.map((level, index) => (
                      <CustomLevelEditor
                        key={level.id}
                        level={level}
                        index={index}
                        onUpdate={(updates) => handleCustomLevelUpdate(index, updates)}
                        onRemove={() => handleCustomLevelRemove(index)}
                        totalSellQuantity={calculateTotalSellQuantity(customLevels)}
                      />
                    ))}
                  </div>
                )}

                {/* Summary */}
                {customLevels.length > 0 && (
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="h-4 w-4" />
                      <span className="font-medium text-sm">Strategy Summary</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Total Levels:</span>
                        <span className="ml-2 font-medium">{customLevels.filter(l => l.isActive).length}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total Sell Quantity:</span>
                        <span className={`ml-2 font-medium ${
                          calculateTotalSellQuantity(customLevels) > 100 ? "text-red-600" : "text-green-600"
                        }`}>
                          {calculateTotalSellQuantity(customLevels).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
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
  totalSellQuantity 
}: CustomLevelEditorProps) {
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const validationErrors = validateTakeProfitLevel(level);
    setErrors(validationErrors);
  }, [level]);

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline">Level {index + 1}</Badge>
          {errors.length === 0 ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
        </div>
        <Button
          onClick={onRemove}
          variant="ghost"
          size="sm"
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`profit-${level.id}`} className="text-xs">
            Profit Percentage
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id={`profit-${level.id}`}
              type="number"
              min="0.1"
              max="1000"
              step="0.1"
              value={level.profitPercentage}
              onChange={(e) => onUpdate({ profitPercentage: parseFloat(e.target.value) || 0 })}
              className="text-sm"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`quantity-${level.id}`} className="text-xs">
            Sell Quantity
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id={`quantity-${level.id}`}
              type="number"
              min="1"
              max="100"
              step="1"
              value={level.sellQuantity}
              onChange={(e) => onUpdate({ sellQuantity: parseFloat(e.target.value) || 0 })}
              className="text-sm"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`description-${level.id}`} className="text-xs">
            Description (Optional)
          </Label>
          <Input
            id={`description-${level.id}`}
            type="text"
            placeholder="e.g., Quick profit"
            value={level.description || ""}
            onChange={(e) => onUpdate({ description: e.target.value })}
            className="text-sm"
          />
        </div>
      </div>

      {errors.length > 0 && (
        <Alert variant="destructive" className="mt-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {errors.join(", ")}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
