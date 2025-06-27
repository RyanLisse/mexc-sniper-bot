"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useAccountBalance } from "../hooks/use-account-balance";
import {
  BalanceHeader,
  type BalanceItem,
  BalanceItemComponent,
  EmptyState,
  LoadingSkeleton,
  PortfolioSummary,
} from "./account-balance/balance-components";
import { HydrationBoundary } from "./hydration-boundary";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";

interface AccountBalanceProps {
  userId?: string;
  className?: string;
}

// Main component (internal)
const OptimizedAccountBalanceInternal = React.memo(({ userId, className }: AccountBalanceProps) => {
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

  // Memoize sorted balances
  const sortedBalances = useMemo(() => {
    if (!balanceData?.balances) return [];
    return [...balanceData.balances]
      .filter((balance): balance is BalanceItem =>
        Boolean(balance.asset && balance.free && balance.locked && balance.total !== undefined)
      )
      .sort((a, b) => (b.usdtValue || 0) - (a.usdtValue || 0))
      .slice(0, 10);
  }, [balanceData?.balances]);

  const handleRefresh = useCallback(() => refetch(), [refetch]);
  const toggleVisibility = useCallback(() => setShowBalances((prev) => !prev), []);
  const toggleAutoRefresh = useCallback(() => setAutoRefresh((prev) => !prev), []);

  const renderErrorState = useCallback(
    () => (
      <Card className={`bg-card border-border backdrop-blur-sm ${className}`}>
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
            <p className="text-destructive text-sm">Failed to load account balance</p>
            <p className="text-muted-foreground text-xs mt-1">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-4">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    ),
    [
      className,
      isFetching,
      autoRefresh,
      showBalances,
      toggleAutoRefresh,
      toggleVisibility,
      handleRefresh,
      error,
    ]
  );

  const renderPortfolioValue = useCallback(() => {
    if (!balanceData) return null;

    return (
      <PortfolioSummary
        totalValue={balanceData.totalUsdtValue || 0}
        assetCount={balanceData.balances.length}
        showBalances={showBalances}
        topHoldings={sortedBalances}
      />
    );
  }, [showBalances, balanceData, sortedBalances]);

  const renderAssetBreakdown = useCallback(() => {
    const balanceCount = balanceData?.balances.length || 0;
    const hasBalances = balanceCount > 0;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-foreground">Asset Breakdown</h4>
          {balanceCount > 5 && (
            <span className="text-xs text-muted-foreground">Showing top holdings</span>
          )}
        </div>

        {!hasBalances ? (
          <EmptyState />
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sortedBalances.map((balance) => (
              <BalanceItemComponent
                key={balance.asset}
                balance={balance}
                showBalances={showBalances}
              />
            ))}

            {balanceCount > 10 && (
              <div className="text-center py-2">
                <span className="text-xs text-muted-foreground">
                  +{balanceCount - 10} more assets
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }, [balanceData, showBalances, sortedBalances]);

  if (isError) {
    return renderErrorState();
  }

  return (
    <Card className={`bg-card border-border backdrop-blur-sm ${className}`}>
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
            {renderPortfolioValue()}
            {renderAssetBreakdown()}
          </>
        ) : (
          <EmptyState />
        )}
      </CardContent>
    </Card>
  );
});

OptimizedAccountBalanceInternal.displayName = "OptimizedAccountBalanceInternal";

// Loading fallback component
const BalanceLoadingFallback = () => (
  <Card className="bg-card border-border backdrop-blur-sm">
    <CardHeader className="pb-3">
      <BalanceHeader
        isFetching={false}
        autoRefresh={true}
        showBalances={true}
        onToggleAutoRefresh={() => {}}
        onToggleVisibility={() => {}}
        onRefresh={() => {}}
      />
    </CardHeader>
    <CardContent>
      <LoadingSkeleton />
    </CardContent>
  </Card>
);

// Exported component with hydration boundary
export const OptimizedAccountBalance = React.memo(({ userId, className }: AccountBalanceProps) => (
  <HydrationBoundary fallback={<BalanceLoadingFallback />}>
    <OptimizedAccountBalanceInternal userId={userId} className={className} />
  </HydrationBoundary>
));

OptimizedAccountBalance.displayName = "OptimizedAccountBalance";

// Add default export for dynamic imports
export default OptimizedAccountBalance;
