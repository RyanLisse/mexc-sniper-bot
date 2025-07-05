/**
 * Services Tab Component
 *
 * Services monitoring tab content for the production monitoring dashboard.
 * Extracted from the main dashboard component for better modularity.
 */

import { Activity, Database, Shield, TrendingUp, Zap } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import type { ProductionMetrics } from "../types/monitoring-types";
import { getStatusColor } from "../utils/monitoring-utils";

interface ServicesTabProps {
  metrics: ProductionMetrics;
}

const getServiceIcon = (serviceName: string) => {
  switch (serviceName) {
    case "database":
      return Database;
    case "authentication":
      return Shield;
    case "trading":
      return TrendingUp;
    case "monitoring":
      return Activity;
    case "websockets":
      return Zap;
    default:
      return Activity;
  }
};

export function ServicesTab({ metrics }: ServicesTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(metrics.services).map(([serviceName, service]) => {
          const ServiceIcon = getServiceIcon(serviceName);

          return (
            <Card key={serviceName}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ServiceIcon className="h-4 w-4" />
                    <span className="capitalize">{serviceName}</span>
                  </div>
                  <Badge className={getStatusColor(service.status)}>
                    {service.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Response Time:</span>
                    <span>{service.responseTime}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Availability:</span>
                    <span>{service.availability}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Error Rate:</span>
                    <span>{service.errorRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Check:</span>
                    <span>
                      {new Date(service.lastCheck).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
