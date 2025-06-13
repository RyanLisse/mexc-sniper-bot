"use client";

import React from "react";
import { DashboardLayout } from "@/src/components/dashboard-layout";
import { AgentDashboard } from "@/src/components/agent-dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Bot, Calendar, Target, BarChart3, Settings } from "lucide-react";

export default function AgentsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div>
          <h1 className="text-3xl font-bold">AI Agent Management</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and control the multi-agent trading system in real-time
          </p>
        </div>

        {/* Overview Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Multi-Agent System Overview
            </CardTitle>
            <CardDescription>
              Our AI-powered trading system uses 5 specialized TypeScript agents working together to identify and execute profitable trades
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* MEXC API Agent */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                  <h3 className="font-semibold">MEXC API Agent</h3>
                  <Badge variant="outline" className="text-xs">Core</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Handles MEXC API interactions, data analysis, and trading signal extraction with AI-powered insights.
                </p>
              </div>

              {/* Pattern Discovery Agent */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-green-500" />
                  <h3 className="font-semibold">Pattern Discovery</h3>
                  <Badge variant="outline" className="text-xs">AI</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Detects ready-state patterns (sts:2, st:2, tt:4) and identifies opportunities 3.5+ hours in advance.
                </p>
              </div>

              {/* Calendar Agent */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-orange-500" />
                  <h3 className="font-semibold">Calendar Agent</h3>
                  <Badge variant="outline" className="text-xs">Monitor</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Monitors new listing announcements, analyzes launch timing, and assesses market potential.
                </p>
              </div>

              {/* Symbol Analysis Agent */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-purple-500" />
                  <h3 className="font-semibold">Symbol Analysis</h3>
                  <Badge variant="outline" className="text-xs">Real-time</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Performs real-time readiness assessment, market analysis, and risk evaluation with confidence scoring.
                </p>
              </div>

              {/* Orchestrator */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="h-4 w-4 text-red-500" />
                  <h3 className="font-semibold">Orchestrator</h3>
                  <Badge variant="outline" className="text-xs">Control</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Coordinates multi-agent workflows, synthesizes results, and handles error recovery.
                </p>
              </div>

              {/* Workflow System */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="h-4 w-4 text-indigo-500" />
                  <h3 className="font-semibold">Inngest Workflows</h3>
                  <Badge variant="outline" className="text-xs">Automation</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Event-driven workflows for calendar polling, symbol watching, pattern analysis, and strategy creation.
                </p>
              </div>
            </div>

            {/* System Status */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">How the System Works</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• <strong>Calendar Agent</strong> discovers new listings and schedules monitoring</p>
                <p>• <strong>Pattern Discovery</strong> analyzes market conditions for optimal entry points</p>
                <p>• <strong>Symbol Analysis</strong> provides real-time assessment of trading readiness</p>
                <p>• <strong>MEXC API Agent</strong> executes trades when conditions are met</p>
                <p>• <strong>Orchestrator</strong> ensures all agents work together seamlessly</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Agent Dashboard */}
        <AgentDashboard />
      </div>
    </DashboardLayout>
  );
}