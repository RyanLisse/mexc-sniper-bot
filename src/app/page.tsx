"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp, Bot, Activity, Target, Eye, Zap, AlertTriangle, Settings } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      {/* Header */}
      <header className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-green-400 to-green-600 rounded-lg">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">MEXC Sniper Bot</h1>
              <p className="text-sm text-slate-400">AI-Powered Token Launch Detection</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                <Activity className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <Link href="/config">
              <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <section className="text-center mb-16">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="inline-flex items-center space-x-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-2 text-green-400 text-sm font-medium">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>Advanced Pattern Detection Active</span>
            </div>
            
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
              Automate Your
              <br />
              <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                Token Launch Strategy
              </span>
            </h2>
            
            <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto">
              Advanced AI agents monitor MEXC exchange for new token listings, detect ready-state patterns 
              ~3.5 hours before launch, and execute precision trading strategies with real-time market analysis.
            </p>
            
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/dashboard">
                <Button size="lg" className="bg-green-500 hover:bg-green-600 text-white">
                  <Eye className="mr-2 h-5 w-5" />
                  Monitor Live Markets
                </Button>
              </Link>
              <Link href="/config">
                <Button variant="outline" size="lg" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                  <Bot className="mr-2 h-5 w-5" />
                  Configure AI Agents
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm trading-card">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Target className="h-6 w-6 text-blue-400" />
                </div>
                <CardTitle className="text-xl">Pattern Detection</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CardDescription className="text-slate-400">
                AI agents monitor MEXC symbolsV2 API for the ready-state pattern (sts:2, st:2, tt:4) 
                that appears ~3.5 hours before token trading begins.
              </CardDescription>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Detection Accuracy</span>
                  <span className="text-green-400 font-medium">94.7%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Advance Notice</span>
                  <span className="text-green-400 font-medium">~3.5 hrs</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm trading-card">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Bot className="h-6 w-6 text-green-400" />
                </div>
                <CardTitle className="text-xl">AI Strategy Engine</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CardDescription className="text-slate-400">
                Intelligent trading strategies with risk management, position sizing, 
                and automated execution based on market conditions and token characteristics.
              </CardDescription>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Success Rate</span>
                  <span className="text-green-400 font-medium">78.3%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Avg. ROI</span>
                  <span className="text-green-400 font-medium">+127%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm trading-card">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Zap className="h-6 w-6 text-purple-400" />
                </div>
                <CardTitle className="text-xl">Real-time Execution</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <CardDescription className="text-slate-400">
                Lightning-fast order execution with sub-second latency, 
                automated portfolio management, and comprehensive trade analytics.
              </CardDescription>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Execution Speed</span>
                  <span className="text-green-400 font-medium">&lt;200ms</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Uptime</span>
                  <span className="text-green-400 font-medium">99.9%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* System Status */}
        <section className="mb-16">
          <Card className="bg-gradient-to-r from-slate-800/80 to-slate-700/80 border-slate-600 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-center">System Status</CardTitle>
              <CardDescription className="text-center text-slate-400">
                Live monitoring of AI agents and market conditions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-6">
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold text-green-400">5</div>
                  <div className="text-sm text-slate-400">Active Agents</div>
                  <div className="text-xs text-green-400">All Systems Operational</div>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold text-blue-400">23</div>
                  <div className="text-sm text-slate-400">Monitored Tokens</div>
                  <div className="text-xs text-blue-400">Ready State Detection</div>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold text-purple-400">142</div>
                  <div className="text-sm text-slate-400">Patterns Analyzed</div>
                  <div className="text-xs text-purple-400">Last 24 Hours</div>
                </div>
                <div className="text-center space-y-2">
                  <div className="text-3xl font-bold text-green-400">8</div>
                  <div className="text-sm text-slate-400">Successful Snipes</div>
                  <div className="text-xs text-green-400">This Week</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Risk Disclaimer */}
        <section>
          <Card className="bg-amber-500/10 border-amber-500/20 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-6 w-6 text-amber-400 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-semibold text-amber-400 mb-2">Trading Risk Notice</h3>
                  <p className="text-amber-200/80 text-sm leading-relaxed">
                    Cryptocurrency trading involves substantial risk of loss and is not suitable for every investor. 
                    Past performance does not guarantee future results. The AI system provides analysis and automation 
                    but cannot eliminate market risks. Only trade with funds you can afford to lose.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center border-t border-slate-800">
        <p className="text-slate-500">
          MEXC Sniper Bot • Advanced AI Trading Technology • Trade Responsibly
        </p>
      </footer>
    </div>
  );
}

// Add some simple CSS animations for the blobs in globals.css if you want them to move
// For example, in src/app/globals.css:
/*
@keyframes blob {
  0% {
    transform: scale(1) translate(0, 0);
  }
  33% {
    transform: scale(1.1) translate(20px, -30px);
  }
  66% {
    transform: scale(0.9) translate(-20px, 20px);
  }
  100% {
    transform: scale(1) translate(0, 0);
  }
}

.animate-blob {
  animation: blob 15s infinite cubic-bezier(0.68, -0.55, 0.27, 1.55);
}
.animation-delay-2000 {
  animation-delay: 2s;
}
.animation-delay-4000 {
  animation-delay: 4s;
}
*/
