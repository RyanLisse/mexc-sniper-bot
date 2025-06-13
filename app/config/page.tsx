"use client";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { 
  Settings, 
  DollarSign, 
  Shield, 
  Target, 
  TrendingUp, 
  Activity,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  Key,
  Bell,
  Calendar,
  RefreshCw
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "@/src/lib/auth-client";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/src/components/dashboard-layout";

// TypeScript interfaces for configuration
interface TradingConfig {
  stopLoss: {
    enabled: boolean;
    percentage: number;
    amount: number;
    type: "percentage" | "amount";
  };
  takeProfit: {
    enabled: boolean;
    percentage: number;
    amount: number;
    type: "percentage" | "amount";
  };
  positionSizing: {
    defaultBuyAmount: number;
    maxPositionsPerToken: number;
    riskPerTrade: number;
  };
  riskManagement: {
    maxDailyLoss: number;
    maxOpenPositions: number;
    slippageTolerance: number;
  };
  apiCredentials: {
    mexcApiKey: string;
    mexcSecretKey: string;
    testMode: boolean;
  };
  notifications: {
    enabled: boolean;
    tradeExecution: boolean;
    patternDetection: boolean;
    riskAlerts: boolean;
  };
  tradingHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  patternDetection: {
    sensitivity: number;
    minAdvanceNotice: number;
    maxAdvanceNotice: number;
  };
}

const defaultConfig: TradingConfig = {
  stopLoss: {
    enabled: true,
    percentage: 5,
    amount: 50,
    type: "percentage"
  },
  takeProfit: {
    enabled: true,
    percentage: 15,
    amount: 150,
    type: "percentage"
  },
  positionSizing: {
    defaultBuyAmount: 100,
    maxPositionsPerToken: 1,
    riskPerTrade: 2
  },
  riskManagement: {
    maxDailyLoss: 500,
    maxOpenPositions: 5,
    slippageTolerance: 1
  },
  apiCredentials: {
    mexcApiKey: "",
    mexcSecretKey: "",
    testMode: true
  },
  notifications: {
    enabled: true,
    tradeExecution: true,
    patternDetection: true,
    riskAlerts: true
  },
  tradingHours: {
    enabled: false,
    startTime: "09:00",
    endTime: "17:00",
    timezone: "UTC"
  },
  patternDetection: {
    sensitivity: 85,
    minAdvanceNotice: 2,
    maxAdvanceNotice: 6
  }
};

export default function ConfigPage() {
  const [config, setConfig] = useState<TradingConfig>(defaultConfig);
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  
  // Get user info (middleware handles authentication protection)
  const { user, isLoading: authLoading } = useAuth();

  // Load config from database on mount
  useEffect(() => {
    if (authLoading) return; // Skip loading if auth is still loading
    const loadConfig = async () => {
      try {
        const userId = getUserId();
        const response = await fetch(`/api/agents/user/preferences/${userId}`);
        if (response.ok) {
          const preferences = await response.json();
          
          // Map database preferences to config format
          const mappedConfig: TradingConfig = {
            stopLoss: {
              enabled: preferences.stop_loss_enabled,
              percentage: preferences.stop_loss_percentage,
              amount: preferences.stop_loss_amount,
              type: preferences.stop_loss_type as "percentage" | "amount"
            },
            takeProfit: {
              enabled: preferences.take_profit_enabled,
              percentage: preferences.take_profit_percentage,
              amount: preferences.take_profit_amount,
              type: preferences.take_profit_type as "percentage" | "amount"
            },
            positionSizing: {
              defaultBuyAmount: preferences.default_buy_amount,
              maxPositionsPerToken: preferences.max_positions_per_token,
              riskPerTrade: preferences.risk_per_trade
            },
            riskManagement: {
              maxDailyLoss: preferences.max_daily_trades * preferences.default_buy_amount * 0.1, // Estimated
              maxOpenPositions: preferences.max_positions_per_token,
              slippageTolerance: 1 // Default value
            },
            apiCredentials: {
              mexcApiKey: "",
              mexcSecretKey: "",
              testMode: true
            },
            notifications: {
              enabled: preferences.telegram_notifications || preferences.email_notifications || preferences.discord_notifications,
              tradeExecution: true, // Default value
              patternDetection: preferences.pattern_monitoring_enabled,
              riskAlerts: true // Default value
            },
            tradingHours: {
              enabled: false, // Default value
              startTime: "09:00",
              endTime: "17:00",
              timezone: "UTC"
            },
            patternDetection: {
              sensitivity: 85, // Default value
              minAdvanceNotice: 2,
              maxAdvanceNotice: 6
            }
          };
          
          setConfig(mappedConfig);
        } else {
          // If no preferences found, use defaults
          console.log("No saved preferences found, using defaults");
        }
        
        // Also load API credentials
        const credentialsResponse = await fetch(`/api/agents/user/credentials/${userId}`);
        if (credentialsResponse.ok) {
          const credentials = await credentialsResponse.json();
          const mexcCreds = credentials.find((cred: { provider: string; has_api_key: boolean; has_secret_key: boolean; is_testnet: boolean }) => cred.provider === "mexc");
          if (mexcCreds) {
            setConfig(prev => ({
              ...prev,
              apiCredentials: {
                ...prev.apiCredentials,
                mexcApiKey: mexcCreds.has_api_key ? "••••••••" : "",
                mexcSecretKey: mexcCreds.has_secret_key ? "••••••••" : "",
                testMode: mexcCreds.is_testnet
              }
            }));
          }
        }
      } catch (error) {
        console.error("Failed to load config from database:", error);
        // Fallback to localStorage
        const savedConfig = localStorage.getItem("mexc-sniper-config");
        if (savedConfig) {
          try {
            setConfig(JSON.parse(savedConfig));
          } catch (error) {
            console.error("Failed to load config from localStorage:", error);
          }
        }
      }
    };

    loadConfig();
  }, [authLoading]);

  // Generate a simple user ID (in production, use proper authentication)
  const getUserId = () => {
    let userId = localStorage.getItem("mexc-user-id");
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("mexc-user-id", userId);
    }
    return userId;
  };

  // Don't render config while loading user info
  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Loading configuration...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Update config state and mark as dirty
  const updateConfig = (path: string[], value: unknown) => {
    setConfig(prev => {
      const newConfig = { ...prev };
      let current: Record<string, unknown> = newConfig;
      
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]] as Record<string, unknown>;
      }
      current[path[path.length - 1]] = value;
      
      return newConfig;
    });
    setIsDirty(true);
  };

  // Save configuration
  const saveConfig = async () => {
    setSaveStatus("saving");
    try {
      const userId = getUserId();
      
      // Map config to database preferences format
      const preferences = {
        stop_loss_enabled: config.stopLoss.enabled,
        stop_loss_type: config.stopLoss.type,
        stop_loss_percentage: config.stopLoss.percentage,
        stop_loss_amount: config.stopLoss.amount,
        
        take_profit_enabled: config.takeProfit.enabled,
        take_profit_type: config.takeProfit.type,
        take_profit_percentage: config.takeProfit.percentage,
        take_profit_amount: config.takeProfit.amount,
        
        default_buy_amount: config.positionSizing.defaultBuyAmount,
        max_positions_per_token: config.positionSizing.maxPositionsPerToken,
        risk_per_trade: config.positionSizing.riskPerTrade,
        
        pattern_monitoring_enabled: config.notifications.patternDetection,
        auto_trading_enabled: false, // Default value
        max_daily_trades: Math.floor(config.riskManagement.maxDailyLoss / config.positionSizing.defaultBuyAmount),
        
        telegram_notifications: config.notifications.enabled,
        email_notifications: false, // Default value
        discord_notifications: false, // Default value
      };
      
      // Save preferences to database
      const preferencesResponse = await fetch(`/api/agents/user/preferences/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferences),
      });
      
      if (!preferencesResponse.ok) {
        throw new Error("Failed to save preferences");
      }
      
      // Save API credentials if they're new (not masked)
      if (config.apiCredentials.mexcApiKey && 
          config.apiCredentials.mexcSecretKey && 
          !config.apiCredentials.mexcApiKey.includes("•") &&
          !config.apiCredentials.mexcSecretKey.includes("•")) {
        
        const credentialsPayload = {
          provider: "mexc",
          api_key: config.apiCredentials.mexcApiKey,
          secret_key: config.apiCredentials.mexcSecretKey,
          is_testnet: config.apiCredentials.testMode,
          nickname: "Main MEXC Account",
          permissions: ["spot_trading"]
        };
        
        const credentialsResponse = await fetch(`/api/agents/user/credentials/${userId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(credentialsPayload),
        });
        
        if (!credentialsResponse.ok) {
          console.error("Failed to save API credentials, but preferences were saved");
        }
      }
      
      // Also save to localStorage as backup
      localStorage.setItem("mexc-sniper-config", JSON.stringify(config));
      
      setSaveStatus("saved");
      setIsDirty(false);
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to save config:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  // Reset to defaults
  const resetToDefaults = () => {
    setConfig(defaultConfig);
    setIsDirty(true);
  };

  const maskApiKey = (key: string) => {
    if (!key || key.length < 8) return key;
    return key.substring(0, 4) + "•".repeat(key.length - 8) + key.substring(key.length - 4);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">API Configuration</h1>
            <p className="text-muted-foreground mt-1">Configure your trading parameters and risk management settings</p>
          </div>
          <div className="flex items-center space-x-3">
            {isDirty && (
              <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                Unsaved Changes
              </Badge>
            )}
            <Button 
              variant="outline" 
              onClick={resetToDefaults}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset to Defaults
            </Button>
            <Button 
              onClick={saveConfig}
              disabled={saveStatus === "saving"}
            >
              <Save className="mr-2 h-4 w-4" />
              {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : "Save Configuration"}
            </Button>
          </div>
        </div>

        {/* Configuration Sections */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Risk Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <Shield className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <CardTitle className="text-xl">Risk Management</CardTitle>
                  <CardDescription>Protect your capital with automated risk controls</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stop Loss */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Stop Loss</label>
                  <input
                    type="checkbox"
                    checked={config.stopLoss.enabled}
                    onChange={(e) => updateConfig(["stopLoss", "enabled"], e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                </div>
                {config.stopLoss.enabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400">Percentage (%)</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={config.stopLoss.percentage}
                        onChange={(e) => updateConfig(["stopLoss", "percentage"], parseFloat(e.target.value) || 0)}
                        className=""
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Amount (USDT)</label>
                      <Input
                        type="number"
                        value={config.stopLoss.amount}
                        onChange={(e) => updateConfig(["stopLoss", "amount"], parseFloat(e.target.value) || 0)}
                        className=""
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Take Profit */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Take Profit</label>
                  <input
                    type="checkbox"
                    checked={config.takeProfit.enabled}
                    onChange={(e) => updateConfig(["takeProfit", "enabled"], e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                </div>
                {config.takeProfit.enabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400">Percentage (%)</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={config.takeProfit.percentage}
                        onChange={(e) => updateConfig(["takeProfit", "percentage"], parseFloat(e.target.value) || 0)}
                        className=""
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Amount (USDT)</label>
                      <Input
                        type="number"
                        value={config.takeProfit.amount}
                        onChange={(e) => updateConfig(["takeProfit", "amount"], parseFloat(e.target.value) || 0)}
                        className=""
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* General Risk Settings */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Max Daily Loss (USDT)</label>
                  <Input
                    type="number"
                    value={config.riskManagement.maxDailyLoss}
                    onChange={(e) => updateConfig(["riskManagement", "maxDailyLoss"], parseFloat(e.target.value) || 0)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Max Open Positions</label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={config.riskManagement.maxOpenPositions}
                    onChange={(e) => updateConfig(["riskManagement", "maxOpenPositions"], parseInt(e.target.value) || 1)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Slippage Tolerance (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    value={config.riskManagement.slippageTolerance}
                    onChange={(e) => updateConfig(["riskManagement", "slippageTolerance"], parseFloat(e.target.value) || 0.1)}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Position Sizing */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <DollarSign className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-xl">Position Sizing</CardTitle>
                  <CardDescription>Configure your trade sizing and capital allocation</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Default Buy Amount (USDT)</label>
                <Input
                  type="number"
                  min="10"
                  value={config.positionSizing.defaultBuyAmount}
                  onChange={(e) => updateConfig(["positionSizing", "defaultBuyAmount"], parseFloat(e.target.value) || 10)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Max Positions Per Token</label>
                <Input
                  type="number"
                  min="1"
                  max="5"
                  value={config.positionSizing.maxPositionsPerToken}
                  onChange={(e) => updateConfig(["positionSizing", "maxPositionsPerToken"], parseInt(e.target.value) || 1)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Risk Per Trade (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10"
                  value={config.positionSizing.riskPerTrade}
                  onChange={(e) => updateConfig(["positionSizing", "riskPerTrade"], parseFloat(e.target.value) || 0.1)}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* API Credentials */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Key className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <CardTitle className="text-xl">API Credentials</CardTitle>
                  <CardDescription>MEXC exchange API configuration</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Test Mode</label>
                <input
                  type="checkbox"
                  checked={config.apiCredentials.testMode}
                  onChange={(e) => updateConfig(["apiCredentials", "testMode"], e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">MEXC API Key</label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowApiKeys(!showApiKeys)}
                    className="p-1 h-auto"
                  >
                    {showApiKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Input
                  type={showApiKeys ? "text" : "password"}
                  value={config.apiCredentials.mexcApiKey}
                  onChange={(e) => updateConfig(["apiCredentials", "mexcApiKey"], e.target.value)}
                  placeholder={showApiKeys ? "Enter your MEXC API key" : maskApiKey(config.apiCredentials.mexcApiKey)}
                  className="bg-slate-700/50 border-slate-600"
                />
              </div>
              <div>
                <label className="text-sm font-medium">MEXC Secret Key</label>
                <Input
                  type={showApiKeys ? "text" : "password"}
                  value={config.apiCredentials.mexcSecretKey}
                  onChange={(e) => updateConfig(["apiCredentials", "mexcSecretKey"], e.target.value)}
                  placeholder={showApiKeys ? "Enter your MEXC secret key" : maskApiKey(config.apiCredentials.mexcSecretKey)}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Pattern Detection */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Target className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <CardTitle className="text-xl">Pattern Detection</CardTitle>
                  <CardDescription>AI pattern recognition settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Detection Sensitivity (%)</label>
                <Input
                  type="number"
                  min="50"
                  max="99"
                  value={config.patternDetection.sensitivity}
                  onChange={(e) => updateConfig(["patternDetection", "sensitivity"], parseInt(e.target.value) || 85)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Higher values reduce false positives</p>
              </div>
              <div>
                <label className="text-sm font-medium">Min Advance Notice (hours)</label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="12"
                  value={config.patternDetection.minAdvanceNotice}
                  onChange={(e) => updateConfig(["patternDetection", "minAdvanceNotice"], parseFloat(e.target.value) || 2)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Max Advance Notice (hours)</label>
                <Input
                  type="number"
                  step="0.5"
                  min="1"
                  max="24"
                  value={config.patternDetection.maxAdvanceNotice}
                  onChange={(e) => updateConfig(["patternDetection", "maxAdvanceNotice"], parseFloat(e.target.value) || 6)}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Bell className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <CardTitle className="text-xl">Notifications</CardTitle>
                  <CardDescription>Alert preferences and settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Enable Notifications</label>
                <input
                  type="checkbox"
                  checked={config.notifications.enabled}
                  onChange={(e) => updateConfig(["notifications", "enabled"], e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700"
                />
              </div>
              {config.notifications.enabled && (
                <>
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Trade Execution</label>
                    <input
                      type="checkbox"
                      checked={config.notifications.tradeExecution}
                      onChange={(e) => updateConfig(["notifications", "tradeExecution"], e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Pattern Detection</label>
                    <input
                      type="checkbox"
                      checked={config.notifications.patternDetection}
                      onChange={(e) => updateConfig(["notifications", "patternDetection"], e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm">Risk Alerts</label>
                    <input
                      type="checkbox"
                      checked={config.notifications.riskAlerts}
                      onChange={(e) => updateConfig(["notifications", "riskAlerts"], e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Trading Hours */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                  <Calendar className="h-5 w-5 text-indigo-500" />
                </div>
                <div>
                  <CardTitle className="text-xl">Trading Hours</CardTitle>
                  <CardDescription>Set active trading time windows</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Enable Trading Hours</label>
                <input
                  type="checkbox"
                  checked={config.tradingHours.enabled}
                  onChange={(e) => updateConfig(["tradingHours", "enabled"], e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700"
                />
              </div>
              {config.tradingHours.enabled && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm">Start Time</label>
                      <Input
                        type="time"
                        value={config.tradingHours.startTime}
                        onChange={(e) => updateConfig(["tradingHours", "startTime"], e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm">End Time</label>
                      <Input
                        type="time"
                        value={config.tradingHours.endTime}
                        onChange={(e) => updateConfig(["tradingHours", "endTime"], e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm">Timezone</label>
                    <select
                      value={config.tradingHours.timezone}
                      onChange={(e) => updateConfig(["tradingHours", "timezone"], e.target.value)}
                      className="w-full mt-1 bg-background border rounded-md px-3 py-2"
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                      <option value="Europe/London">London</option>
                      <option value="Asia/Tokyo">Tokyo</option>
                      <option value="Asia/Shanghai">Shanghai</option>
                    </select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Configuration Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-muted rounded-lg">
                <Settings className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-xl">Configuration Summary</CardTitle>
                <CardDescription>Overview of your current trading setup</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <h4 className="font-medium text-green-500">Risk Controls</h4>
                <div className="text-sm space-y-1">
                  <p>Stop Loss: {config.stopLoss.enabled ? `${config.stopLoss.percentage}%` : "Disabled"}</p>
                  <p>Take Profit: {config.takeProfit.enabled ? `${config.takeProfit.percentage}%` : "Disabled"}</p>
                  <p>Max Daily Loss: ${config.riskManagement.maxDailyLoss}</p>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-blue-500">Position Sizing</h4>
                <div className="text-sm space-y-1">
                  <p>Default Buy: ${config.positionSizing.defaultBuyAmount}</p>
                  <p>Max Positions: {config.riskManagement.maxOpenPositions}</p>
                  <p>Risk Per Trade: {config.positionSizing.riskPerTrade}%</p>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-purple-500">System Settings</h4>
                <div className="text-sm space-y-1">
                  <p>API Mode: {config.apiCredentials.testMode ? "Test" : "Live"}</p>
                  <p>Notifications: {config.notifications.enabled ? "Enabled" : "Disabled"}</p>
                  <p>Trading Hours: {config.tradingHours.enabled ? "Restricted" : "24/7"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}