"use client";

import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import type { ExitStrategy } from "@/src/types/exit-strategies";
import {
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Save,
  Settings,
  Target,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { ExitStrategySelector } from "./exit-strategy-selector";
import { TakeProfitHelp } from "./take-profit-help";
import { UnifiedTakeProfitLevels } from "./unified-take-profit-levels";

interface TakeProfitLevels {
  level1: number;
  level2: number;
  level3: number;
  level4: number;
  custom: number | null;
  defaultLevel: number;
}

interface EnhancedProfitSettingsProps {
  // Take Profit Props
  levels: TakeProfitLevels;
  onLevelsChange: (updater: (prev: TakeProfitLevels) => TakeProfitLevels) => void;

  // Exit Strategy Props
  selectedStrategy: string;
  customStrategy?: ExitStrategy;
  autoBuyEnabled: boolean;
  autoSellEnabled: boolean;
  onStrategyChange: (strategyId: string) => void;
  onCustomStrategyChange: (strategy: ExitStrategy) => void;
  onAutoBuyToggle: (enabled: boolean) => void;
  onAutoSellToggle: (enabled: boolean) => void;

  // Common Props
  onSave: () => void;
  isSaving: boolean;
  isDirty: boolean;
}

export function EnhancedProfitSettings({
  levels,
  onLevelsChange,
  selectedStrategy,
  customStrategy,
  autoBuyEnabled,
  autoSellEnabled,
  onStrategyChange,
  onCustomStrategyChange,
  onAutoBuyToggle,
  onAutoSellToggle,
  onSave,
  isSaving,
  isDirty,
}: EnhancedProfitSettingsProps) {
  const [activeTab, setActiveTab] = useState("basic");

  const handleDirty = () => {
    // Mark as dirty for save state
  };

  const getConfigurationStatus = () => {
    const hasBasicConfig = levels.defaultLevel > 0;
    const hasAutomation = autoBuyEnabled || autoSellEnabled;
    const hasStrategy = selectedStrategy !== "";

    return {
      isComplete: hasBasicConfig && hasAutomation && hasStrategy,
      completedSteps: [hasBasicConfig, hasAutomation, hasStrategy].filter(Boolean).length,
      totalSteps: 3,
    };
  };

  const status = getConfigurationStatus();

  return (
    <div className="space-y-6">
      {/* Configuration Status */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600" />
              Profit Management Configuration
            </div>
            <Badge
              variant={status.isComplete ? "default" : "secondary"}
              className={status.isComplete ? "bg-green-600" : "bg-orange-600"}
            >
              {status.completedSteps}/{status.totalSteps} Complete
            </Badge>
          </CardTitle>
          <CardDescription>
            Configure when and how to take profits automatically. Complete all sections for optimal
            trading.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              {levels.defaultLevel > 0 ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              )}
              <span>Basic Levels</span>
            </div>
            <div className="flex items-center gap-2">
              {autoBuyEnabled || autoSellEnabled ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              )}
              <span>Automation</span>
            </div>
            <div className="flex items-center gap-2">
              {selectedStrategy ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              )}
              <span>Exit Strategy</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Configuration Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Basic Take Profit
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Exit Strategies
          </TabsTrigger>
          <TabsTrigger value="help" className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Help & Guide
          </TabsTrigger>
        </TabsList>

        {/* Basic Take Profit Tab */}
        <TabsContent value="basic" className="space-y-6">
          <UnifiedTakeProfitLevels
            levels={levels}
            onLevelsChange={onLevelsChange}
            onDirty={handleDirty}
          />
        </TabsContent>

        {/* Advanced Exit Strategies Tab */}
        <TabsContent value="advanced" className="space-y-6">
          <ExitStrategySelector
            selectedStrategy={selectedStrategy}
            customStrategy={customStrategy}
            autoBuyEnabled={autoBuyEnabled}
            autoSellEnabled={autoSellEnabled}
            onStrategyChange={onStrategyChange}
            onCustomStrategyChange={onCustomStrategyChange}
            onAutoBuyToggle={onAutoBuyToggle}
            onAutoSellToggle={onAutoSellToggle}
          />
        </TabsContent>

        {/* Help & Guide Tab */}
        <TabsContent value="help" className="space-y-6">
          <TakeProfitHelp />

          {/* Quick Setup Guide */}
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                Quick Setup Guide
              </CardTitle>
              <CardDescription className="text-green-600">
                Follow these steps to get started with automated profit taking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <Badge className="bg-green-600 text-white min-w-[24px] h-6 flex items-center justify-center">
                    1
                  </Badge>
                  <div>
                    <div className="font-medium">Set Your Risk Level</div>
                    <div className="text-muted-foreground">
                      Choose Level 2 (Moderate) for balanced risk/reward as your default
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Badge className="bg-green-600 text-white min-w-[24px] h-6 flex items-center justify-center">
                    2
                  </Badge>
                  <div>
                    <div className="font-medium">Enable Auto-Trading</div>
                    <div className="text-muted-foreground">
                      Turn on Auto-Buy and Auto-Sell in the Exit Strategies tab
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Badge className="bg-green-600 text-white min-w-[24px] h-6 flex items-center justify-center">
                    3
                  </Badge>
                  <div>
                    <div className="font-medium">Choose Exit Strategy</div>
                    <div className="text-muted-foreground">
                      Select "Balanced 3x Target" for gradual profit taking
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Badge className="bg-green-600 text-white min-w-[24px] h-6 flex items-center justify-center">
                    4
                  </Badge>
                  <div>
                    <div className="font-medium">Save & Test</div>
                    <div className="text-muted-foreground">
                      Save your settings and start with small amounts to test
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Section */}
      {isDirty && (
        <Alert className="border-blue-200 bg-blue-50">
          <AlertTriangle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="flex items-center justify-between w-full">
            <span className="text-blue-800">You have unsaved changes to your profit settings.</span>
            <Button
              onClick={onSave}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSaving ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
