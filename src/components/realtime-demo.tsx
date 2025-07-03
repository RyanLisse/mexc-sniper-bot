"use client";

/**
 * Real-time Subscriptions Demo Component
 *
 * This component demonstrates how to use Supabase real-time subscriptions
 * for trading data in the MEXC Sniper Bot application.
 */

import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle,
  DollarSign,
  Info,
  Target,
  TrendingDown,
  TrendingUp,
  Wifi,
  WifiOff,
  XCircle,
  Zap,
} from "lucide-react";
import { useState } from "react";
import {
  useRealtimeBroadcast,
  useRealtimeConnection,
  useRealtimePrices,
  useRealtimeTradingData,
} from "@/src/hooks/use-supabase-realtime";
import { useAuth } from "@/src/lib/supabase-auth-client";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

interface RealtimeDemoProps {
  className?: string;
}

export function RealtimeDemo({ className = "" }: RealtimeDemoProps) {
  const { user } = useAuth();
  const [selectedSymbols, _setSelectedSymbols] = useState([
    "BTCUSDT",
    "ETHUSDT",
    "BNBUSDT",
  ]);

  // Real-time data hooks
  const tradingData = useRealtimeTradingData();
  const prices = useRealtimePrices(selectedSymbols);
  const connection = useRealtimeConnection();
  const { broadcastAlert, broadcastPrice } = useRealtimeBroadcast();

  // Test functions
  const handleTestConnection = async () => {
    try {
      const response = await fetch("/api/realtime/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "test_connection",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to test connection");
      }
    } catch (error) {
      console.error("Test connection failed:", error);
    }
  };

  const handleMockData = async () => {
    try {
      const response = await fetch("/api/realtime/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "mock_trading_data",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate mock data");
      }
    } catch (error) {
      console.error("Mock data generation failed:", error);
    }
  };

  const handleBroadcastPrice = async () => {
    const mockPrice = {
      symbol: "BTCUSDT",
      price: 45000 + (Math.random() - 0.5) * 2000,
      change: (Math.random() - 0.5) * 1000,
      changePercent: (Math.random() - 0.5) * 5,
      volume: Math.random() * 1000000,
    };

    try {
      const response = await fetch("/api/realtime/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "price_update",
          data: mockPrice,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to broadcast price");
      }
    } catch (error) {
      console.error("Price broadcast failed:", error);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(price);
  };

  const formatPercent = (percent: number) => {
    const isPositive = percent >= 0;
    return (
      <span className={isPositive ? "text-green-500" : "text-red-500"}>
        {isPositive ? (
          <TrendingUp className="h-3 w-3 inline mr-1" />
        ) : (
          <TrendingDown className="h-3 w-3 inline mr-1" />
        )}
        {Math.abs(percent).toFixed(2)}%
      </span>
    );
  };

  if (!user) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Please sign in to view real-time trading data
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {connection.connected ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-500" />
              )}
              <CardTitle>Real-time Connection</CardTitle>
            </div>
            <Badge variant={connection.connected ? "default" : "destructive"}>
              {connection.connected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          <CardDescription>
            Live trading data subscription status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">
                {connection.channels}
              </div>
              <div className="text-sm text-muted-foreground">
                Active Channels
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {connection.reconnectAttempts}
              </div>
              <div className="text-sm text-muted-foreground">
                Reconnect Attempts
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {tradingData.unreadAlerts}
              </div>
              <div className="text-sm text-muted-foreground">Unread Alerts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {tradingData.lastUpdate
                  ? new Date(tradingData.lastUpdate).toLocaleTimeString()
                  : "Never"}
              </div>
              <div className="text-sm text-muted-foreground">Last Update</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleTestConnection} variant="outline" size="sm">
              <Zap className="h-4 w-4 mr-2" />
              Test Connection
            </Button>
            <Button onClick={handleMockData} variant="outline" size="sm">
              <Activity className="h-4 w-4 mr-2" />
              Generate Mock Data
            </Button>
            <Button onClick={handleBroadcastPrice} variant="outline" size="sm">
              <DollarSign className="h-4 w-4 mr-2" />
              Broadcast Price
            </Button>
            <Button onClick={connection.disconnect} variant="outline" size="sm">
              <WifiOff className="h-4 w-4 mr-2" />
              Disconnect All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Price Updates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <DollarSign className="h-5 w-5 mr-2" />
            Real-time Prices
          </CardTitle>
          <CardDescription>
            Live price updates for {selectedSymbols.join(", ")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {prices.prices.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No price data available. Use the "Broadcast Price" button to
              simulate price updates.
            </div>
          ) : (
            <div className="space-y-3">
              {prices.prices.map((price) => (
                <div
                  key={price.symbol}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="font-medium">{price.symbol}</div>
                    <div className="text-2xl font-bold">
                      {formatPrice(price.price)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div>{formatPercent(price.changePercent)}</div>
                    <div className="text-sm text-muted-foreground">
                      Vol: {(price.volume / 1000000).toFixed(2)}M
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Portfolio Updates */}
      {tradingData.portfolio && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Portfolio Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {formatPrice(tradingData.portfolio.totalValue)}
                </div>
                <div className="text-sm text-muted-foreground">Total Value</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {formatPrice(tradingData.portfolio.totalPnl)}
                </div>
                <div className="text-sm text-muted-foreground">Total P&L</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {formatPercent(tradingData.portfolio.totalPnlPercent)}
                </div>
                <div className="text-sm text-muted-foreground">P&L %</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Snipe Targets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="h-5 w-5 mr-2" />
            Snipe Targets
            {tradingData.activeTargets.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {tradingData.activeTargets.length} active
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tradingData.snipeTargets.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              No snipe targets available
            </div>
          ) : (
            <div className="space-y-2">
              {tradingData.snipeTargets.slice(0, 5).map((target) => (
                <div
                  key={target.id}
                  className="flex items-center justify-between p-2 border rounded"
                >
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={
                        target.status === "active" ? "default" : "secondary"
                      }
                    >
                      {target.status}
                    </Badge>
                    <span className="font-medium">{target.symbol}</span>
                  </div>
                  <div className="text-right">
                    <div>Target: {formatPrice(target.triggerPrice)}</div>
                    <div className="text-sm text-muted-foreground">
                      Current: {formatPrice(target.currentPrice)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bell className="h-5 w-5 mr-2" />
            System Alerts
            {tradingData.unreadAlerts > 0 && (
              <Badge variant="destructive" className="ml-2">
                {tradingData.unreadAlerts} new
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Real-time system notifications and alerts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tradingData.alerts.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              No alerts yet. Use "Test Connection" to generate a test alert.
            </div>
          ) : (
            <div className="space-y-3">
              {tradingData.alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start space-x-3 p-3 border rounded-lg"
                >
                  {getAlertIcon(alert.type)}
                  <div className="flex-1">
                    <div className="font-medium">{alert.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {alert.message}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tradingData.alerts.length > 0 && (
            <div className="flex space-x-2 mt-4">
              <Button
                onClick={tradingData.markAlertsAsRead}
                variant="outline"
                size="sm"
              >
                Mark All Read
              </Button>
              <Button
                onClick={tradingData.clearAlerts}
                variant="outline"
                size="sm"
              >
                Clear All
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tradingData.transactions.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              No recent transactions
            </div>
          ) : (
            <div className="space-y-2">
              {tradingData.transactions
                .slice(0, 3)
                .map((transaction, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 border rounded"
                  >
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant={
                          transaction.eventType === "INSERT"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {transaction.eventType}
                      </Badge>
                      <span className="text-sm">Transaction Update</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(transaction.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
