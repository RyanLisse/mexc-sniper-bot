"use client";

import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowDownRight, ArrowUpRight, Minus, TrendingDown, TrendingUp } from "lucide-react";

interface Trade {
  id: number;
  symbolName: string;
  buyPrice: number;
  buyQuantity: number;
  buyTotalCost: number;
  sellPrice: number | null;
  sellQuantity: number | null;
  sellTotalRevenue: number | null;
  profitLoss: number | null;
  profitLossPercentage: number | null;
  status: "pending" | "completed" | "failed";
  buyTimestamp: string;
  sellTimestamp: string | null;
}

interface TradeRowsProps {
  trades: Trade[];
  getProfitLossIcon: (percentage: number | null) => React.ReactNode;
  getProfitLossColor: (percentage: number | null) => string;
  getStatusBadge: (status: string, profitLoss: number | null) => React.ReactNode;
}

function TradeRows({
  trades,
  getProfitLossIcon,
  getProfitLossColor,
  getStatusBadge,
}: TradeRowsProps) {
  return (
    <>
      {trades.map((trade) => (
        <TableRow key={trade.id}>
          <TableCell className="font-medium">{trade.symbolName}</TableCell>
          <TableCell>${trade.buyPrice.toFixed(4)}</TableCell>
          <TableCell>{trade.sellPrice ? `$${trade.sellPrice.toFixed(4)}` : "-"}</TableCell>
          <TableCell>{trade.buyQuantity.toFixed(2)}</TableCell>
          <TableCell>${trade.buyTotalCost.toFixed(2)}</TableCell>
          <TableCell>
            {trade.sellTotalRevenue ? `$${trade.sellTotalRevenue.toFixed(2)}` : "-"}
          </TableCell>
          <TableCell className={getProfitLossColor(trade.profitLoss)}>
            <div className="flex items-center gap-1">
              {getProfitLossIcon(trade.profitLoss)}
              {trade.profitLoss !== null ? `$${Math.abs(trade.profitLoss).toFixed(2)}` : "-"}
            </div>
          </TableCell>
          <TableCell className={getProfitLossColor(trade.profitLossPercentage)}>
            {trade.profitLossPercentage !== null
              ? `${trade.profitLossPercentage > 0 ? "+" : ""}${trade.profitLossPercentage.toFixed(2)}%`
              : "-"}
          </TableCell>
          <TableCell>{getStatusBadge(trade.status, trade.profitLoss)}</TableCell>
          <TableCell className="text-muted-foreground text-xs">
            {formatDistanceToNow(new Date(trade.sellTimestamp || trade.buyTimestamp), {
              addSuffix: true,
            })}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function RecentTradesTable() {
  const { data: trades, isLoading } = useQuery<Trade[]>({
    queryKey: ["recent-trades"],
    queryFn: async () => {
      const response = await fetch("/api/transactions?limit=10&type=complete_trade");
      if (!response.ok) throw new Error("Failed to fetch trades");
      const result = await response.json();
      return result.data || [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getProfitLossIcon = (percentage: number | null) => {
    if (percentage === null) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (percentage > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (percentage < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getProfitLossColor = (percentage: number | null) => {
    if (percentage === null) return "text-muted-foreground";
    if (percentage > 0) return "text-green-600 dark:text-green-400";
    if (percentage < 0) return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  const getStatusBadge = (status: string, profitLoss: number | null) => {
    if (status === "completed" && profitLoss !== null) {
      if (profitLoss > 0) {
        return (
          <Badge
            variant="default"
            className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
          >
            Profit
          </Badge>
        );
      }
      if (profitLoss < 0) {
        return (
          <Badge
            variant="destructive"
            className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
          >
            Loss
          </Badge>
        );
      }
      return <Badge variant="secondary">Break Even</Badge>;
    }

    if (status === "pending") {
      return (
        <Badge
          variant="outline"
          className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20"
        >
          In Progress
        </Badge>
      );
    }

    if (status === "failed") {
      return <Badge variant="destructive">Failed</Badge>;
    }

    return <Badge variant="secondary">{status}</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
          <CardDescription>Latest trading activity and performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={`skeleton-row-${i + 1}`} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalProfit = trades?.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0) || 0;
  const winRate = trades?.length
    ? ((trades.filter((t) => (t.profitLoss || 0) > 0).length / trades.length) * 100).toFixed(1)
    : "0.0";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Trades</CardTitle>
            <CardDescription>Latest trading activity and performance</CardDescription>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <p className="text-muted-foreground">Total P/L</p>
              <p
                className={`font-semibold ${totalProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
              >
                ${Math.abs(totalProfit).toFixed(2)}
                {totalProfit >= 0 ? (
                  <ArrowUpRight className="inline h-3 w-3 ml-1" />
                ) : (
                  <ArrowDownRight className="inline h-3 w-3 ml-1" />
                )}
              </p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Win Rate</p>
              <p className="font-semibold">{winRate}%</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Buy Price</TableHead>
                <TableHead>Sell Price</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>P/L</TableHead>
                <TableHead>P/L %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!trades || trades.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No trades found
                  </TableCell>
                </TableRow>
              ) : (
                <TradeRows
                  trades={trades}
                  getProfitLossIcon={getProfitLossIcon}
                  getProfitLossColor={getProfitLossColor}
                  getStatusBadge={getStatusBadge}
                />
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
