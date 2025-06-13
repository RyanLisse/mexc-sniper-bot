import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";

interface RiskMetrics {
  positionRisk: number;
  liquidityRisk: number;
  marketRisk: number;
  systemRisk: number;
  overallRisk: string;
  recommendations: string[];
}

interface RiskMetricsSectionProps {
  riskMetrics: RiskMetrics | undefined;
  isLoading: boolean;
}

export function RiskMetricsSection({ riskMetrics, isLoading }: RiskMetricsSectionProps) {
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low":
        return "text-green-500";
      case "medium":
        return "text-yellow-500";
      case "high":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case "low":
        return "default" as const;
      case "medium":
        return "secondary" as const;
      case "high":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  const getTrendIcon = (value: number) => {
    if (value > 70) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (value > 30) return <Minus className="h-4 w-4 text-yellow-500" />;
    return <TrendingDown className="h-4 w-4 text-green-500" />;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Risk Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">Loading risk metrics...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Risk Assessment
          <Badge variant={getRiskBadgeVariant(riskMetrics?.overallRisk || "unknown")}>
            {riskMetrics?.overallRisk?.toUpperCase() || "UNKNOWN"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Position Risk:</span>
              <div className="flex items-center gap-2">
                {getTrendIcon(riskMetrics?.positionRisk || 0)}
                <span className="font-medium">{riskMetrics?.positionRisk || 0}%</span>
              </div>
            </div>
            <Progress value={riskMetrics?.positionRisk || 0} className="h-2" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Liquidity Risk:</span>
              <div className="flex items-center gap-2">
                {getTrendIcon(riskMetrics?.liquidityRisk || 0)}
                <span className="font-medium">{riskMetrics?.liquidityRisk || 0}%</span>
              </div>
            </div>
            <Progress value={riskMetrics?.liquidityRisk || 0} className="h-2" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Market Risk:</span>
              <div className="flex items-center gap-2">
                {getTrendIcon(riskMetrics?.marketRisk || 0)}
                <span className="font-medium">{riskMetrics?.marketRisk || 0}%</span>
              </div>
            </div>
            <Progress value={riskMetrics?.marketRisk || 0} className="h-2" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>System Risk:</span>
              <div className="flex items-center gap-2">
                {getTrendIcon(riskMetrics?.systemRisk || 0)}
                <span className="font-medium">{riskMetrics?.systemRisk || 0}%</span>
              </div>
            </div>
            <Progress value={riskMetrics?.systemRisk || 0} className="h-2" />
          </div>

          {riskMetrics?.recommendations && riskMetrics.recommendations.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-sm font-medium mb-2">Recommendations:</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                {riskMetrics.recommendations.map((rec, index) => (
                  <li key={`rec-${index}`} className="flex items-start gap-1">
                    <span>•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
