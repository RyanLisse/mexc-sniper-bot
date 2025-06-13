"use client";

import { useAuth } from "@/src/lib/kinde-auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Zap, Bot, Brain, BarChart3, Target, TrendingUp, Clock, Shield } from "lucide-react";

export default function HomePage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect authenticated users to dashboard
    if (isAuthenticated && user) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, user, router]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If authenticated, let the effect handle redirect
  if (isAuthenticated) {
    return null;
  }

  // Homepage for unauthenticated users
  return (
    <div className="min-h-screen bg-background">
      {/* Header Navigation */}
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">MEXC Sniper</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.push("/auth")}>
              Sign In
            </Button>
            <Button onClick={() => router.push("/auth")}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="mb-4">
            <Badge variant="secondary" className="mb-6">
              <Bot className="w-4 h-4 mr-2" />
              AI-Powered Trading System
            </Badge>
          </div>
          <h1 className="text-6xl font-bold mb-6">
            MEXC Sniper Bot
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Advanced AI-powered cryptocurrency trading platform for automated sniping of new MEXC listings. 
            Get early access to profitable trading opportunities with intelligent pattern detection.
          </p>
          <div className="flex gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => router.push("/auth")}
              className="px-8 py-3 text-lg"
            >
              <Zap className="w-5 h-5 mr-2" />
              Get Started
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => router.push("/auth")}
              className="px-8 py-3 text-lg"
            >
              Sign In
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Pattern Detection</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Advanced AI identifies ready-state patterns (sts:2, st:2, tt:4) with 3.5+ hour advance notice for optimal entry timing.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Multi-Agent System</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                5 specialized TypeScript agents work together: Calendar monitoring, Pattern discovery, Symbol analysis, Strategy creation, and Orchestration.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <CardTitle>Real-time Analytics</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Track profit/loss, win rates, and trading performance with comprehensive transaction history and automated reporting.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Statistics */}
        <Card className="mb-16">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Platform Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-6 text-center">
              <div className="space-y-2">
                <div className="text-3xl font-bold text-primary">99.5%</div>
                <div className="text-muted-foreground">Uptime</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-primary">3.5hrs</div>
                <div className="text-muted-foreground">Avg. Advance Notice</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-primary">5 Agents</div>
                <div className="text-muted-foreground">AI Trading System</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-primary">24/7</div>
                <div className="text-muted-foreground">Market Monitoring</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-8">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Monitor Listings</h3>
              <p className="text-muted-foreground">AI agents continuously scan MEXC calendar for new listing announcements and pattern detection.</p>
            </div>
            <div className="text-center">
              <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Brain className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Analyze Patterns</h3>
              <p className="text-muted-foreground">Advanced algorithms identify optimal entry signals and market readiness indicators.</p>
            </div>
            <div className="text-center">
              <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Execute Trades</h3>
              <p className="text-muted-foreground">Automated execution with configurable take-profit levels and risk management strategies.</p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <Card className="text-center border-primary/20">
          <CardContent className="p-12">
            <div className="mb-4">
              <div className="p-3 bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h2 className="text-3xl font-bold mb-4">Ready to Start Trading?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join the future of automated cryptocurrency trading with AI-powered precision.
            </p>
            <Button 
              size="lg"
              onClick={() => router.push("/auth")}
              className="px-12 py-4 text-lg"
            >
              <Zap className="w-5 h-5 mr-2" />
              Sign Up Now
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}