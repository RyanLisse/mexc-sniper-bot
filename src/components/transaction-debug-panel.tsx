"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  RefreshCw,
  Search,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface TransactionDebugPanelProps {
  userId: string;
  className?: string;
}

interface ExecutionRecord {
  id: number;
  symbolName: string;
  action: "buy" | "sell";
  executedQuantity: number;
  executedPrice: number | null;
  totalCost: number | null;
  fees: number | null;
  status: "success" | "failed";
  executedAt: string;
  exchangeOrderId: string | null;
  exchangeResponse: string;
}

interface TransactionRecord {
  id: number;
  symbolName: string;
  transactionType: "buy" | "sell" | "complete_trade";
  buyPrice: number | null;
  sellPrice: number | null;
  buyQuantity: number | null;
  sellQuantity: number | null;
  profitLoss: number | null;
  status: "pending" | "completed" | "failed" | "cancelled";
  transactionTime: string;
}

// Debug Search Component
const DebugSearch = ({
  onSearch,
  isLoading,
}: {
  onSearch: (query: {
    symbol?: string;
    orderId?: string;
    timeRange?: string;
  }) => void;
  isLoading: boolean;
}) => {
  const [symbol, setSymbol] = useState("");
  const [orderId, setOrderId] = useState("");
  const [timeRange, setTimeRange] = useState("24h");

  const handleSearch = () => {
    onSearch({
      symbol: symbol || undefined,
      orderId: orderId || undefined,
      timeRange,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Transaction Search & Debug
        </CardTitle>
        <CardDescription>
          Search for missing transactions and debug trading history
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="symbol">Symbol</Label>
            <Input
              id="symbol"
              placeholder="e.g., BTCUSDT"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="orderId">Order ID</Label>
            <Input
              id="orderId"
              placeholder="Exchange order ID"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="timeRange">Time Range</Label>
            <select
              id="timeRange"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background"
            >
              <option value="1h">Last 1 hour</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>
        </div>
        <Button onClick={handleSearch} disabled={isLoading} className="w-full">
          {isLoading ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          Search Transactions
        </Button>
      </CardContent>
    </Card>
  );
};

// Execution History Display
const ExecutionHistoryDisplay = ({
  executions,
  isLoading,
}: {
  executions: ExecutionRecord[];
  isLoading: boolean;
}) => {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-16 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {executions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No execution records found</p>
        </div>
      ) : (
        executions.map((execution) => (
          <div key={execution.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    execution.status === "success" ? "default" : "destructive"
                  }
                >
                  {execution.status === "success" ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 mr-1" />
                  )}
                  {execution.status}
                </Badge>
                <span className="font-medium">{execution.symbolName}</span>
                <Badge variant="outline">
                  {execution.action.toUpperCase()}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(execution.executedAt).toLocaleString()}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Quantity</p>
                <p className="font-medium">
                  {execution.executedQuantity.toFixed(4)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Price</p>
                <p className="font-medium">
                  ${execution.executedPrice?.toFixed(4) || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Cost</p>
                <p className="font-medium">
                  ${execution.totalCost?.toFixed(2) || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Exchange Order ID</p>
                <p className="font-mono text-xs">
                  {execution.exchangeOrderId || "N/A"}
                </p>
              </div>
            </div>
            {execution.exchangeResponse && (
              <details className="mt-2">
                <summary className="text-xs text-muted-foreground cursor-pointer">
                  Exchange Response
                </summary>
                <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                  {JSON.stringify(
                    JSON.parse(execution.exchangeResponse),
                    null,
                    2
                  )}
                </pre>
              </details>
            )}
          </div>
        ))
      )}
    </div>
  );
};

// Transaction Records Display
const TransactionRecordsDisplay = ({
  transactions,
  isLoading,
}: {
  transactions: TransactionRecord[];
  isLoading: boolean;
}) => {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-16 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No transaction records found</p>
        </div>
      ) : (
        transactions.map((transaction) => (
          <div key={transaction.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    transaction.status === "completed" ? "default" : "secondary"
                  }
                >
                  {transaction.status === "completed" ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : transaction.status === "pending" ? (
                    <Clock className="h-3 w-3 mr-1" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 mr-1" />
                  )}
                  {transaction.status}
                </Badge>
                <span className="font-medium">{transaction.symbolName}</span>
                <Badge variant="outline">
                  {transaction.transactionType.toUpperCase()}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(transaction.transactionTime).toLocaleString()}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Buy Price</p>
                <p className="font-medium">
                  ${transaction.buyPrice?.toFixed(4) || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Sell Price</p>
                <p className="font-medium">
                  ${transaction.sellPrice?.toFixed(4) || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Quantity</p>
                <p className="font-medium">
                  {transaction.buyQuantity?.toFixed(4) ||
                    transaction.sellQuantity?.toFixed(4) ||
                    "N/A"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">P/L</p>
                <p
                  className={`font-medium ${
                    transaction.profitLoss
                      ? transaction.profitLoss > 0
                        ? "text-green-600"
                        : "text-red-600"
                      : ""
                  }`}
                >
                  {transaction.profitLoss
                    ? `$${transaction.profitLoss.toFixed(2)}`
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

// Main Component
export function TransactionDebugPanel({
  userId,
  className,
}: TransactionDebugPanelProps) {
  const [searchParams, setSearchParams] = useState<{
    symbol?: string;
    orderId?: string;
    timeRange?: string;
  }>({});

  // Execution History Query
  const {
    data: executionData,
    isLoading: executionLoading,
    refetch: refetchExecution,
  } = useQuery({
    queryKey: ["debug-execution-history", userId, searchParams],
    queryFn: async () => {
      const params = new URLSearchParams({
        userId,
        limit: "50",
        ...(searchParams.symbol && { symbol: searchParams.symbol }),
        ...(searchParams.timeRange && {
          fromDate: (
            Date.now() - getTimeRangeMs(searchParams.timeRange)
          ).toString(),
        }),
      });

      const response = await fetch(`/api/execution-history?${params}`);
      if (!response.ok) throw new Error("Failed to fetch execution history");
      return response.json();
    },
    enabled: !!userId,
  });

  // Transactions Query
  const {
    data: transactionData,
    isLoading: transactionLoading,
    refetch: refetchTransactions,
  } = useQuery({
    queryKey: ["debug-transactions", userId, searchParams],
    queryFn: async () => {
      const params = new URLSearchParams({
        userId,
        limit: "50",
        ...(searchParams.symbol && { symbolName: searchParams.symbol }),
        ...(searchParams.timeRange && {
          fromDate: new Date(
            Date.now() - getTimeRangeMs(searchParams.timeRange)
          ).toISOString(),
        }),
      });

      const response = await fetch(`/api/transactions?${params}`);
      if (!response.ok) throw new Error("Failed to fetch transactions");
      return response.json();
    },
    enabled: !!userId,
  });

  const handleSearch = (params: {
    symbol?: string;
    orderId?: string;
    timeRange?: string;
  }) => {
    setSearchParams(params);
    refetchExecution();
    refetchTransactions();
  };

  const executions = executionData?.data?.executions || [];
  const transactions = transactionData?.data?.transactions || [];

  return (
    <div className={`space-y-6 ${className}`}>
      <DebugSearch
        onSearch={handleSearch}
        isLoading={executionLoading || transactionLoading}
      />

      <Tabs defaultValue="execution" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="execution">
            Execution History ({executions.length})
          </TabsTrigger>
          <TabsTrigger value="transactions">
            Transaction Records ({transactions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="execution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Execution History
              </CardTitle>
              <CardDescription>
                Raw execution records from the MEXC exchange
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExecutionHistoryDisplay
                executions={executions}
                isLoading={executionLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Transaction Records
              </CardTitle>
              <CardDescription>
                Processed transaction records with profit/loss calculations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TransactionRecordsDisplay
                transactions={transactions}
                isLoading={transactionLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Debug Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{executions.length}</p>
              <p className="text-xs text-muted-foreground">Executions Found</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{transactions.length}</p>
              <p className="text-xs text-muted-foreground">
                Transactions Found
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {
                  executions.filter(
                    (e: ExecutionRecord) => e.status === "success"
                  ).length
                }
              </p>
              <p className="text-xs text-muted-foreground">
                Successful Executions
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {
                  transactions.filter(
                    (t: TransactionRecord) => t.status === "completed"
                  ).length
                }
              </p>
              <p className="text-xs text-muted-foreground">
                Completed Transactions
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function to convert time range to milliseconds
function getTimeRangeMs(timeRange: string): number {
  switch (timeRange) {
    case "1h":
      return 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}
