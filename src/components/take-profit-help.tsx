"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Separator } from "@/src/components/ui/separator";
import { 
  HelpCircle, 
  TrendingUp, 
  Target, 
  DollarSign, 
  AlertTriangle, 
  Clock, 
  BarChart3,
  Calculator
} from "lucide-react";

export function TakeProfitHelp() {
  return (
    <Card className="bg-blue-50/50 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-blue-600" />
          How Take Profit Works
        </CardTitle>
        <CardDescription>
          Complete guide to understanding and configuring your profit-taking strategy
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Basic Concept */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-600" />
            Basic Concept
          </h3>
          <p className="text-sm text-muted-foreground">
            Take profit is an automated selling mechanism that locks in your gains when a token 
            reaches your target price. Instead of manually watching prices 24/7, the bot sells 
            your position automatically when your profit target is hit.
          </p>
        </div>

        <Separator />

        {/* How It Works */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-green-600" />
            How It Works
          </h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="font-medium text-green-600">1.</span>
              <span>You buy a token at $1.00 and set 20% take profit</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium text-green-600">2.</span>
              <span>Bot monitors price continuously in real-time</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium text-green-600">3.</span>
              <span>When price reaches $1.20 (+20%), bot automatically sells</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-medium text-green-600">4.</span>
              <span>You lock in $200 profit on a $1000 investment</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Risk Levels */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-orange-600" />
            Risk Levels Explained
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-green-600" />
                <div>
                  <div className="font-medium">Conservative (Level 1)</div>
                  <div className="text-xs text-muted-foreground">5-10% targets</div>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800">Low Risk</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <div>
                  <div className="font-medium">Moderate (Level 2)</div>
                  <div className="text-xs text-muted-foreground">10-20% targets</div>
                </div>
              </div>
              <Badge className="bg-blue-100 text-blue-800">Medium Risk</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-orange-600" />
                <div>
                  <div className="font-medium">Aggressive (Level 3)</div>
                  <div className="text-xs text-muted-foreground">20-50% targets</div>
                </div>
              </div>
              <Badge className="bg-orange-100 text-orange-800">High Risk</Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <div>
                  <div className="font-medium">Very Aggressive (Level 4)</div>
                  <div className="text-xs text-muted-foreground">50%+ targets</div>
                </div>
              </div>
              <Badge className="bg-red-100 text-red-800">Very High Risk</Badge>
            </div>
          </div>
        </div>

        <Separator />

        {/* Calculation Examples */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Calculator className="h-4 w-4 text-purple-600" />
            Profit Calculations
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="p-3 bg-gray-50 rounded-lg border">
              <div className="font-medium text-sm mb-2">Example: 15% Take Profit</div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div>Investment: $1,000</div>
                <div>Buy Price: $1.00</div>
                <div>Target Price: $1.15 (+15%)</div>
                <div className="font-medium text-green-600">Profit: $150</div>
              </div>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-lg border">
              <div className="font-medium text-sm mb-2">Example: 30% Take Profit</div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div>Investment: $1,000</div>
                <div>Buy Price: $1.00</div>
                <div>Target Price: $1.30 (+30%)</div>
                <div className="font-medium text-green-600">Profit: $300</div>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Best Practices */}
        <div className="space-y-3">
          <h3 className="font-semibold text-blue-600">💡 Best Practices</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Start with conservative levels (5-10%) until you understand market behavior</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Use Level 2 (Moderate) as your default for balanced risk/reward</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Set custom levels for specific tokens based on their volatility</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span>Consider market conditions - use lower targets in volatile markets</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-600">✗</span>
              <span>Don't set targets too high - greed can lead to missed opportunities</span>
            </li>
          </ul>
        </div>

        {/* Advanced Features */}
        <div className="space-y-3">
          <h3 className="font-semibold text-purple-600">🚀 Advanced Features</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong>Exit Strategies:</strong> Use the Exit Strategy selector for partial selling at multiple price levels.
              This allows you to take profits gradually instead of selling everything at once.
            </p>
            <p>
              <strong>Custom Levels:</strong> Set unique percentages for specific opportunities that don't fit preset levels.
            </p>
            <p>
              <strong>Auto-Sell Controls:</strong> Enable/disable automatic selling while keeping profit monitoring active.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}