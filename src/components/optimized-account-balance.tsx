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
import { useCurrencyFormatting } from "@/src/hooks/use-currency-formatting";
import { Eye, EyeOff, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import React, { useCallback, useMemo } from "react";
import { useState } from "react";

interface AccountBalanceProps {
  userId?: string;
  className?: string;
}

interface BalanceItem {
  asset: string;
  free: string;
  locked: string;
  total: number;
  usdtValue?: number;
}

// Header component
const BalanceHeader = React.memo(
  ({
    isFetching,
    autoRefresh,
    showBalances,
    onToggleAutoRefresh,
    onToggleVisibility,
    onRefresh,
    lastUpdated,
  }: {
    isFetching: boolean;
    autoRefresh: boolean;
    showBalances: boolean;
    onToggleAutoRefresh: () => void;
    onToggleVisibility: () => void;
    onRefresh: () => void;
    lastUpdated?: string;
  }) => (
    <>
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
            onClick={onToggleAutoRefresh}
            className={`text-xs ${autoRefresh ? "text-green-400" : "text-slate-400"}`}
          >
            {autoRefresh ? "Auto" : "Manual"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleVisibility}
            className="text-slate-300 hover:text-white"
          >
            {showBalances ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isFetching}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
      {lastUpdated && (
        <CardDescription className="text-xs text-slate-400">
          Last updated: {new Date(lastUpdated).toLocaleTimeString()}
        </CardDescription>
      )}
    </>
  )
);
BalanceHeader.displayName = "BalanceHeader";

// Balance item component
const BalanceItemComponent = React.memo(
  ({
    balance,
    showBalances,
    formatTokenAmount,
    formatCurrency,
  }: {
    balance: BalanceItem;
    showBalances: boolean;
    formatTokenAmount: (amount: number, asset: string) => string;
    formatCurrency: (amount: number, decimals?: number) => string;
  }) => (
    <div className="flex items-center justify-between p-3 bg-slate-700/30 border border-slate-600/50 rounded-lg hover:bg-slate-700/50 transition-colors">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-yellow-400/20 rounded-full flex items-center justify-center">
          <span className="text-xs font-bold text-yellow-400">{balance.asset.slice(0, 2)}</span>
        </div>
        <div>
          <p className="font-medium text-sm text-white">{balance.asset}</p>
          {balance.locked !== "0" && (
            <p className="text-xs text-slate-400">
              {formatTokenAmount(Number.parseFloat(balance.locked), balance.asset)} locked
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
              <p className="text-xs text-slate-400">≈ ${formatCurrency(balance.usdtValue)} USDT</p>
            )}
          </>
        ) : (
          <p className="font-medium text-sm text-slate-400">••••••</p>
        )}
      </div>
    </div>
  )
);
BalanceItemComponent.displayName = "BalanceItemComponent";

// Portfolio summary component
const PortfolioSummary = React.memo(
  ({
    totalValue,
    assetCount,
    showBalances,
    topHoldings,
  }: {
    totalValue: number;
    assetCount: number;
    showBalances: boolean;
    topHoldings: BalanceItem[];
  }) => {
    const { formatCurrency, formatTokenAmount } = useCurrencyFormatting();

    return (
      <div className="p-4 bg-gradient-to-r from-slate-700/50 to-slate-600/50 rounded-lg border border-slate-600">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-slate-300">Total Portfolio Value</p>
            <p className="text-2xl font-bold text-white">
              {showBalances ? (
                <span className="flex items-center">
                  <TrendingUp className="h-5 w-5 text-green-400 mr-2" />$
                  {formatCurrency(totalValue)} USDT
                </span>
              ) : (
                <span className="text-slate-400">••••••</span>
              )}
            </p>
          </div>
          <Badge variant="secondary" className="text-xs bg-slate-600 text-slate-200">
            {assetCount} assets
          </Badge>
        </div>
        
        {/* Top Holdings Summary */}
        {showBalances && topHoldings.length > 0 && (
          <div className="border-t border-slate-600 pt-3">
            <p className="text-xs font-medium text-slate-400 mb-2">Major Holdings</p>
            <div className="flex flex-wrap gap-2">
              {topHoldings.slice(0, 4).map((holding) => (
                holding.total > 0 && (
                  <div key={holding.asset} className="text-xs bg-slate-600/50 px-2 py-1 rounded">
                    <span className="text-white font-medium">
                      {formatTokenAmount(holding.total, holding.asset)} {holding.asset}
                    </span>
                    {holding.usdtValue && holding.usdtValue > 0 && (
                      <span className="text-slate-400 ml-1">
                        (${formatCurrency(holding.usdtValue)})
                      </span>
                    )}
                  </div>
                )
              ))}
              {assetCount > 4 && (
                <div className="text-xs bg-slate-600/30 px-2 py-1 rounded text-slate-400">
                  +{assetCount - 4} more
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);
PortfolioSummary.displayName = "PortfolioSummary";

// Empty state component
const EmptyState = React.memo(() => (
  <div className="text-center py-6 text-slate-400">
    <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
    <p className="text-sm">No balances found</p>
    <p className="text-xs text-slate-500">Your account appears to be empty</p>
  </div>
));
EmptyState.displayName = "EmptyState";

// Loading skeleton
const LoadingSkeleton = React.memo(() => (
  <div className="space-y-3">
    {Array.from({ length: 3 }, (_, i) => `balance-loading-${i}`).map((key) => (
      <div key={key} className="animate-pulse">
        <div className="h-4 bg-slate-600/30 rounded w-3/4 mb-2" />
        <div className="h-3 bg-slate-600/30 rounded w-1/2" />
      </div>
    ))}
  </div>
));
LoadingSkeleton.displayName = "LoadingSkeleton";

// Main component
export const OptimizedAccountBalance = React.memo(
  ({ userId = "default-user", className }: AccountBalanceProps) => {
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

    const { formatCurrency, formatTokenAmount } = useCurrencyFormatting();

    const handleRefresh = useCallback(() => refetch(), [refetch]);
    const toggleVisibility = useCallback(() => setShowBalances((prev) => !prev), []);
    const toggleAutoRefresh = useCallback(() => setAutoRefresh((prev) => !prev), []);

    // Memoize sorted balances
    const sortedBalances = useMemo(() => {
      if (!balanceData?.balances) return [];
      return [...balanceData.balances]
        .sort((a, b) => (b.usdtValue || 0) - (a.usdtValue || 0))
        .slice(0, 10);
    }, [balanceData?.balances]);

    if (isError) {
      return (
        <Card className={`bg-slate-800/50 border-slate-700 backdrop-blur-sm ${className}`}>
          <CardHeader className="pb-3">
            <BalanceHeader
              isFetching={isFetching}
              autoRefresh={autoRefresh}
              showBalances={showBalances}
              onToggleAutoRefresh={toggleAutoRefresh}
              onToggleVisibility={toggleVisibility}
              onRefresh={handleRefresh}
            />
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
          <BalanceHeader
            isFetching={isFetching}
            autoRefresh={autoRefresh}
            showBalances={showBalances}
            onToggleAutoRefresh={toggleAutoRefresh}
            onToggleVisibility={toggleVisibility}
            onRefresh={handleRefresh}
            lastUpdated={balanceData?.lastUpdated}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <LoadingSkeleton />
          ) : balanceData ? (
            <>
              <PortfolioSummary
                totalValue={balanceData.totalUsdtValue}
                assetCount={balanceData.balances.length}
                showBalances={showBalances}
                topHoldings={sortedBalances}
              />

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
                  <EmptyState />
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {sortedBalances.map((balance) => (
                      <BalanceItemComponent
                        key={balance.asset}
                        balance={balance}
                        showBalances={showBalances}
                        formatTokenAmount={formatTokenAmount}
                        formatCurrency={formatCurrency}
                      />
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
);

OptimizedAccountBalance.displayName = "OptimizedAccountBalance";
