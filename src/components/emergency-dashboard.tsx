"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

interface EmergencyTest {
  emergencyType: string;
  severity: string;
  data: Record<string, unknown>;
}

const EMERGENCY_TYPES = [
  {
    type: "api_failure",
    label: "API Failure",
    description: "Test API connectivity recovery",
    data: { affectedAPIs: ["mexc", "openai"] },
  },
  {
    type: "high_volatility", 
    label: "High Volatility",
    description: "Test volatility response mechanisms",
    data: { affectedSymbols: ["BTCUSDT", "ETHUSDT"], volatilityIncrease: "150%" },
  },
  {
    type: "system_overload",
    label: "System Overload",
    description: "Test resource management recovery",
    data: { memoryUsage: "95%", cpuUsage: "90%" },
  },
  {
    type: "database_failure",
    label: "Database Failure", 
    description: "Test database recovery procedures",
    data: { connectionLost: true, lastSuccessfulQuery: Date.now() - 30000 },
  },
  {
    type: "trading_anomaly",
    label: "Trading Anomaly",
    description: "Test trading halt and investigation",
    data: { anomalyType: "unusual_price_movement", affectedSymbols: ["NEWCOIN"] },
  },
];

const SEVERITY_LEVELS = [
  { value: "low", label: "Low", color: "bg-blue-500" },
  { value: "medium", label: "Medium", color: "bg-yellow-500" },
  { value: "high", label: "High", color: "bg-orange-500" },
  { value: "critical", label: "Critical", color: "bg-red-500" },
];

export function EmergencyDashboard() {
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);

  // Check system health on component mount
  useEffect(() => {
    checkSystemHealth();
  }, []);

  const checkSystemHealth = async () => {
    try {
      // This would call the health check API
      setSystemHealth({
        overall: "healthy",
        services: {
          database: "healthy",
          mexcApi: "healthy", 
          openAi: "healthy",
          memory: "82MB",
        },
        lastChecked: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to check system health:", error);
    }
  };

  const triggerEmergency = async (test: EmergencyTest, severity: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/triggers/emergency", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emergencyType: test.emergencyType,
          severity,
          data: test.data,
        }),
      });

      const result = await response.json();
      setLastResponse(result);

      if (result.success) {
        // Refresh system health after emergency test
        setTimeout(checkSystemHealth, 2000);
      }
    } catch (error) {
      console.error("Failed to trigger emergency:", error);
      setLastResponse({
        success: false,
        error: "Failed to trigger emergency response",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🚨 Emergency Response Dashboard
            <Badge variant={systemHealth?.overall === "healthy" ? "default" : "destructive"}>
              {systemHealth?.overall || "Unknown"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* System Health Status */}
            {systemHealth && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                <div className="text-center">
                  <div className="text-sm text-slate-600">Database</div>
                  <Badge variant={systemHealth.services.database === "healthy" ? "default" : "destructive"}>
                    {systemHealth.services.database}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-sm text-slate-600">MEXC API</div>
                  <Badge variant={systemHealth.services.mexcApi === "healthy" ? "default" : "destructive"}>
                    {systemHealth.services.mexcApi}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-sm text-slate-600">OpenAI API</div>
                  <Badge variant={systemHealth.services.openAi === "healthy" ? "default" : "destructive"}>
                    {systemHealth.services.openAi}
                  </Badge>
                </div>
                <div className="text-center">
                  <div className="text-sm text-slate-600">Memory</div>
                  <Badge variant="outline">{systemHealth.services.memory}</Badge>
                </div>
              </div>
            )}

            {/* Emergency Test Controls */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Emergency Response Tests</h3>
              <div className="grid gap-4">
                {EMERGENCY_TYPES.map((test) => (
                  <Card key={test.type} className="border-l-4 border-l-orange-400">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{test.label}</h4>
                          <p className="text-sm text-slate-600 mt-1">{test.description}</p>
                          <div className="text-xs text-slate-500 mt-2 font-mono">
                            Data: {JSON.stringify(test.data)}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          {SEVERITY_LEVELS.map((severity) => (
                            <Button
                              key={severity.value}
                              variant="outline"
                              size="sm"
                              disabled={loading}
                              onClick={() => triggerEmergency(test, severity.value)}
                              className="min-w-[70px]"
                            >
                              <div className={`w-2 h-2 rounded-full ${severity.color} mr-2`} />
                              {severity.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Last Response */}
            {lastResponse && (
              <Card className={`${lastResponse.success ? "border-green-200" : "border-red-200"}`}>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Last Emergency Test Result
                    <Badge variant={lastResponse.success ? "default" : "destructive"} className="ml-2">
                      {lastResponse.success ? "Success" : "Failed"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-slate-50 p-3 rounded overflow-auto">
                    {JSON.stringify(lastResponse, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Refresh Button */}
            <div className="flex justify-center">
              <Button variant="outline" onClick={checkSystemHealth}>
                🔄 Refresh System Health
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}