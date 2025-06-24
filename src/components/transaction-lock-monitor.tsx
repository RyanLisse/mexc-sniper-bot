"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, CheckCircle, Clock, Lock, Unlock, XCircle } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

interface TransactionLock {
  lockId: string;
  resourceId: string;
  ownerId: string;
  ownerType: string;
  status: string;
  transactionType: string;
  transactionData: Record<string, unknown>;
  acquiredAt: string;
  expiresAt: string;
  releasedAt?: string;
  errorMessage?: string;
  result?: string;
}

interface QueueItem {
  queueId: string;
  resourceId: string;
  priority: number;
  status: string;
  transactionType: string;
  transactionData: Record<string, unknown>;
  queuedAt: string;
  ownerId: string;
}

interface LockStats {
  activeLocks: number;
  expiredLocks: number;
  queueLength: number;
  recentlyCompleted: number;
  recentlyFailed: number;
}

export function TransactionLockMonitor() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["transaction-locks"],
    queryFn: async () => {
      const response = await fetch("/api/transaction-locks");
      if (!response.ok) throw new Error("Failed to fetch lock data");
      const result = await response.json();
      return result.data as {
        locks: TransactionLock[];
        queue: QueueItem[];
        stats: LockStats;
      };
    },
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  const releaseLock = async (lockId: string) => {
    try {
      const response = await fetch(`/api/transaction-locks?lockId=${lockId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        refetch();
      }
    } catch (error) {
      console.error("Failed to release lock:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-blue-500">
            <Lock className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case "released":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Released
          </Badge>
        );
      case "expired":
        return (
          <Badge className="bg-yellow-500">
            <Clock className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getResourceDisplay = (resourceId: string) => {
    const parts = resourceId.split(":");
    if (parts.length >= 3 && parts[0] === "trade") {
      return {
        type: "Trade",
        symbol: parts[1],
        side: parts[2],
        extra: parts[3],
      };
    }
    return { type: "Unknown", symbol: resourceId };
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </CardContent>
      </Card>
    );
  }

  const { locks = [], queue = [], stats = {} as LockStats } = data || {};

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-sm">Active Locks</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.activeLocks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-sm">Queue Length</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.queueLength}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-sm">Expired</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-yellow-600">{stats.expiredLocks}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-sm">Completed</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-green-600">{stats.recentlyCompleted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-sm">Failed</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-red-600">{stats.recentlyFailed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Active Locks */}
      <Card>
        <CardHeader>
          <CardTitle>Active Transaction Locks</CardTitle>
          <CardDescription>
            Currently locked resources preventing duplicate transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {locks.filter((lock) => lock.status === "active").length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No active locks</p>
          ) : (
            <div className="space-y-2">
              {locks
                .filter((lock) => lock.status === "active")
                .map((lock) => {
                  const resource = getResourceDisplay(lock.resourceId);
                  const isExpired = new Date(lock.expiresAt) < new Date();

                  return (
                    <div
                      key={lock.lockId}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        {getStatusBadge(isExpired ? "expired" : lock.status)}
                        <div>
                          <div className="font-medium">
                            {resource.type}: {resource.symbol} {resource.side}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Owner: {lock.ownerId} • Acquired:{" "}
                            {formatDistanceToNow(new Date(lock.acquiredAt), { addSuffix: true })}
                          </div>
                          {isExpired && (
                            <div className="text-sm text-yellow-600 flex items-center mt-1">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Expired{" "}
                              {formatDistanceToNow(new Date(lock.expiresAt), { addSuffix: true })}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => releaseLock(lock.lockId)}>
                        <Unlock className="h-4 w-4 mr-1" />
                        Release
                      </Button>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Queue */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Queue</CardTitle>
          <CardDescription>Pending transactions waiting for lock acquisition</CardDescription>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Queue is empty</p>
          ) : (
            <div className="space-y-2">
              {queue.map((item, index) => {
                const resource = getResourceDisplay(item.resourceId);

                return (
                  <div
                    key={item.queueId}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <div>
                        <div className="font-medium">
                          {resource.type}: {resource.symbol} {resource.side}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Owner: {item.ownerId} • Priority: {item.priority} • Queued:{" "}
                          {formatDistanceToNow(new Date(item.queuedAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline">
                      <Clock className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Lock History</CardTitle>
          <CardDescription>Recently completed or failed transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {locks.filter((lock) => lock.status !== "active").length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No recent history</p>
          ) : (
            <div className="space-y-2">
              {locks
                .filter((lock) => lock.status !== "active")
                .slice(0, 10)
                .map((lock) => {
                  const resource = getResourceDisplay(lock.resourceId);

                  return (
                    <div
                      key={lock.lockId}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        {getStatusBadge(lock.status)}
                        <div>
                          <div className="font-medium">
                            {resource.type}: {resource.symbol} {resource.side}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Owner: {lock.ownerId} •
                            {lock.releasedAt
                              ? ` Released: ${formatDistanceToNow(new Date(lock.releasedAt), { addSuffix: true })}`
                              : ` Acquired: ${formatDistanceToNow(new Date(lock.acquiredAt), { addSuffix: true })}`}
                          </div>
                          {lock.errorMessage && (
                            <div className="text-sm text-red-600 mt-1">
                              Error: {lock.errorMessage}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
