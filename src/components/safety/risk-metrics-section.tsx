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
  const getRiskBadgeVariant = (risk: string) => {
    const variantMap = {
      low: "default" as const,
      medium: "secondary" as const,
      high: "destructive" as const,
    };
    return variantMap[risk as keyof typeof variantMap] || ("outline" as const);
  };

  const getTrendIcon = (value: number) => {
    return value > 70 ? (
      <TrendingUp className="h-4 w-4 text-red-500" />
    ) : value > 30 ? (
      <Minus className="h-4 w-4 text-yellow-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-green-500" />
    );
  };

  const renderLoadingState = () => (
    <Card>
      <CardHeader>
        <CardTitle>Risk Assessment</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="animate-pulse">Loading risk metrics...</div>
      </CardContent>
    </Card>
  );

  const renderRiskRow = (label: string, value: number) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span>{label}:</span>
        <div className="flex items-center gap-2">
          {getTrendIcon(value)}
          <span className="font-medium">{value}%</span>
        </div>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );

  if (isLoading) {
    return renderLoadingState();
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
          {renderRiskRow("Position Risk", riskMetrics?.positionRisk || 0)}
          {renderRiskRow("Liquidity Risk", riskMetrics?.liquidityRisk || 0)}
          {renderRiskRow("Market Risk", riskMetrics?.marketRisk || 0)}
          {renderRiskRow("System Risk", riskMetrics?.systemRisk || 0)}

          {riskMetrics?.recommendations && riskMetrics.recommendations.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-sm font-medium mb-2">Recommendations:</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                {riskMetrics.recommendations.map((rec) => (
                  <li key={`rec-${rec.slice(0, 20)}`} className="flex items-start gap-1">
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
