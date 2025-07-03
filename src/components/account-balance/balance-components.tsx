"use client";

import { Eye, EyeOff, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import { memo } from "react";
import { useCurrencyFormatting } from "../../hooks/use-currency-formatting";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { CardDescription, CardTitle } from "../ui/card";

export interface BalanceItem {
  asset: string;
  free: string;
  locked: string;
  total: number;
  usdtValue?: number;
}

// Balance Header Component
export const BalanceHeader = memo(
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
          <Wallet className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg text-foreground">Account Balance</CardTitle>
          {isFetching && <RefreshCw className="h-4 w-4 animate-spin text-primary" />}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleAutoRefresh}
            className={`text-xs ${autoRefresh ? "text-primary" : "text-muted-foreground"}`}
          >
            {autoRefresh ? "Auto" : "Manual"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleVisibility}
            className="text-muted-foreground hover:text-foreground"
          >
            {showBalances ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isFetching}
            className="border-border text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
      {lastUpdated && (
        <CardDescription className="text-xs text-muted-foreground">
          Last updated: {new Date(lastUpdated).toLocaleTimeString()}
        </CardDescription>
      )}
    </>
  )
);
BalanceHeader.displayName = "BalanceHeader";

// Balance Item Component
export const BalanceItemComponent = memo(
  ({ balance, showBalances }: { balance: BalanceItem; showBalances: boolean }) => {
    const { formatTokenAmount, formatCurrency } = useCurrencyFormatting();

    return (
      <div className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-lg hover:bg-muted/50 transition-colors">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-primary">{balance.asset.slice(0, 2)}</span>
          </div>
          <div>
            <p className="font-medium text-sm text-foreground">{balance.asset}</p>
            {balance.locked !== "0" && (
              <p className="text-xs text-muted-foreground">
                {formatTokenAmount(Number.parseFloat(balance.locked), balance.asset)} locked
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          {showBalances ? (
            <>
              <p className="font-medium text-sm text-foreground">
                {formatTokenAmount(balance.total, balance.asset)} {balance.asset}
              </p>
              {balance.usdtValue && balance.usdtValue > 0 && (
                <p className="text-xs text-muted-foreground">
                  ≈ ${formatCurrency(balance.usdtValue)} USDT
                </p>
              )}
            </>
          ) : (
            <p className="font-medium text-sm text-muted-foreground">••••••</p>
          )}
        </div>
      </div>
    );
  }
);
BalanceItemComponent.displayName = "BalanceItemComponent";

// Portfolio Summary Component
export const PortfolioSummary = memo(
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
      <div className="p-4 bg-gradient-to-r from-muted/50 to-accent/20 rounded-lg border border-border">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Portfolio Value</p>
            <p className="text-2xl font-bold text-foreground">
              {showBalances ? (
                <span className="flex items-center">
                  <TrendingUp className="h-5 w-5 text-primary mr-2" />${formatCurrency(totalValue)}{" "}
                  USDT
                </span>
              ) : (
                <span className="text-muted-foreground">••••••</span>
              )}
            </p>
          </div>
          <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
            {assetCount} assets
          </Badge>
        </div>

        {showBalances && topHoldings.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Major Holdings</p>
            <div className="flex flex-wrap gap-2">
              {topHoldings.slice(0, 4).map((holding) =>
                holding.total > 0 ? (
                  <div key={holding.asset} className="text-xs bg-muted px-2 py-1 rounded">
                    <span className="text-foreground font-medium">
                      {formatTokenAmount(holding.total, holding.asset)} {holding.asset}
                    </span>
                    {holding.usdtValue && holding.usdtValue > 0 && (
                      <span className="text-muted-foreground ml-1">
                        (${formatCurrency(holding.usdtValue)})
                      </span>
                    )}
                  </div>
                ) : null
              )}
              {assetCount > 4 && (
                <div className="text-xs bg-muted/50 px-2 py-1 rounded text-muted-foreground">
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

// Empty State Component
export const EmptyState = memo(() => (
  <div className="text-center py-8 text-muted-foreground">
    <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
    <p className="text-sm">No balance data available</p>
  </div>
));
EmptyState.displayName = "EmptyState";

// Loading Skeleton Component
export const LoadingSkeleton = memo(() => (
  <div className="space-y-3">
    {Array.from({ length: 3 }, (_, i) => `balance-loading-${i}`).map((key) => (
      <div key={key} className="animate-pulse">
        <div className="h-4 bg-muted rounded w-3/4 mb-2" />
        <div className="h-3 bg-muted rounded w-1/2" />
      </div>
    ))}
  </div>
));
LoadingSkeleton.displayName = "LoadingSkeleton";
