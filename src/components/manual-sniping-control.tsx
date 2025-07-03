"use client";

import {
  AlertTriangle,
  DollarSign,
  Loader2,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface ManualSnipeParams {
  symbol: string;
  side: "BUY" | "SELL";
  orderType: "MARKET" | "LIMIT";
  quantity?: number;
  quoteOrderQty?: number;
  price?: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  strategy: string;
}

interface SnipeResult {
  success: boolean;
  orderId?: string;
  executedQty?: string;
  price?: string;
  error?: string;
}

export function ManualSnipingControl() {
  const [params, setParams] = useState<ManualSnipeParams>({
    symbol: "",
    side: "BUY",
    orderType: "MARKET",
    strategy: "manual",
  });

  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<SnipeResult | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);

  // Estimate trade cost
  const estimateCost = useCallback(async () => {
    if (!params.symbol || (!params.quantity && !params.quoteOrderQty)) return;

    try {
      // This would typically call a price estimation API
      const mockPrice = 100; // In real app, fetch current price
      const cost = params.quoteOrderQty || (params.quantity || 0) * mockPrice;
      setEstimatedCost(cost);
    } catch (error) {
      console.error("Failed to estimate cost:", error);
    }
  }, [params.symbol, params.quantity, params.quoteOrderQty]);

  // Execute manual snipe
  const executeSnipe = async () => {
    if (!params.symbol) {
      setResult({ success: false, error: "Symbol is required" });
      return;
    }

    setIsExecuting(true);
    setResult(null);

    try {
      // First create a snipe target
      const createTargetResponse = await fetch("/api/snipe-targets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "manual_user",
          vcoinId: params.symbol,
          symbolName: params.symbol,
          entryStrategy: params.strategy,
          positionSizeUsdt: params.quoteOrderQty || 100,
          takeProfitLevel: params.takeProfitPercent || 10,
          stopLossPercent: params.stopLossPercent || 5,
          status: "executing",
          priority: 1,
          targetExecutionTime: Math.floor(Date.now() / 1000),
          confidenceScore: 85,
          riskLevel: "medium",
        }),
      });

      if (!createTargetResponse.ok) {
        throw new Error("Failed to create snipe target");
      }

      // Execute the trade via MEXC API
      const tradeResponse = await fetch("/api/mexc/trade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          symbol: params.symbol.endsWith("USDT")
            ? params.symbol
            : `${params.symbol}USDT`,
          side: params.side,
          type: params.orderType,
          quantity: params.quantity?.toString(),
          quoteOrderQty: params.quoteOrderQty?.toString(),
          price: params.price?.toString(),
          timeInForce: "IOC",
          isManualSnipe: true,
          stopLossPercent: params.stopLossPercent,
          takeProfitPercent: params.takeProfitPercent,
        }),
      });

      const tradeResult = await tradeResponse.json();

      if (tradeResult.success && tradeResult.order) {
        setResult({
          success: true,
          orderId: tradeResult.order.orderId,
          executedQty:
            tradeResult.order.executedQty || tradeResult.order.quantity,
          price: tradeResult.order.price || tradeResult.order.avgPrice,
        });
      } else {
        setResult({
          success: false,
          error:
            tradeResult.error ||
            tradeResult.message ||
            "Trade execution failed",
        });
      }
    } catch (error) {
      setResult({
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const validateForm = () => {
    if (!params.symbol) return false;
    if (params.orderType === "LIMIT" && !params.price) return false;
    if (!params.quantity && !params.quoteOrderQty) return false;
    return true;
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Manual Snipe Execution</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Symbol Input */}
          <div className="space-y-2">
            <Label htmlFor="symbol">Trading Symbol</Label>
            <Input
              id="symbol"
              placeholder="e.g., BTC, ETH, DOGE"
              value={params.symbol}
              onChange={(e) =>
                setParams((prev) => ({
                  ...prev,
                  symbol: e.target.value.toUpperCase(),
                }))
              }
              onBlur={estimateCost}
            />
          </div>

          {/* Order Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="side">Order Side</Label>
              <Select
                value={params.side}
                onValueChange={(value: "BUY" | "SELL") =>
                  setParams((prev) => ({ ...prev, side: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUY">Buy</SelectItem>
                  <SelectItem value="SELL">Sell</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orderType">Order Type</Label>
              <Select
                value={params.orderType}
                onValueChange={(value: "MARKET" | "LIMIT") =>
                  setParams((prev) => ({ ...prev, orderType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARKET">Market</SelectItem>
                  <SelectItem value="LIMIT">Limit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quantity/Amount */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quoteOrderQty">Amount (USDT)</Label>
              <Input
                id="quoteOrderQty"
                type="number"
                placeholder="100"
                value={params.quoteOrderQty || ""}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    quoteOrderQty: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  }))
                }
                onBlur={estimateCost}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity (Tokens)</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="Optional"
                value={params.quantity || ""}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    quantity: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  }))
                }
                onBlur={estimateCost}
              />
            </div>
          </div>

          {/* Limit Price (if LIMIT order) */}
          {params.orderType === "LIMIT" && (
            <div className="space-y-2">
              <Label htmlFor="price">Limit Price (USDT)</Label>
              <Input
                id="price"
                type="number"
                step="0.00000001"
                placeholder="0.00000000"
                value={params.price || ""}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    price: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  }))
                }
              />
            </div>
          )}

          {/* Risk Management */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stopLoss">Stop Loss (%)</Label>
              <Input
                id="stopLoss"
                type="number"
                placeholder="5"
                value={params.stopLossPercent || ""}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    stopLossPercent: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="takeProfit">Take Profit (%)</Label>
              <Input
                id="takeProfit"
                type="number"
                placeholder="10"
                value={params.takeProfitPercent || ""}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    takeProfitPercent: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  }))
                }
              />
            </div>
          </div>

          {/* Strategy Selection */}
          <div className="space-y-2">
            <Label htmlFor="strategy">Trading Strategy</Label>
            <Select
              value={params.strategy}
              onValueChange={(value) =>
                setParams((prev) => ({ ...prev, strategy: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="conservative">Conservative</SelectItem>
                <SelectItem value="aggressive">Aggressive</SelectItem>
                <SelectItem value="scalping">Scalping</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Estimated Cost */}
          {estimatedCost && (
            <Card className="bg-blue-50/5 border-blue-500/20">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-blue-400" />
                  <span className="text-blue-400 font-medium">
                    Estimated Cost: ${estimatedCost.toFixed(2)} USDT
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Execute Button */}
          <Button
            onClick={executeSnipe}
            disabled={!validateForm() || isExecuting}
            className="w-full"
            variant={params.side === "BUY" ? "default" : "destructive"}
          >
            {isExecuting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            {isExecuting ? "Executing..." : `Execute ${params.side} Order`}
          </Button>
        </CardContent>
      </Card>

      {/* Result Display */}
      {result && (
        <Card
          className={`${
            result.success
              ? "bg-green-50/5 border-green-500/20"
              : "bg-red-50/5 border-red-500/20"
          }`}
        >
          <CardHeader>
            <CardTitle
              className={`flex items-center space-x-2 ${
                result.success ? "text-green-400" : "text-red-400"
              }`}
            >
              {result.success ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
              <span>
                {result.success
                  ? "Trade Executed Successfully"
                  : "Trade Failed"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.success ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Order ID:</span>
                    <span className="ml-2 text-green-400 font-mono">
                      {result.orderId}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Executed Quantity:</span>
                    <span className="ml-2 text-green-400">
                      {result.executedQty}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Price:</span>
                    <span className="ml-2 text-green-400">${result.price}</span>
                  </div>
                </div>
                <Alert className="border-green-500/20 bg-green-50/5">
                  <TrendingUp className="h-4 w-4" />
                  <AlertDescription className="text-green-300">
                    Your order has been executed successfully. Position
                    monitoring has been activated
                    {params.stopLossPercent &&
                      ` with ${params.stopLossPercent}% stop loss`}
                    {params.takeProfitPercent &&
                      ` and ${params.takeProfitPercent}% take profit`}
                    .
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <Alert className="border-red-500/20 bg-red-50/5">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-red-300">
                  {result.error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setParams((prev) => ({
                  ...prev,
                  side: "BUY",
                  orderType: "MARKET",
                  quoteOrderQty: 50,
                  stopLossPercent: 5,
                  takeProfitPercent: 10,
                }))
              }
            >
              Quick Buy $50
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setParams((prev) => ({
                  ...prev,
                  side: "BUY",
                  orderType: "MARKET",
                  quoteOrderQty: 100,
                  stopLossPercent: 3,
                  takeProfitPercent: 15,
                }))
              }
            >
              Quick Buy $100
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setParams((prev) => ({
                  ...prev,
                  side: "BUY",
                  orderType: "MARKET",
                  quoteOrderQty: 250,
                  stopLossPercent: 2,
                  takeProfitPercent: 20,
                }))
              }
            >
              Quick Buy $250
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() =>
                setParams({
                  symbol: "",
                  side: "BUY",
                  orderType: "MARKET",
                  strategy: "manual",
                })
              }
            >
              Clear Form
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
