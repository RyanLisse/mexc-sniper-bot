"use client";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { useAccountBalance } from "@/src/hooks/use-account-balance";
import { Eye, EyeOff, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import { useState } from "react";

interface AccountBalanceProps {
  userId?: string;
  className?: string;
}

export function AccountBalance({ userId = "default-user", className }: AccountBalanceProps) {
  const [showBalances, setShowBalances] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const {
    data: balanceData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useAccountBalance({
    userId,
    refreshInterval: autoRefresh ? 30000 : undefined,
    enabled: true,
  });

  const formatCurrency = (amount: number, decimals = 2) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  };

  const formatTokenAmount = (amount: number, _asset: string) => {
    const decimals = amount < 1 ? 6 : amount < 100 ? 4 : 2;
    return formatCurrency(amount, decimals);
  };

  const handleRefresh = () => refetch();
  const toggleVisibility = () => setShowBalances(!showBalances);
  const toggleAutoRefresh = () => setAutoRefresh(!autoRefresh);

  if (isError) {
    return (
      <Card className={`bg-slate-800/50 border-slate-700 backdrop-blur-sm ${className}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Wallet className="h-5 w-5 text-red-400" />
              <CardTitle className="text-lg text-white">Account Balance</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-400 text-sm">Failed to load account balance</p>
            <p className="text-slate-400 text-xs mt-1">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="mt-4 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-slate-800/50 border-slate-700 backdrop-blur-sm ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wallet className="h-5 w-5 text-yellow-400" />
            <CardTitle className="text-lg text-white">Account Balance</CardTitle>
            {isFetching && <RefreshCw className="h-4 w-4 animate-spin text-yellow-400" />}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAutoRefresh}
              className={`text-xs ${autoRefresh ? "text-green-400" : "text-slate-400"}`}
            >
              {autoRefresh ? "Auto" : "Manual"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleVisibility}
              className="text-slate-300 hover:text-white"
            >
              {showBalances ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        {balanceData?.lastUpdated && (
          <CardDescription className="text-xs text-slate-400">
            Last updated: {new Date(balanceData.lastUpdated).toLocaleTimeString()}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => ({
              id: `balance-loading-${Date.now()}-${i}`,
            })).map((item) => (
              <div key={item.id} className="animate-pulse">
                <div className="h-4 bg-slate-600/30 rounded w-3/4 mb-2" />
                <div className="h-3 bg-slate-600/30 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : balanceData ? (
          <>
            {/* Total Portfolio Value */}
            <div className="p-4 bg-gradient-to-r from-slate-700/50 to-slate-600/50 rounded-lg border border-slate-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-300">Total Portfolio Value</p>
                  <p className="text-2xl font-bold text-white">
                    {showBalances ? (
                      <span className="flex items-center">
                        <TrendingUp className="h-5 w-5 text-green-400 mr-2" />$
                        {formatCurrency(balanceData.totalUsdtValue)} USDT
                      </span>
                    ) : (
                      <span className="text-slate-400">••••••</span>
                    )}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs bg-slate-600 text-slate-200">
                  {balanceData.balances.length} assets
                </Badge>
              </div>
            </div>

            {/* Individual Balances */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-slate-300">Asset Breakdown</h4>
                {balanceData.balances.length > 5 && (
                  <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                    Showing top holdings
                  </Badge>
                )}
              </div>

              {balanceData.balances.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No balances found</p>
                  <p className="text-xs text-slate-500">Your account appears to be empty</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {balanceData.balances.slice(0, 10).map((balance) => (
                    <div
                      key={balance.asset}
                      className="flex items-center justify-between p-3 bg-slate-700/30 border border-slate-600/50 rounded-lg hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-yellow-400/20 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-yellow-400">
                            {balance.asset.slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm text-white">{balance.asset}</p>
                          {balance.locked !== "0" && (
                            <p className="text-xs text-slate-400">
                              {formatTokenAmount(Number.parseFloat(balance.locked), balance.asset)}{" "}
                              locked
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {showBalances ? (
                          <>
                            <p className="font-medium text-sm text-white">
                              {formatTokenAmount(balance.total, balance.asset)} {balance.asset}
                            </p>
                            {balance.usdtValue && balance.usdtValue > 0 && (
                              <p className="text-xs text-slate-400">
                                ≈ ${formatCurrency(balance.usdtValue)} USDT
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="font-medium text-sm text-slate-400">••••••</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {balanceData.balances.length > 10 && (
                    <div className="text-center py-2">
                      <Badge variant="outline" className="text-xs">
                        +{balanceData.balances.length - 10} more assets
                      </Badge>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No balance data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
