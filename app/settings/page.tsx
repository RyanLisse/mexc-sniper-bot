"use client";

import { useKindeBrowserClient } from "@kinde-oss/kinde-auth-nextjs";
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Target,
  TrendingUp,
  Wifi,
  WifiOff, 
  XCircle,
  Zap
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/src/components/dashboard-layout";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { useToast } from "@/src/components/ui/use-toast";
import { UnifiedAutomationSettings } from "@/src/components/unified-automation-settings";
import { UnifiedRiskManagement } from "@/src/components/unified-risk-management";
import { UnifiedTakeProfitSettings } from "@/src/components/unified-take-profit-settings";
import { calculateSyncHealthScore, formatSyncStatus, useTradingSettingsSync } from "@/src/hooks/use-trading-settings-sync";
import { useMultiLevelTakeProfit, useUpdateMultiLevelTakeProfit, useUpdateUserPreferences, useUserPreferences } from "@/src/hooks/use-user-preferences";
import { getTakeProfitStrategyById, TAKE_PROFIT_STRATEGIES, TakeProfitStrategy } from "@/src/types/take-profit-strategies";
export default function SettingsPage() {
  const { toast } = useToast();
  const { user, isLoading: userLoading } = useKindeBrowserClient();

  // Use authenticated user ID
  const userId = user?.id;

  const userPreferencesQuery = useUserPreferences(userId);
  const preferences = userPreferencesQuery.data;
  const prefsLoading = userPreferencesQuery.isLoading;

  const updatePreferencesMutation = useUpdateUserPreferences();

  // Multi-level take profit hooks
  const { config: multiLevelConfig } = useMultiLevelTakeProfit(userId || "");
  const updateMultiLevelTakeProfit = useUpdateMultiLevelTakeProfit();

  // Trading settings sync hooks
  const {
    settingsStatus,
    syncToExecutionSystem,
    updateExecutionSettings,
    isInSync,
    syncHealth,
    isUpdating: isSyncing,
    updateError: syncError,
    forceRefresh: refreshSyncStatus,
    isExecutionSystemActive,
    isAutoSnipingActive,
  } = useTradingSettingsSync(userId);

  // State for form values
  const [isDirty, setIsDirty] = useState(false);

  // Enhanced take profit strategy
  const [takeProfitStrategy, setTakeProfitStrategy] = useState(
    preferences?.takeProfitStrategy || "balanced"
  );
  const [customTakeProfitStrategy, setCustomTakeProfitStrategy] = useState<TakeProfitStrategy | undefined>(
    preferences?.takeProfitLevelsConfig ? JSON.parse(preferences.takeProfitLevelsConfig) : undefined
  );

  // Risk management
  const [riskSettings, setRiskSettings] = useState({
    stopLossPercent: preferences?.stopLossPercent || 5,
    riskTolerance: preferences?.riskTolerance || "medium",
    maxConcurrentSnipes: preferences?.maxConcurrentSnipes || 3,
    defaultBuyAmount: preferences?.defaultBuyAmountUsdt || 100
  });

  // Enhanced take profit handlers
  const handleTakeProfitStrategyChange = (strategyId: string) => {
    setTakeProfitStrategy(strategyId);
    setIsDirty(true);
  };

  const handleCustomTakeProfitStrategyChange = (strategy: TakeProfitStrategy) => {
    setCustomTakeProfitStrategy(strategy);
    setIsDirty(true);
  };

  // Exit strategies
  const [exitStrategy, setExitStrategy] = useState(preferences?.selectedExitStrategy || "balanced");

  // Auto trading settings
  const [autoSettings, setAutoSettings] = useState({
    autoSnipeEnabled: preferences?.autoSnipeEnabled ?? true,
    autoBuyEnabled: preferences?.autoBuyEnabled ?? true,
    autoSellEnabled: preferences?.autoSellEnabled ?? true
  });

  // Initialize state from preferences
  useEffect(() => {
    if (preferences) {
      setRiskSettings({
        stopLossPercent: preferences.stopLossPercent || 5,
        riskTolerance: preferences.riskTolerance || "medium",
        maxConcurrentSnipes: preferences.maxConcurrentSnipes || 3,
        defaultBuyAmount: preferences.defaultBuyAmountUsdt || 100
      });

      setExitStrategy(preferences.selectedExitStrategy || "balanced");

      setAutoSettings({
        autoSnipeEnabled: preferences.autoSnipeEnabled ?? true,
        autoBuyEnabled: preferences.autoBuyEnabled ?? true,
        autoSellEnabled: preferences.autoSellEnabled ?? true
      });
    }
  }, [preferences]);

  // Handle saving editable take-profit table
  const handleSaveMultiLevelTakeProfit = async (levels: any[]) => {
    console.info('Saving multi-level take-profit levels:', levels);

    // Update the multi-level configuration
    const updatedConfig = {
      ...multiLevelConfig,
      levels: levels.map((level, index) => ({
        ...level,
        level: level.level || `TP${index + 1}`, // Ensure level is set
      })),
      enabled: true, // Enable when levels are saved
    };

    try {
      await updateMultiLevelTakeProfit.mutateAsync({
        userId: userId || "",
        config: updatedConfig,
      });

      toast({
        title: "Multi-Level Take-Profit Saved",
        description: "Your advanced take-profit configuration has been updated successfully.",
      });

      console.info('✅ Successfully saved multi-level take-profit configuration');
    } catch (error) {
      console.error('❌ Failed to save multi-level take-profit configuration:', { error: error instanceof Error ? error.message : String(error) });

      toast({
        title: "Error saving take-profit configuration",
        description: "Failed to save your multi-level take-profit configuration. Please try again.",
        variant: "destructive"
      });

      throw error; // Re-throw to trigger error handling in component
    }
  };

  // Save all settings
  const handleSave = useCallback(async () => {
    try {
      // Save preferences
      await updatePreferencesMutation.mutateAsync({
        userId: userId || "",
        // Enhanced take profit strategy
        takeProfitStrategy: takeProfitStrategy,
        takeProfitLevelsConfig: JSON.stringify(customTakeProfitStrategy),
        stopLossPercent: riskSettings.stopLossPercent,
        riskTolerance: riskSettings.riskTolerance as "low" | "medium" | "high",
        maxConcurrentSnipes: riskSettings.maxConcurrentSnipes,
        defaultBuyAmountUsdt: riskSettings.defaultBuyAmount,
        selectedExitStrategy: exitStrategy,
        autoSnipeEnabled: autoSettings.autoSnipeEnabled,
        autoBuyEnabled: autoSettings.autoBuyEnabled,
        autoSellEnabled: autoSettings.autoSellEnabled
      });

      setIsDirty(false);
      toast({
        title: "Settings saved",
        description: "Your trading configuration has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Error saving settings",
        description: "Failed to save your configuration. Please try again.",
        variant: "destructive"
      });
    }
  }, [
    takeProfitStrategy,
    customTakeProfitStrategy,
    riskSettings,
    exitStrategy,
    autoSettings,
    updatePreferencesMutation.mutateAsync,
    toast,
    userId
  ]);

  // Sync settings to execution system
  const handleSyncToExecution = useCallback(async () => {
    try {
      await syncToExecutionSystem();
      
      toast({
        title: "Settings synced",
        description: "Your settings have been applied to the trading execution system.",
      });
    } catch (error) {
      console.error("Failed to sync settings:", error);
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Failed to sync settings to execution system.",
        variant: "destructive",
      });
    }
  }, [syncToExecutionSystem, toast]);

  if (prefsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Loading settings...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Trading Settings</h1>
            <p className="text-muted-foreground mt-1">
              Configure your trading parameters, risk management, and automation preferences
            </p>
            {/* Sync status indicator */}
            <div className="flex items-center space-x-4 mt-3">
              <div className="flex items-center space-x-2">
                {isInSync ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-orange-500" />
                )}
                <span className="text-sm text-muted-foreground">
                  Execution System: {formatSyncStatus(settingsStatus?.syncStatus)}
                </span>
              </div>
              
              {isExecutionSystemActive && (
                <div className="flex items-center space-x-2">
                  <Wifi className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600 font-medium">
                    Trading Active
                  </span>
                </div>
              )}
              
              {isAutoSnipingActive && (
                <div className="flex items-center space-x-2">
                  <Zap className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-blue-600 font-medium">
                    Auto-Sniping Active
                  </span>
                </div>
              )}
              
              {syncError && (
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-600">
                    Sync Error
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Sync health indicator */}
            <div className="flex items-center gap-2">
              {settingsStatus && (
                <Badge 
                  variant={calculateSyncHealthScore(syncHealth) > 80 ? "default" : "destructive"}
                  className="text-xs"
                >
                  Health: {calculateSyncHealthScore(syncHealth)}%
                </Badge>
              )}
            </div>
            
            {isDirty && (
              <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                Unsaved changes
              </Badge>
            )}
            
            {!isInSync && !isDirty && (
              <Badge variant="outline" className="border-orange-500 text-orange-600">
                Out of sync
              </Badge>
            )}
            
            {/* Sync to execution button */}
            <Button
              onClick={handleSyncToExecution}
              disabled={isSyncing || !userId}
              variant="outline"
              size="sm"
            >
              <Zap className="mr-2 h-4 w-4" />
              {isSyncing ? "Syncing..." : "Sync to Execution"}
            </Button>
            
            {/* Save settings button */}
            <Button
              onClick={handleSave}
              disabled={updatePreferencesMutation.isPending || !isDirty}
            >
              <Save className="mr-2 h-4 w-4" />
              {updatePreferencesMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {/* System Check Notice */}
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Settings className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">API Credentials & System Configuration</p>
                <p className="text-xs text-muted-foreground">
                  Manage API keys, system health checks, and environment configuration in System Check
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('/config', '_self')}
                className="border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                System Check
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="profit" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profit">Take Profit</TabsTrigger>
            <TabsTrigger value="risk">Risk Management</TabsTrigger>
            <TabsTrigger value="automation">Automation</TabsTrigger>
          </TabsList>

          {/* Take Profit Tab */}
          <TabsContent value="profit" className="space-y-4">
            <UnifiedTakeProfitSettings
              selectedStrategy={takeProfitStrategy}
              customStrategy={customTakeProfitStrategy}
              onStrategyChange={handleTakeProfitStrategyChange}
              onCustomStrategyChange={handleCustomTakeProfitStrategyChange}
              investmentAmount={riskSettings.defaultBuyAmount}
            />
          </TabsContent>

          {/* Risk Management Tab */}
          <TabsContent value="risk" className="space-y-4">
            <UnifiedRiskManagement
              settings={riskSettings}
              exitStrategy={exitStrategy}
              onSettingsChange={setRiskSettings}
              onExitStrategyChange={setExitStrategy}
              onDirty={() => setIsDirty(true)}
            />
          </TabsContent>

          {/* Automation Tab */}
          <TabsContent value="automation" className="space-y-4">
            <UnifiedAutomationSettings
              settings={autoSettings}
              onSettingsChange={setAutoSettings}
              onDirty={() => setIsDirty(true)}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}