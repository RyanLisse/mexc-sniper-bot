"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/src/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { useToast } from "@/src/components/ui/use-toast";
import { 
  Save,
  Key,
  Shield,
  TrendingUp,
  DollarSign,
  Target,
  Bell,
  Calendar,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import { useUserPreferences, useUpdateUserPreferences } from "@/src/hooks/use-user-preferences";
import { useApiCredentials, useSaveApiCredentials, useTestApiCredentials } from "@/src/hooks/use-api-credentials";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { Switch } from "@/src/components/ui/switch";
import { Separator } from "@/src/components/ui/separator";

export default function SettingsPage() {
  const { toast } = useToast();
  
  // Using a dummy userId for now - in production this should come from auth
  const userId = "demo-user";
  
  const userPreferencesQuery = useUserPreferences(userId);
  const preferences = userPreferencesQuery.data;
  const prefsLoading = userPreferencesQuery.isLoading;
  
  const apiCredentialsQuery = useApiCredentials(userId);
  const credentials = apiCredentialsQuery.data;
  const credsLoading = apiCredentialsQuery.isLoading;
  
  const updatePreferencesMutation = useUpdateUserPreferences();
  const saveCredentialsMutation = useSaveApiCredentials();
  const testConnectionMutation = useTestApiCredentials();

  // State for form values
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  // Take profit levels
  const [takeProfitLevels, setTakeProfitLevels] = useState({
    level1: preferences?.takeProfitLevels?.level1 || 5,
    level2: preferences?.takeProfitLevels?.level2 || 10,
    level3: preferences?.takeProfitLevels?.level3 || 15,
    level4: preferences?.takeProfitLevels?.level4 || 25,
    custom: preferences?.takeProfitLevels?.custom || null,
    defaultLevel: preferences?.defaultTakeProfitLevel || 2
  });

  // Risk management
  const [riskSettings, setRiskSettings] = useState({
    stopLossPercent: preferences?.stopLossPercent || 5,
    riskTolerance: preferences?.riskTolerance || "medium",
    maxConcurrentSnipes: preferences?.maxConcurrentSnipes || 3,
    defaultBuyAmount: preferences?.defaultBuyAmountUsdt || 100
  });

  // Exit strategies
  const [exitStrategy, setExitStrategy] = useState(preferences?.selectedExitStrategy || "balanced");

  // Auto trading settings
  const [autoSettings, setAutoSettings] = useState({
    autoSnipeEnabled: preferences?.autoSnipeEnabled ?? true,
    autoBuyEnabled: preferences?.autoBuyEnabled ?? true,
    autoSellEnabled: preferences?.autoSellEnabled ?? true
  });

  // Initialize credentials if they exist
  useEffect(() => {
    if (credentials) {
      setApiKey(credentials.apiKey ? "••••••••" : "");
      setSecretKey(credentials.secretKey ? "••••••••" : "");
    }
  }, [credentials]);

  // Save all settings
  const handleSave = useCallback(async () => {
    try {
      // Save preferences
      await updatePreferencesMutation.mutateAsync({
        userId,
        takeProfitLevels: {
          level1: takeProfitLevels.level1,
          level2: takeProfitLevels.level2,
          level3: takeProfitLevels.level3,
          level4: takeProfitLevels.level4,
          custom: takeProfitLevels.custom || undefined,
        },
        defaultTakeProfitLevel: takeProfitLevels.defaultLevel,
        stopLossPercent: riskSettings.stopLossPercent,
        riskTolerance: riskSettings.riskTolerance as "low" | "medium" | "high",
        maxConcurrentSnipes: riskSettings.maxConcurrentSnipes,
        defaultBuyAmountUsdt: riskSettings.defaultBuyAmount,
        selectedExitStrategy: exitStrategy,
        autoSnipeEnabled: autoSettings.autoSnipeEnabled,
        autoBuyEnabled: autoSettings.autoBuyEnabled,
        autoSellEnabled: autoSettings.autoSellEnabled
      });

      // Save API credentials if they changed
      if (apiKey && !apiKey.includes("•") && secretKey && !secretKey.includes("•")) {
        await saveCredentialsMutation.mutateAsync({
          userId,
          provider: "mexc",
          apiKey,
          secretKey
        });
      }

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
    takeProfitLevels, 
    riskSettings, 
    exitStrategy, 
    autoSettings, 
    apiKey, 
    secretKey,
    updatePreferencesMutation.mutateAsync,
    saveCredentialsMutation.mutateAsync,
    toast
  ]);

  const handleTestConnection = async () => {
    try {
      const result = await testConnectionMutation.mutateAsync({ userId });
      if (result.success) {
        toast({
          title: "Connection successful",
          description: "Successfully connected to MEXC API.",
        });
      } else {
        toast({
          title: "Connection failed",
          description: "Failed to connect to MEXC API.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Connection error",
        description: "An error occurred while testing the connection.",
        variant: "destructive"
      });
    }
  };

  if (prefsLoading || credsLoading) {
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
              Configure your API keys, trading parameters, and risk management
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isDirty && (
              <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                Unsaved changes
              </Badge>
            )}
            <Button 
              onClick={handleSave}
              disabled={updatePreferencesMutation.isPending || saveCredentialsMutation.isPending || !isDirty}
            >
              <Save className="mr-2 h-4 w-4" />
              {updatePreferencesMutation.isPending || saveCredentialsMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="api" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="api">API Keys</TabsTrigger>
            <TabsTrigger value="profit">Take Profit</TabsTrigger>
            <TabsTrigger value="risk">Risk Management</TabsTrigger>
            <TabsTrigger value="automation">Automation</TabsTrigger>
          </TabsList>

          {/* API Keys Tab */}
          <TabsContent value="api" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  MEXC API Configuration
                </CardTitle>
                <CardDescription>
                  Connect your MEXC exchange account to enable automated trading
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="api-key">API Key</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowApiKeys(!showApiKeys)}
                      >
                        {showApiKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Input
                      id="api-key"
                      type={showApiKeys ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="Enter your MEXC API key"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secret-key">Secret Key</Label>
                    <Input
                      id="secret-key"
                      type={showApiKeys ? "text" : "password"}
                      value={secretKey}
                      onChange={(e) => {
                        setSecretKey(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="Enter your MEXC secret key"
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Connection Status</p>
                      <p className="text-xs text-muted-foreground">
                        {credentials?.isActive ? "Connected to MEXC" : "Not connected"}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={testConnectionMutation.isPending || (!apiKey || !secretKey || apiKey.includes("•"))}
                    >
                      {testConnectionMutation.isPending ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          {credentials?.isActive ? (
                            <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="mr-2 h-4 w-4 text-yellow-500" />
                          )}
                          Test Connection
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-4">
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    <strong>Security Note:</strong> Your API keys are encrypted and stored securely. 
                    Never share your secret key with anyone.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Take Profit Tab */}
          <TabsContent value="profit" className="space-y-4">
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
                        value={takeProfitLevels.level1}
                        onChange={(e) => {
                          setTakeProfitLevels(prev => ({ ...prev, level1: parseFloat(e.target.value) || 5 }));
                          setIsDirty(true);
                        }}
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
                        value={takeProfitLevels.level2}
                        onChange={(e) => {
                          setTakeProfitLevels(prev => ({ ...prev, level2: parseFloat(e.target.value) || 10 }));
                          setIsDirty(true);
                        }}
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
                        value={takeProfitLevels.level3}
                        onChange={(e) => {
                          setTakeProfitLevels(prev => ({ ...prev, level3: parseFloat(e.target.value) || 15 }));
                          setIsDirty(true);
                        }}
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
                        value={takeProfitLevels.level4}
                        onChange={(e) => {
                          setTakeProfitLevels(prev => ({ ...prev, level4: parseFloat(e.target.value) || 25 }));
                          setIsDirty(true);
                        }}
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
                      value={takeProfitLevels.defaultLevel.toString()}
                      onValueChange={(value) => {
                        setTakeProfitLevels(prev => ({ ...prev, defaultLevel: parseInt(value) }));
                        setIsDirty(true);
                      }}
                    >
                      <SelectTrigger id="default-tp">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Level 1 - Conservative ({takeProfitLevels.level1}%)</SelectItem>
                        <SelectItem value="2">Level 2 - Moderate ({takeProfitLevels.level2}%)</SelectItem>
                        <SelectItem value="3">Level 3 - Aggressive ({takeProfitLevels.level3}%)</SelectItem>
                        <SelectItem value="4">Level 4 - Very Aggressive ({takeProfitLevels.level4}%)</SelectItem>
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
                        value={takeProfitLevels.custom || ""}
                        onChange={(e) => {
                          setTakeProfitLevels(prev => ({ 
                            ...prev, 
                            custom: e.target.value ? parseFloat(e.target.value) : null 
                          }));
                          setIsDirty(true);
                        }}
                        placeholder="Custom percentage"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Risk Management Tab */}
          <TabsContent value="risk" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Risk Management
                </CardTitle>
                <CardDescription>
                  Control your risk exposure and position sizing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="stop-loss">Stop Loss</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="stop-loss"
                        type="number"
                        min="1"
                        max="50"
                        step="0.5"
                        value={riskSettings.stopLossPercent}
                        onChange={(e) => {
                          setRiskSettings(prev => ({ ...prev, stopLossPercent: parseFloat(e.target.value) || 5 }));
                          setIsDirty(true);
                        }}
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="risk-tolerance">Risk Tolerance</Label>
                    <Select
                      value={riskSettings.riskTolerance}
                      onValueChange={(value) => {
                        setRiskSettings(prev => ({ ...prev, riskTolerance: value as "low" | "medium" | "high" }));
                        setIsDirty(true);
                      }}
                    >
                      <SelectTrigger id="risk-tolerance">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low Risk</SelectItem>
                        <SelectItem value="medium">Medium Risk</SelectItem>
                        <SelectItem value="high">High Risk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-concurrent">Max Concurrent Positions</Label>
                    <Input
                      id="max-concurrent"
                      type="number"
                      min="1"
                      max="10"
                      value={riskSettings.maxConcurrentSnipes}
                      onChange={(e) => {
                        setRiskSettings(prev => ({ ...prev, maxConcurrentSnipes: parseInt(e.target.value) || 3 }));
                        setIsDirty(true);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="default-buy">Default Buy Amount</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="default-buy"
                        type="number"
                        min="10"
                        max="10000"
                        step="10"
                        value={riskSettings.defaultBuyAmount}
                        onChange={(e) => {
                          setRiskSettings(prev => ({ ...prev, defaultBuyAmount: parseFloat(e.target.value) || 100 }));
                          setIsDirty(true);
                        }}
                      />
                      <span className="text-sm text-muted-foreground">USDT</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="exit-strategy">Exit Strategy</Label>
                  <Select
                    value={exitStrategy}
                    onValueChange={(value) => {
                      setExitStrategy(value);
                      setIsDirty(true);
                    }}
                  >
                    <SelectTrigger id="exit-strategy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">Conservative - Early exits, preserve capital</SelectItem>
                      <SelectItem value="balanced">Balanced - Mix of safety and growth</SelectItem>
                      <SelectItem value="aggressive">Aggressive - Hold for maximum gains</SelectItem>
                      <SelectItem value="custom">Custom - Define your own strategy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Automation Tab */}
          <TabsContent value="automation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Automation Settings
                </CardTitle>
                <CardDescription>
                  Configure automated trading behaviors
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="auto-snipe">Auto-Snipe New Listings</Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically execute trades when patterns are detected
                      </p>
                    </div>
                    <Switch
                      id="auto-snipe"
                      checked={autoSettings.autoSnipeEnabled}
                      onCheckedChange={(checked) => {
                        setAutoSettings(prev => ({ ...prev, autoSnipeEnabled: checked }));
                        setIsDirty(true);
                      }}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="auto-buy">Auto-Buy on Ready State</Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically place buy orders when coins are ready
                      </p>
                    </div>
                    <Switch
                      id="auto-buy"
                      checked={autoSettings.autoBuyEnabled}
                      onCheckedChange={(checked) => {
                        setAutoSettings(prev => ({ ...prev, autoBuyEnabled: checked }));
                        setIsDirty(true);
                      }}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="auto-sell">Auto-Sell at Targets</Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically sell when take profit targets are reached
                      </p>
                    </div>
                    <Switch
                      id="auto-sell"
                      checked={autoSettings.autoSellEnabled}
                      onCheckedChange={(checked) => {
                        setAutoSettings(prev => ({ ...prev, autoSellEnabled: checked }));
                        setIsDirty(true);
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/20 p-4">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    <strong>Warning:</strong> Automated trading carries risks. Always monitor your positions 
                    and ensure you understand the implications of automated execution.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}