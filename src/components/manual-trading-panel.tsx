"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle,
  DollarSign,
  Minus,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { useAccountBalance } from "../hooks/use-account-balance";
import { TransactionDebugPanel } from "./transaction-debug-panel";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Separator } from "./ui/separator";

interface ManualTradingPanelProps {
  userId: string;
  className?: string;
}

interface TradeOrder {
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  quantity: string;
  price?: string;
}

interface RecentExecution {
  id: number;
  symbolName: string;
  action: "buy" | "sell";
  executedQuantity: number;
  executedPrice: number | null;
  totalCost: number | null;
  fees: number | null;
  status: "success" | "failed";
  executedAt: string;
}

// Trading Form Component
const TradingForm = ({
  availableAssets,
  onTrade,
  isLoading,
}: {
  availableAssets: Array<{ asset?: string; free?: string; total?: number; locked?: string; usdtValue?: number }>;
  onTrade: (order: TradeOrder) => void;
  isLoading: boolean;
}) => {
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [selectedAsset, setSelectedAsset] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");

  const selectedAssetData = useMemo(
    () => availableAssets.find((a) => a.asset && a.asset === selectedAsset),
    [availableAssets, selectedAsset]
  );

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();

      if (!selectedAsset || !quantity) {
        toast.error("Missing Information", {
          description: "Please select an asset and enter quantity",
        });
        return;
      }

      if (orderType === "LIMIT" && !price) {
        toast.error("Missing Price", {
          description: "Limit orders require a price",
        });
        return;
      }

      // For sell orders, check if user has enough balance
      if (side === "SELL" && selectedAssetData) {
        const availableBalance = Number.parseFloat(selectedAssetData.free || "0");
        const requestedQuantity = Number.parseFloat(quantity);

        if (requestedQuantity > availableBalance) {
          toast.error("Insufficient Balance", {
            description: `You only have ${availableBalance} ${selectedAsset} available`,
          });
          return;
        }
      }

      const order: TradeOrder = {
        symbol: side === "BUY" ? `${selectedAsset}USDT` : `${selectedAsset}USDT`,
        side,
        type: orderType,
        quantity,
        ...(orderType === "LIMIT" && price && { price }),
      };

      onTrade(order);
    },
    [selectedAsset, quantity, price, orderType, side, selectedAssetData, onTrade]
  );

  const resetForm = useCallback(() => {
    setSelectedAsset("");
    setQuantity("");
    setPrice("");
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Manual Trading
        </CardTitle>
        <CardDescription>Place manual buy/sell orders for your holdings</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="side">Order Side</Label>
              <Select value={side} onValueChange={(value: "BUY" | "SELL") => setSide(value)}>
                <SelectTrigger className="bg-background border-border text-foreground hover:bg-accent/50 focus:ring-primary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  className="bg-popover border-border shadow-lg backdrop-blur-sm z-50"
                  position="popper"
                  sideOffset={4}
                  align="start"
                  avoidCollisions={true}
                >
                  <SelectItem value="BUY">
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="h-4 w-4 text-green-500" />
                      Buy
                    </div>
                  </SelectItem>
                  <SelectItem value="SELL">
                    <div className="flex items-center gap-2">
                      <ArrowDownRight className="h-4 w-4 text-red-500" />
                      Sell
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="orderType">Order Type</Label>
              <Select
                value={orderType}
                onValueChange={(value: "MARKET" | "LIMIT") => setOrderType(value)}
              >
                <SelectTrigger className="bg-background border-border text-foreground hover:bg-accent/50 focus:ring-primary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  className="bg-popover border-border shadow-lg backdrop-blur-sm z-50"
                  position="popper"
                  sideOffset={4}
                  align="start"
                  avoidCollisions={true}
                >
                  <SelectItem value="MARKET">Market</SelectItem>
                  <SelectItem value="LIMIT">Limit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="asset">Asset</Label>
            <div className="relative">
              <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                <SelectTrigger className="bg-background border-border text-foreground hover:bg-accent/50 focus:ring-primary/50">
                  <SelectValue placeholder="Select asset to trade" />
                </SelectTrigger>
                <SelectContent
                  className="bg-popover border-border shadow-lg backdrop-blur-sm max-h-[300px] overflow-y-auto min-w-[var(--radix-select-trigger-width)] z-50"
                  position="popper"
                  sideOffset={4}
                  align="start"
                  avoidCollisions={true}
                >
                  {side === "SELL"
                    ? // For selling, only show non-USDT assets the user owns
                      availableAssets
                        .filter(
                          (asset) => Number.parseFloat(asset.free || "0") > 0 && (asset.asset || "") !== "USDT"
                        )
                        .map((asset) => (
                          <SelectItem
                            key={asset.asset || ""}
                            value={asset.asset || ""}
                            className="focus:bg-accent focus:text-accent-foreground cursor-pointer min-h-[44px] sm:min-h-[32px]"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="font-medium">{asset.asset || ""}</span>
                              <span className="text-xs text-muted-foreground ml-2 shrink-0">
                                {Number.parseFloat(asset.free || "0").toFixed(4)} available
                              </span>
                            </div>
                          </SelectItem>
                        ))
                    : // For buying, only show assets the user owns (they can trade between their holdings)
                      availableAssets
                        .filter((asset) => Number.parseFloat(asset.free || "0") > 0)
                        .map((asset) => (
                          <SelectItem
                            key={asset.asset || ""}
                            value={asset.asset || ""}
                            className="focus:bg-accent focus:text-accent-foreground cursor-pointer min-h-[44px] sm:min-h-[32px]"
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="font-medium">{asset.asset || ""}</span>
                              <span className="text-xs text-muted-foreground ml-2 shrink-0">
                                {Number.parseFloat(asset.free || "0").toFixed(4)} available
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                </SelectContent>
              </Select>
            </div>
            {selectedAssetData && (
              <p className="text-xs text-muted-foreground mt-1">
                Available: {Number.parseFloat(selectedAssetData.free).toFixed(4)} {selectedAsset}
                {selectedAssetData.usdtValue && ` (≈ $${selectedAssetData.usdtValue.toFixed(2)})`}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <div className="flex gap-2">
              <Input
                id="quantity"
                type="number"
                step="any"
                placeholder="0.00"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="flex-1"
              />
              {selectedAssetData && side === "SELL" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuantity(selectedAssetData.free)}
                >
                  Max
                </Button>
              )}
            </div>
          </div>

          {orderType === "LIMIT" && (
            <div>
              <Label htmlFor="price">Price (USDT)</Label>
              <Input
                id="price"
                type="number"
                step="any"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          )}

          <Separator />

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isLoading || !selectedAsset || !quantity}
              className={`flex-1 transition-colors ${
                side === "BUY"
                  ? "bg-green-600 hover:bg-green-700 disabled:bg-green-400"
                  : "bg-red-600 hover:bg-red-700 disabled:bg-red-400"
              }`}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {side === "BUY" ? (
                    <Plus className="h-4 w-4 mr-2" />
                  ) : (
                    <Minus className="h-4 w-4 mr-2" />
                  )}
                  {side === "BUY" ? "Buy" : "Sell"} {selectedAsset || "Asset"}
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>
              Clear
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

// Recent Executions Component
const RecentExecutions = ({ userId }: { userId: string }) => {
  const { data: executions, isLoading } = useQuery<{ data: { executions: RecentExecution[] } }>({
    queryKey: ["execution-history", userId],
    queryFn: async () => {
      const response = await fetch(`/api/execution-history?userId=${userId}&limit=10`);
      if (!response.ok) throw new Error("Failed to fetch execution history");
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const executionList = executions?.data?.executions || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Trades</CardTitle>
        <CardDescription>Your latest trading activity</CardDescription>
      </CardHeader>
      <CardContent>
        {executionList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent trades found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {executionList.map((execution) => (
              <div
                key={execution.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      execution.action === "buy"
                        ? "bg-green-100 text-green-600"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {execution.action === "buy" ? (
                      <Plus className="h-4 w-4" />
                    ) : (
                      <Minus className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{execution.symbolName}</p>
                    <p className="text-xs text-muted-foreground">
                      {execution.executedQuantity.toFixed(4)} @ $
                      {execution.executedPrice?.toFixed(4)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <Badge variant={execution.status === "success" ? "default" : "destructive"}>
                      {execution.status === "success" ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 mr-1" />
                      )}
                      {execution.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {execution.totalCost ? `$${execution.totalCost.toFixed(2)}` : "-"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Main Component
export function ManualTradingPanel({ userId, className }: ManualTradingPanelProps) {
  const queryClient = useQueryClient();

  const { data: balanceData, refetch: refetchBalance } = useAccountBalance({
    userId,
    refreshInterval: 30000,
    enabled: !!userId,
  });

  const tradeMutation = useMutation({
    mutationFn: async (order: TradeOrder) => {
      const response = await fetch("/api/mexc/trade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...order,
          userId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Trade failed");
      }

      const result = await response.json();
      // Include original order info in the response for the callback
      return { ...result, originalOrder: order };
    },
    onSuccess: (data) => {
      const orderData = data.data;
      const originalOrder = data.originalOrder;
      const orderInfo = `${orderData?.side || originalOrder?.side || "Unknown"} ${orderData?.symbol || originalOrder?.symbol || "Unknown"}`;
      const orderId = orderData?.orderId || orderData?.data?.orderId || "N/A";

      toast.success("Trade Executed Successfully", {
        description: `${orderInfo} order completed. Order ID: ${orderId}`,
      });

      // Refresh both balance and execution history
      refetchBalance();
      queryClient.invalidateQueries({ queryKey: ["execution-history", userId] });

      // Form reset handled by component state management
    },
    onError: (error: Error) => {
      toast.error("Trade Failed", {
        description: `Unable to execute trade: ${error.message}. Please check your balance and credentials.`,
      });
    },
  });

  const availableAssets = useMemo(() => {
    return (
      balanceData?.balances?.filter(
        (balance) => Number.parseFloat(balance.free || "0") > 0 || Number.parseFloat(balance.locked || "0") > 0
      ) || []
    );
  }, [balanceData]);

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TradingForm
          availableAssets={availableAssets}
          onTrade={(order) => tradeMutation.mutate(order)}
          isLoading={tradeMutation.isPending}
        />
        <RecentExecutions userId={userId} />
      </div>

      {/* Transaction Debug Panel */}
      <TransactionDebugPanel userId={userId} />
    </div>
  );
}
