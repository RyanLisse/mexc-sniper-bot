"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, RefreshCw, Target, TrendingUp, Settings, Home } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

// Note: Metadata export needs to be in a separate server component for app router
// For now, we'll handle this as a client component

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface SnipeTarget {
  id: number;
  vcoin_id: string;
  mexc_symbol_contract: string;
  price_precision: number;
  quantity_precision: number;
  actual_launch_datetime_utc: string;
  discovered_at_utc: string;
  hours_advance_notice: number;
  intended_buy_amount_usdt: number;
  execution_status: string;
  executed_at_utc?: string;
  listing?: {
    symbol_name: string;
    project_name: string;
  };
}

interface ApiResponse {
  status: string;
  count: number;
  targets: SnipeTarget[];
  timestamp: string;
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "pending":
      return "bg-yellow-500";
    case "scheduled":
      return "bg-blue-500";
    case "executing":
      return "bg-purple-500";
    case "success":
      return "bg-green-500";
    case "failed":
      return "bg-red-500";
    case "cancelled":
      return "bg-gray-500";
    default:
      return "bg-gray-400";
  }
}

function getStatusIcon(status: string) {
  switch (status.toLowerCase()) {
    case "pending":
      return <Calendar className="w-4 h-4" />;
    case "scheduled":
      return <Target className="w-4 h-4" />;
    case "success":
      return <TrendingUp className="w-4 h-4" />;
    default:
      return <Target className="w-4 h-4" />;
  }
}

export default function Dashboard() {
  const [isPolling, setIsPolling] = useState(false);

  const {
    data: response,
    isLoading,
    mutate,
    error,
  } = useSWR<ApiResponse>(
    "/api/agents/mexc/snipe-targets", // FastAPI path proxied by Vercel
    fetcher,
    {
      refreshInterval: 10_000,
      revalidateOnFocus: true,
    }
  );

  const { data: statusData } = useSWR("/api/agents/mexc/status", fetcher, {
    refreshInterval: 30_000,
  });

  async function pollCalendar() {
    setIsPolling(true);
    try {
      const response = await fetch("/api/agents/mexc/inngest-trigger-calendar-poll", {
        method: "POST",
      });

      if (response.ok) {
        // Optimistic refresh after successful trigger
        setTimeout(() => mutate(), 2000);
      }
    } catch (error) {
      console.error("Failed to trigger calendar poll:", error);
    } finally {
      setIsPolling(false);
    }
  }

  const targets = response?.targets || [];
  const systemStatus = statusData?.system_status || "unknown";

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">MEXC Sniper Dashboard</h1>
          <p className="text-muted-foreground mt-1">Launch Targets & Pattern Discovery</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge
            variant={systemStatus === "running" ? "default" : "destructive"}
            className="px-3 py-1"
          >
            System: {systemStatus}
          </Badge>
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="outline" size="sm">
                <Home className="mr-2 h-4 w-4" />
                Home
              </Button>
            </Link>
            <Link href="/config">
              <Button variant="outline" size="sm">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </Link>
            <Button onClick={pollCalendar} disabled={isPolling} className="flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${isPolling ? "animate-spin" : ""}`} />
              {isPolling ? "Polling..." : "Poll Calendar Now"}
            </Button>
          </div>
        </div>
      </header>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Targets</p>
                <p className="text-2xl font-bold">{targets.length}</p>
              </div>
              <Target className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">
                  {targets.filter((t) => t.execution_status === "pending").length}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Scheduled</p>
                <p className="text-2xl font-bold">
                  {targets.filter((t) => t.execution_status === "scheduled").length}
                </p>
              </div>
              <Target className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Successful</p>
                <p className="text-2xl font-bold">
                  {targets.filter((t) => t.execution_status === "success").length}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Targets List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Active Targets</h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Loading targets...</span>
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-4">
              <p className="text-red-500">Error loading targets: {error.message}</p>
            </CardContent>
          </Card>
        ) : targets.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No targets found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try polling the calendar to discover new listings
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {targets.map((target) => (
              <Card key={target.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">{target.mexc_symbol_contract}</h3>
                        <Badge
                          className={`${getStatusColor(target.execution_status)} text-white flex items-center gap-1`}
                        >
                          {getStatusIcon(target.execution_status)}
                          {target.execution_status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Launch Time</p>
                          <p className="font-medium">
                            {new Date(target.actual_launch_datetime_utc).toLocaleString()}
                          </p>
                        </div>

                        <div>
                          <p className="text-muted-foreground">Advance Notice</p>
                          <p className="font-medium">
                            {target.hours_advance_notice.toFixed(1)} hours
                          </p>
                        </div>

                        <div>
                          <p className="text-muted-foreground">Buy Amount</p>
                          <p className="font-medium">${target.intended_buy_amount_usdt} USDT</p>
                        </div>
                      </div>

                      <div className="text-sm text-muted-foreground">
                        <p>Discovered: {new Date(target.discovered_at_utc).toLocaleString()}</p>
                        {target.executed_at_utc && (
                          <p>Executed: {new Date(target.executed_at_utc).toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
