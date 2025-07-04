/**
 * Production Monitoring Types
 *
 * Type definitions for production monitoring dashboard components.
 * Extracted from the main dashboard component for better modularity.
 */

export interface ProductionMetrics {
  deployment: {
    status: "healthy" | "degraded" | "critical";
    version: string;
    buildId: string;
    deployedAt: string;
    region: string;
    uptime: number;
  };
  system: {
    health: "healthy" | "degraded" | "critical";
    score: number;
    cpu: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    responseTime: number;
  };
  services: {
    database: ServiceStatus;
    authentication: ServiceStatus;
    trading: ServiceStatus;
    monitoring: ServiceStatus;
    websockets: ServiceStatus;
  };
  alerts: {
    critical: number;
    warnings: number;
    notices: number;
    recent: Alert[];
  };
  performance: {
    last24h: {
      averageResponseTime: number;
      errorRate: number;
      uptime: number;
      throughput: number;
    };
    current: {
      requestsPerMinute: number;
      errorsPerMinute: number;
      activeConnections: number;
    };
  };
}

export interface ServiceStatus {
  status: "operational" | "degraded" | "outage";
  responseTime: number;
  lastCheck: string;
  errorRate: number;
  availability: number;
}

export interface Alert {
  id: string;
  level: "critical" | "warning" | "notice";
  message: string;
  timestamp: string;
  service?: string;
  resolved: boolean;
}

export interface MonitoringDashboardProps {
  autoRefreshInterval?: number;
  className?: string;
}
