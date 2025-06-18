import { Card, CardContent, CardDescription, CardHeader } from "../ui/card";
import { cn } from "../../lib/utils";
import { ArrowDown, ArrowUp, TrendingDown, TrendingUp } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  description?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  description,
  trend = "neutral",
  className,
}: MetricCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription className="text-sm font-medium">{title}</CardDescription>
        {change !== undefined && (
          <div
            className={cn(
              "flex items-center text-xs font-medium",
              isPositive && "text-green-600",
              isNegative && "text-red-600",
              !isPositive && !isNegative && "text-muted-foreground"
            )}
          >
            {isPositive && <ArrowUp className="mr-1 h-3 w-3" />}
            {isNegative && <ArrowDown className="mr-1 h-3 w-3" />}
            {change > 0 && "+"}
            {change}%
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {changeLabel && (
          <div className="flex items-center pt-1">
            {trend === "up" && <TrendingUp className="mr-1 h-3 w-3 text-muted-foreground" />}
            {trend === "down" && <TrendingDown className="mr-1 h-3 w-3 text-muted-foreground" />}
            <p className="text-xs text-muted-foreground">{changeLabel}</p>
          </div>
        )}
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}
