"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { Separator } from "@/src/components/ui/separator";
import { TrendingUp } from "lucide-react";

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

export function UnifiedTakeProfitLevels({ levels, onLevelsChange, onDirty }: TakeProfitLevelsProps) {
  const updateLevel = (level: string, value: number) => {
    onLevelsChange(prev => ({ ...prev, [level]: value }));
    onDirty();
  };

  const updateCustomLevel = (value: number | null) => {
    onLevelsChange(prev => ({ ...prev, custom: value }));
    onDirty();
  };

  const updateDefaultLevel = (level: number) => {
    onLevelsChange(prev => ({ ...prev, defaultLevel: level }));
    onDirty();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Take Profit Configuration
        </CardTitle>
        <CardDescription>
          Set your profit targets for automated selling
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tp-level1">Level 1 (Conservative)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="tp-level1"
                type="number"
                min="1"
                max="100"
                step="0.5"
                value={levels.level1}
                onChange={(e) => updateLevel('level1', parseFloat(e.target.value) || 5)}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tp-level2">Level 2 (Moderate)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="tp-level2"
                type="number"
                min="1"
                max="100"
                step="0.5"
                value={levels.level2}
                onChange={(e) => updateLevel('level2', parseFloat(e.target.value) || 10)}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tp-level3">Level 3 (Aggressive)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="tp-level3"
                type="number"
                min="1"
                max="100"
                step="0.5"
                value={levels.level3}
                onChange={(e) => updateLevel('level3', parseFloat(e.target.value) || 15)}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tp-level4">Level 4 (Very Aggressive)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="tp-level4"
                type="number"
                min="1"
                max="100"
                step="0.5"
                value={levels.level4}
                onChange={(e) => updateLevel('level4', parseFloat(e.target.value) || 25)}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="default-tp">Default Take Profit Level</Label>
            <Select
              value={levels.defaultLevel.toString()}
              onValueChange={(value) => updateDefaultLevel(parseInt(value))}
            >
              <SelectTrigger id="default-tp">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Level 1 - Conservative ({levels.level1}%)</SelectItem>
                <SelectItem value="2">Level 2 - Moderate ({levels.level2}%)</SelectItem>
                <SelectItem value="3">Level 3 - Aggressive ({levels.level3}%)</SelectItem>
                <SelectItem value="4">Level 4 - Very Aggressive ({levels.level4}%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-tp">Custom Take Profit (Optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="custom-tp"
                type="number"
                min="1"
                max="100"
                step="0.5"
                value={levels.custom || ""}
                onChange={(e) => updateCustomLevel(e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Custom percentage"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}