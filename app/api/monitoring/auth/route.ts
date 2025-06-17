/**
 * Authentication Monitoring Dashboard API
 * 
 * Provides comprehensive monitoring data for authentication system health,
 * performance metrics, and alerts. Used by internal monitoring dashboards
 * and external monitoring services.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';

interface MonitoringMetrics {
  timestamp: string;
  uptime: number;
  responseTime: number;
  errorRate: number;
  successRate: number;
  totalRequests: number;
}

interface AuthMonitoringData {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  lastChecked: string;
  uptime: {
    current: number;
    last24h: number;
    last7d: number;
  };
  performance: {
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    requestsPerMinute: number;
  };
  errors: {
    last24h: number;
    errorRate: number;
    commonErrors: Array<{
      error: string;
      count: number;
      lastOccurrence: string;
    }>;
  };
  security: {
    suspiciousActivities: number;
    failedLogins: number;
    blockedIPs: string[];
  };
  kinde: {
    sdkStatus: 'operational' | 'degraded' | 'down';
    apiHealth: 'healthy' | 'unhealthy';
    lastSync: string;
    configurationStatus: 'valid' | 'invalid' | 'partial';
  };
  alerts: Array<{
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: string;
    resolved: boolean;
  }>;
  environment: {
    name: string;
    version: string;
    deployment: {
      lastDeployment: string;
      deploymentId: string;
      gitCommit: string;
    };
  };
}

// In-memory storage for demonstration (in production, use Redis or database)
const monitoringData: MonitoringMetrics[] = [];
const alerts: AuthMonitoringData['alerts'] = [];

function generateMockMetrics(): AuthMonitoringData {
  const now = new Date();
  const isHealthy = Math.random() > 0.1; // 90% chance of being healthy
  
  return {
    status: isHealthy ? 'healthy' : 'warning',
    lastChecked: now.toISOString(),
    uptime: {
      current: 99.95,
      last24h: 99.8,
      last7d: 99.2
    },
    performance: {
      averageResponseTime: 150 + Math.random() * 100,
      p95ResponseTime: 300 + Math.random() * 200,
      p99ResponseTime: 500 + Math.random() * 300,
      requestsPerMinute: 100 + Math.random() * 50
    },
    errors: {
      last24h: Math.floor(Math.random() * 10),
      errorRate: Math.random() * 0.5,
      commonErrors: [
        {
          error: 'Token validation failed',
          count: Math.floor(Math.random() * 5),
          lastOccurrence: new Date(now.getTime() - Math.random() * 3600000).toISOString()
        },
        {
          error: 'Network timeout',
          count: Math.floor(Math.random() * 3),
          lastOccurrence: new Date(now.getTime() - Math.random() * 7200000).toISOString()
        }
      ]
    },
    security: {
      suspiciousActivities: Math.floor(Math.random() * 5),
      failedLogins: Math.floor(Math.random() * 20),
      blockedIPs: ['192.168.1.100', '10.0.0.50'].slice(0, Math.floor(Math.random() * 3))
    },
    kinde: {
      sdkStatus: isHealthy ? 'operational' : 'degraded',
      apiHealth: isHealthy ? 'healthy' : 'unhealthy',
      lastSync: new Date(now.getTime() - Math.random() * 600000).toISOString(),
      configurationStatus: 'valid'
    },
    alerts: alerts.filter(alert => !alert.resolved).slice(0, 10),
    environment: {
      name: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      deployment: {
        lastDeployment: new Date(now.getTime() - Math.random() * 86400000).toISOString(),
        deploymentId: `deploy-${Math.random().toString(36).substr(2, 9)}`,
        gitCommit: Math.random().toString(36).substr(2, 7)
      }
    }
  };
}

async function validateAuthenticationState() {
  try {
    const { getUser, isAuthenticated } = getKindeServerSession();
    
    const startTime = Date.now();
    const user = await getUser();
    const authenticated = await isAuthenticated();
    const responseTime = Date.now() - startTime;
    
    return {
      isValid: true,
      responseTime,
      hasUser: !!user,
      isAuthenticated: authenticated,
      error: null
    };
  } catch (error) {
    return {
      isValid: false,
      responseTime: 0,
      hasUser: false,
      isAuthenticated: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const includeMetrics = searchParams.get('metrics') === 'true';
    const timeRange = searchParams.get('timeRange') || '24h';
    
    // Validate authentication state
    const authValidation = await validateAuthenticationState();
    
    // Generate monitoring data
    const monitoringData = generateMockMetrics();
    
    // Add real authentication validation results
    if (!authValidation.isValid) {
      monitoringData.status = 'critical';
      monitoringData.kinde.sdkStatus = 'down';
      monitoringData.kinde.apiHealth = 'unhealthy';
      
      // Add critical alert
      alerts.unshift({
        id: `alert-${Date.now()}`,
        severity: 'critical',
        message: `Authentication validation failed: ${authValidation.error}`,
        timestamp: new Date().toISOString(),
        resolved: false
      });
    }
    
    // Include performance metrics if requested
    if (includeMetrics) {
      monitoringData.performance.averageResponseTime = authValidation.responseTime;
    }
    
    // Add environment-specific data
    monitoringData.environment.name = process.env.NODE_ENV || 'development';
    
    // Format response based on request
    if (format === 'prometheus') {
      // Prometheus metrics format
      const prometheusMetrics = `
# HELP auth_status Authentication system status (1=healthy, 0=unhealthy)
# TYPE auth_status gauge
auth_status{environment="${monitoringData.environment.name}"} ${monitoringData.status === 'healthy' ? 1 : 0}

# HELP auth_response_time_seconds Authentication response time in seconds
# TYPE auth_response_time_seconds gauge
auth_response_time_seconds{environment="${monitoringData.environment.name}"} ${monitoringData.performance.averageResponseTime / 1000}

# HELP auth_error_rate Authentication error rate
# TYPE auth_error_rate gauge
auth_error_rate{environment="${monitoringData.environment.name}"} ${monitoringData.errors.errorRate}

# HELP auth_uptime_percent Authentication system uptime percentage
# TYPE auth_uptime_percent gauge
auth_uptime_percent{environment="${monitoringData.environment.name}"} ${monitoringData.uptime.current}

# HELP auth_requests_per_minute Authentication requests per minute
# TYPE auth_requests_per_minute gauge
auth_requests_per_minute{environment="${monitoringData.environment.name}"} ${monitoringData.performance.requestsPerMinute}
      `.trim();
      
      return new NextResponse(prometheusMetrics, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }
    
    return NextResponse.json(monitoringData, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Monitoring-Version': '1.0.0',
        'X-Last-Updated': new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error('Monitoring endpoint error:', error);
    
    return NextResponse.json({
      status: 'critical',
      error: 'Monitoring system failure',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;
    
    if (type === 'alert') {
      // Create new alert
      const alert = {
        id: `alert-${Date.now()}`,
        severity: data.severity || 'medium',
        message: data.message,
        timestamp: new Date().toISOString(),
        resolved: false
      };
      
      alerts.unshift(alert);
      
      // Keep only last 100 alerts
      if (alerts.length > 100) {
        alerts.splice(100);
      }
      
      return NextResponse.json({ 
        success: true, 
        alertId: alert.id 
      });
    }
    
    if (type === 'resolve') {
      // Resolve alert
      const alertId = data.alertId;
      const alert = alerts.find(a => a.id === alertId);
      
      if (alert) {
        alert.resolved = true;
        return NextResponse.json({ 
          success: true, 
          message: 'Alert resolved' 
        });
      }
      
      return NextResponse.json({ 
        success: false, 
        message: 'Alert not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: false, 
      message: 'Invalid request type' 
    }, { status: 400 });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to process monitoring request',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}