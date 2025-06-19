"use client";
import { AlertTriangle, DollarSign, Info, Target, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Separator } from "./ui/separator";

interface TakeProfitLevels {
  level1: number;
  level2: number;
  level3: number;
  level4: number;
  custom: number | null;
  defaultLevel: number;
}

interface TakeProfitLevelsProps {
  levels: TakeProfitLevels;
  onLevelsChange: (updater: (prev: TakeProfitLevels) => TakeProfitLevels) => void;
  onDirty: () => void;
}

export function UnifiedTakeProfitLevels({
  levels,
  onLevelsChange,
  onDirty,
}: TakeProfitLevelsProps) {
  const updateLevel = (level: string, value: number) => {
    onLevelsChange((prev) => ({ ...prev, [level]: value }));
    onDirty();
  };

  const updateCustomLevel = (value: number | null) => {
    onLevelsChange((prev) => ({ ...prev, custom: value }));
    onDirty();
  };

  const updateDefaultLevel = (level: number) => {
    onLevelsChange((prev) => ({ ...prev, defaultLevel: level }));
    onDirty();
  };

  // Calculate multiplier and profit estimate for display
  const calculateProfitInfo = (percentage: number) => {
    const multiplier = 1 + percentage / 100;
    return {
      multiplier: multiplier.toFixed(2),
      dollarProfit: ((multiplier - 1) * 1000).toFixed(0), // Example with $1000 investment
    };
  };

  // Get level description and risk info
  const getLevelInfo = (levelNum: number, _percentage: number) => {
    const descriptions = {
      1: {
        name: "Conservative",
        risk: "Low Risk",
        color: "bg-green-100 text-green-800",
        icon: <Target className="h-4 w-4" />,
      },
      2: {
        name: "Moderate",
        risk: "Medium Risk",
        color: "bg-blue-100 text-blue-800",
        icon: <TrendingUp className="h-4 w-4" />,
      },
      3: {
        name: "Aggressive",
        risk: "High Risk",
        color: "bg-orange-100 text-orange-800",
        icon: <DollarSign className="h-4 w-4" />,
      },
      4: {
        name: "Very Aggressive",
        risk: "Very High Risk",
        color: "bg-red-100 text-red-800",
        icon: <AlertTriangle className="h-4 w-4" />,
      },
    };
    return descriptions[levelNum as keyof typeof descriptions];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Take Profit Configuration
        </CardTitle>
        <CardDescription>
          Configure when and how much profit to take automatically. Higher percentages = higher risk
          but potentially bigger rewards.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* How Take Profit Works - Explanation */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>How Take Profit Works:</strong> When a token reaches your target profit
            percentage, the bot will automatically sell your position. For example, if you set 10%
            and buy at $1.00, it will sell when the price reaches $1.10 (+10% profit).
          </AlertDescription>
        </Alert>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Level 1 - Conservative */}
          <div className="space-y-3 p-4 border rounded-lg bg-green-50/50">
            <div className="flex items-center justify-between">
              <Label htmlFor="tp-level1" className="flex items-center gap-2 font-medium">
                {getLevelInfo(1, levels.level1)?.icon}
                Level 1 - Conservative
              </Label>
              <Badge variant="secondary" className={getLevelInfo(1, levels.level1)?.color}>
                {getLevelInfo(1, levels.level1)?.risk}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="tp-level1"
                type="number"
                min="1"
                max="100"
                step="0.5"
                value={levels.level1}
                onChange={(e) => updateLevel("level1", Number.parseFloat(e.target.value) || 5)}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground min-w-[20px]">%</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Multiplier: {calculateProfitInfo(levels.level1).multiplier}x</div>
              <div>$1000 → ${calculateProfitInfo(levels.level1).dollarProfit} profit</div>
              <div className="text-green-600">✓ Safe, steady gains</div>
            </div>
          </div>

          {/* Level 2 - Moderate */}
          <div className="space-y-3 p-4 border rounded-lg bg-blue-50/50">
            <div className="flex items-center justify-between">
              <Label htmlFor="tp-level2" className="flex items-center gap-2 font-medium">
                {getLevelInfo(2, levels.level2)?.icon}
                Level 2 - Moderate
              </Label>
              <Badge variant="secondary" className={getLevelInfo(2, levels.level2)?.color}>
                {getLevelInfo(2, levels.level2)?.risk}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="tp-level2"
                type="number"
                min="1"
                max="100"
                step="0.5"
                value={levels.level2}
                onChange={(e) => updateLevel("level2", Number.parseFloat(e.target.value) || 10)}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground min-w-[20px]">%</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Multiplier: {calculateProfitInfo(levels.level2).multiplier}x</div>
              <div>$1000 → ${calculateProfitInfo(levels.level2).dollarProfit} profit</div>
              <div className="text-blue-600">⚖️ Balanced approach</div>
            </div>
          </div>

          {/* Level 3 - Aggressive */}
          <div className="space-y-3 p-4 border rounded-lg bg-orange-50/50">
            <div className="flex items-center justify-between">
              <Label htmlFor="tp-level3" className="flex items-center gap-2 font-medium">
                {getLevelInfo(3, levels.level3)?.icon}
                Level 3 - Aggressive
              </Label>
              <Badge variant="secondary" className={getLevelInfo(3, levels.level3)?.color}>
                {getLevelInfo(3, levels.level3)?.risk}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="tp-level3"
                type="number"
                min="1"
                max="100"
                step="0.5"
                value={levels.level3}
                onChange={(e) => updateLevel("level3", Number.parseFloat(e.target.value) || 15)}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground min-w-[20px]">%</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Multiplier: {calculateProfitInfo(levels.level3).multiplier}x</div>
              <div>$1000 → ${calculateProfitInfo(levels.level3).dollarProfit} profit</div>
              <div className="text-orange-600">🚀 Higher rewards</div>
            </div>
          </div>

          {/* Level 4 - Very Aggressive */}
          <div className="space-y-3 p-4 border rounded-lg bg-red-50/50">
            <div className="flex items-center justify-between">
              <Label htmlFor="tp-level4" className="flex items-center gap-2 font-medium">
                {getLevelInfo(4, levels.level4)?.icon}
                Level 4 - Very Aggressive
              </Label>
              <Badge variant="secondary" className={getLevelInfo(4, levels.level4)?.color}>
                {getLevelInfo(4, levels.level4)?.risk}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="tp-level4"
                type="number"
                min="1"
                max="100"
                step="0.5"
                value={levels.level4}
                onChange={(e) => updateLevel("level4", Number.parseFloat(e.target.value) || 25)}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground min-w-[20px]">%</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Multiplier: {calculateProfitInfo(levels.level4).multiplier}x</div>
              <div>$1000 → ${calculateProfitInfo(levels.level4).dollarProfit} profit</div>
              <div className="text-red-600">⚠️ Maximum risk/reward</div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Default Level Selection */}
        <div className="space-y-4">
          <div className="space-y-3">
            <Label htmlFor="default-tp" className="text-base font-medium">
              Default Take Profit Level
            </Label>
            <p className="text-sm text-muted-foreground">
              This level will be used automatically for new trades unless you manually select a
              different one.
            </p>
            <Select
              value={levels.defaultLevel.toString()}
              onValueChange={(value) => updateDefaultLevel(Number.parseInt(value))}
            >
              <SelectTrigger id="default-tp" className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1" className="h-12">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-green-600" />
                      <span>Level 1 - Conservative ({levels.level1}%)</span>
                    </div>
                    <Badge variant="secondary" className="bg-green-100 text-green-800 ml-2">
                      Low Risk
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="2" className="h-12">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <span>Level 2 - Moderate ({levels.level2}%)</span>
                    </div>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 ml-2">
                      Medium Risk
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="3" className="h-12">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-orange-600" />
                      <span>Level 3 - Aggressive ({levels.level3}%)</span>
                    </div>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800 ml-2">
                      High Risk
                    </Badge>
                  </div>
                </SelectItem>
                <SelectItem value="4" className="h-12">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span>Level 4 - Very Aggressive ({levels.level4}%)</span>
                    </div>
                    <Badge variant="secondary" className="bg-red-100 text-red-800 ml-2">
                      Very High Risk
                    </Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Take Profit */}
          <div className="space-y-3 p-4 border rounded-lg bg-purple-50/50">
            <div className="flex items-center justify-between">
              <Label htmlFor="custom-tp" className="text-base font-medium">
                Custom Take Profit (Optional)
              </Label>
              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                Custom
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Set a specific percentage that's not covered by the preset levels. Leave empty to use
              preset levels only.
            </p>
            <div className="flex items-center gap-2">
              <Input
                id="custom-tp"
                type="number"
                min="1"
                max="1000"
                step="0.5"
                value={levels.custom || ""}
                onChange={(e) =>
                  updateCustomLevel(e.target.value ? Number.parseFloat(e.target.value) : null)
                }
                placeholder="e.g. 7.5 for 7.5% profit"
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground min-w-[20px]">%</span>
            </div>
            {levels.custom && (
              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                <div>Multiplier: {calculateProfitInfo(levels.custom).multiplier}x</div>
                <div>$1000 → ${calculateProfitInfo(levels.custom).dollarProfit} profit</div>
                <div className="text-purple-600">🎯 Your custom target</div>
              </div>
            )}
          </div>
        </div>

        {/* Risk Warning */}
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>Risk Warning:</strong> Higher profit targets mean the bot waits longer to sell,
            increasing the chance that prices may drop before reaching your target. Always consider
            your risk tolerance and never invest more than you can afford to lose.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
