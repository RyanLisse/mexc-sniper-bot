"use client";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw,
  Database,
  Key,
  Brain,
  Shield,
  GitBranch,
  Zap,
  Server,
  Lock,
  Eye,
  EyeOff,
  TestTube,
  Play,
  ChevronDown,
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/src/lib/kinde-auth-client";
import { DashboardLayout } from "@/src/components/dashboard-layout";

// TypeScript interfaces for system status
interface SystemStatus {
  status: 'healthy' | 'unhealthy' | 'warning' | 'loading' | 'error';
  message?: string;
  details?: {
    summary?: {
      requiredConfigured?: number;
      requiredTotal?: number;
      optionalConfigured?: number;
      optionalTotal?: number;
      missingRequired?: string[];
    };
    [key: string]: unknown;
  };
  lastChecked?: string;
}

interface DatabaseHealth {
  healthy: boolean;
  connectionStatus: string;
  migrationsStatus: string;
  tableCount?: number;
  error?: string;
}

interface APICredentials {
  mexc?: {
    hasApiKey: boolean;
    hasSecretKey: boolean;
    isTestnet: boolean;
    isValid?: boolean;
  };
}

interface SystemCheckState {
  database: SystemStatus;
  mexcApi: SystemStatus;
  openaiApi: SystemStatus;
  kindeAuth: SystemStatus;
  inngestWorkflows: SystemStatus;
  environment: SystemStatus;
  credentials: APICredentials;
  isRefreshing: boolean;
  lastFullCheck: string | null;
}

export default function SystemCheckPage() {
  const [systemState, setSystemState] = useState<SystemCheckState>({
    database: { status: 'loading' },
    mexcApi: { status: 'loading' },
    openaiApi: { status: 'loading' },
    kindeAuth: { status: 'loading' },
    inngestWorkflows: { status: 'loading' },
    environment: { status: 'loading' },
    credentials: {},
    isRefreshing: false,
    lastFullCheck: null
  });
  
  const [showCredentials, setShowCredentials] = useState(false);
  const [expandedComponent, setExpandedComponent] = useState<string | null>(null);
  
  const { user, isLoading: authLoading } = useAuth();

  // Check database health
  const checkDatabaseHealth = async (): Promise<SystemStatus> => {
    try {
      const response = await fetch('/api/health/db');
      const data = await response.json();
      
      if (response.ok && data.status === 'healthy') {
        return {
          status: 'healthy',
          message: 'Database connected and operational',
          details: data,
          lastChecked: new Date().toISOString()
        };
      } else {
        return {
          status: 'unhealthy',
          message: data.error || 'Database connection issues',
          details: data,
          lastChecked: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: `Database check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date().toISOString()
      };
    }
  };

  // Check MEXC API connectivity
  const checkMexcApi = async (): Promise<SystemStatus> => {
    try {
      const response = await fetch('/api/mexc/connectivity');
      const data = await response.json();
      
      if (data.connected) {
        return {
          status: 'healthy',
          message: 'MEXC API is accessible',
          details: data,
          lastChecked: new Date().toISOString()
        };
      } else {
        return {
          status: 'unhealthy',
          message: data.error || 'MEXC API not accessible',
          details: data,
          lastChecked: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: `MEXC API check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date().toISOString()
      };
    }
  };

  // Check OpenAI API
  const checkOpenAiApi = async (): Promise<SystemStatus> => {
    try {
      const response = await fetch('/api/health/openai');
      const data = await response.json();
      
      if (response.ok && data.status === 'healthy') {
        return {
          status: 'healthy',
          message: data.message || 'OpenAI API is properly configured',
          details: data,
          lastChecked: new Date().toISOString()
        };
      } else {
        return {
          status: 'unhealthy',
          message: data.error || 'OpenAI API configuration issues',
          details: data,
          lastChecked: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: `OpenAI API check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date().toISOString()
      };
    }
  };

  // Check Kinde Auth
  const checkKindeAuth = async (): Promise<SystemStatus> => {
    try {
      const response = await fetch('/api/auth/session');
      
      if (response.ok) {
        return {
          status: 'healthy',
          message: 'Kinde Auth is working correctly',
          details: { authenticated: !!user },
          lastChecked: new Date().toISOString()
        };
      } else {
        return {
          status: 'warning',
          message: 'Kinde Auth may have configuration issues',
          lastChecked: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: `Kinde Auth check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date().toISOString()
      };
    }
  };

  // Check Inngest workflows
  const checkInngestWorkflows = async (): Promise<SystemStatus> => {
    try {
      const response = await fetch('/api/workflow-status');
      const data = await response.json();
      
      if (response.ok || data.fallbackData) {
        return {
          status: data.fallbackData ? 'warning' : 'healthy',
          message: data.fallbackData ? 'Workflows running in fallback mode' : 'Inngest workflows operational',
          details: data,
          lastChecked: new Date().toISOString()
        };
      } else {
        return {
          status: 'unhealthy',
          message: 'Inngest workflows not responding',
          lastChecked: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: `Workflow check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date().toISOString()
      };
    }
  };

  // Check environment variables
  const checkEnvironment = async (): Promise<SystemStatus> => {
    try {
      const response = await fetch('/api/health/environment');
      const data = await response.json();
      
      if (response.ok) {
        return {
          status: data.status as 'healthy' | 'unhealthy' | 'warning',
          message: data.message || 'Environment check completed',
          details: data,
          lastChecked: new Date().toISOString()
        };
      } else {
        return {
          status: 'unhealthy',
          message: data.error || 'Environment configuration issues',
          details: data,
          lastChecked: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: `Environment check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date().toISOString()
      };
    }
  };

  // Load API credentials
  const loadCredentials = async (): Promise<APICredentials> => {
    try {
      const userId = getUserId();
      const response = await fetch(`/api/api-credentials`);
      
      if (response.ok) {
        const credentials = await response.json();
        const mexcCreds = credentials.find((cred: any) => cred.provider === 'mexc');
        
        return {
          mexc: mexcCreds ? {
            hasApiKey: mexcCreds.has_api_key,
            hasSecretKey: mexcCreds.has_secret_key,
            isTestnet: mexcCreds.is_testnet,
            isValid: mexcCreds.has_api_key && mexcCreds.has_secret_key
          } : {
            hasApiKey: false,
            hasSecretKey: false,
            isTestnet: true,
            isValid: false
          }
        };
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
    }
    
    return {};
  };

  // Generate a simple user ID (in production, use proper authentication)
  const getUserId = () => {
    let userId = localStorage.getItem("mexc-user-id");
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("mexc-user-id", userId);
    }
    return userId;
  };

  // Run all system checks
  const runFullSystemCheck = async () => {
    setSystemState(prev => ({ ...prev, isRefreshing: true }));
    
    try {
      const [
        database,
        mexcApi,
        openaiApi,
        kindeAuth,
        inngestWorkflows,
        environment,
        credentials
      ] = await Promise.all([
        checkDatabaseHealth(),
        checkMexcApi(),
        checkOpenAiApi(),
        checkKindeAuth(),
        checkInngestWorkflows(),
        checkEnvironment(),
        loadCredentials()
      ]);

      setSystemState({
        database,
        mexcApi,
        openaiApi,
        kindeAuth,
        inngestWorkflows,
        environment,
        credentials,
        isRefreshing: false,
        lastFullCheck: new Date().toISOString()
      });
    } catch (error) {
      console.error('System check failed:', error);
      setSystemState(prev => ({ 
        ...prev, 
        isRefreshing: false,
        lastFullCheck: new Date().toISOString()
      }));
    }
  };

  // Initial system check on mount
  useEffect(() => {
    if (!authLoading) {
      runFullSystemCheck();
    }
  }, [authLoading]);

  // Get status icon and color
  const getStatusDisplay = (status: SystemStatus['status']) => {
    switch (status) {
      case 'healthy':
        return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' };
      case 'unhealthy':
        return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' };
      case 'warning':
        return { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
      case 'loading':
        return { icon: RefreshCw, color: 'text-blue-500', bg: 'bg-blue-500/10' };
      default:
        return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' };
    }
  };

  // Toggle component details
  const toggleComponentDetails = (componentName: string) => {
    setExpandedComponent(expandedComponent === componentName ? null : componentName);
  };

  // Test individual system component
  const testComponent = async (component: keyof Omit<SystemCheckState, 'credentials' | 'isRefreshing' | 'lastFullCheck'>) => {
    setSystemState(prev => ({ 
      ...prev, 
      [component]: { ...prev[component], status: 'loading' }
    }));

    let result: SystemStatus;
    
    switch (component) {
      case 'database':
        result = await checkDatabaseHealth();
        break;
      case 'mexcApi':
        result = await checkMexcApi();
        break;
      case 'openaiApi':
        result = await checkOpenAiApi();
        break;
      case 'kindeAuth':
        result = await checkKindeAuth();
        break;
      case 'inngestWorkflows':
        result = await checkInngestWorkflows();
        break;
      case 'environment':
        result = await checkEnvironment();
        break;
      default:
        result = { status: 'error', message: 'Unknown component' };
    }

    setSystemState(prev => ({ ...prev, [component]: result }));
  };

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Loading system check...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const overallHealth = [
    systemState.database.status,
    systemState.mexcApi.status,
    systemState.openaiApi.status,
    systemState.kindeAuth.status,
    systemState.inngestWorkflows.status,
    systemState.environment.status
  ];

  const healthyCount = overallHealth.filter(status => status === 'healthy').length;
  const warningCount = overallHealth.filter(status => status === 'warning').length;
  const unhealthyCount = overallHealth.filter(status => status === 'unhealthy' || status === 'error').length;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">System Check</h1>
            <p className="text-muted-foreground mt-1">
              Comprehensive system validation and health monitoring
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {systemState.lastFullCheck && (
              <Badge variant="outline" className="text-xs">
                Last check: {new Date(systemState.lastFullCheck).toLocaleTimeString()}
              </Badge>
            )}
            <Button 
              onClick={runFullSystemCheck}
              disabled={systemState.isRefreshing}
              variant="outline"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${systemState.isRefreshing ? 'animate-spin' : ''}`} />
              Run Full Check
            </Button>
          </div>
        </div>

        {/* System Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Zap className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-xl">System Overview</CardTitle>
                <CardDescription>Overall system health status</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{healthyCount}</div>
                <div className="text-sm text-muted-foreground">Healthy Components</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-500">{warningCount}</div>
                <div className="text-sm text-muted-foreground">Warnings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">{unhealthyCount}</div>
                <div className="text-sm text-muted-foreground">Issues</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Components */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Database Health */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${getStatusDisplay(systemState.database.status).bg}`}>
                    <Database className={`h-5 w-5 ${getStatusDisplay(systemState.database.status).color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Database Connection</CardTitle>
                    <CardDescription>TursoDB/SQLite connectivity and health</CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testComponent('database')}
                  disabled={systemState.database.status === 'loading'}
                >
                  <TestTube className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-3">
                {(() => {
                  const { icon: Icon, color } = getStatusDisplay(systemState.database.status);
                  return (
                    <>
                      <Icon className={`h-4 w-4 ${color} ${systemState.database.status === 'loading' ? 'animate-spin' : ''}`} />
                      <span className="font-medium">
                        {systemState.database.status === 'healthy' ? 'Connected' : 
                         systemState.database.status === 'loading' ? 'Checking...' : 'Issues Detected'}
                      </span>
                    </>
                  );
                })()}
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {systemState.database.message || 'Checking database connectivity...'}
              </p>
              {systemState.database.details && (
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleComponentDetails('database')}
                    className="p-0 h-auto text-xs text-muted-foreground hover:text-foreground"
                  >
                    {expandedComponent === 'database' ? (
                      <ChevronDown className="h-3 w-3 mr-1" />
                    ) : (
                      <ChevronRight className="h-3 w-3 mr-1" />
                    )}
                    {expandedComponent === 'database' ? 'Hide Details' : 'Show Details'}
                  </Button>
                  {expandedComponent === 'database' && (
                    <div className="text-xs text-muted-foreground space-y-1 pl-4 border-l-2 border-muted">
                      {Object.entries(systemState.database.details).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}:</span>
                          <span className="text-right ml-2">{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* MEXC API */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${getStatusDisplay(systemState.mexcApi.status).bg}`}>
                    <Server className={`h-5 w-5 ${getStatusDisplay(systemState.mexcApi.status).color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">MEXC API</CardTitle>
                    <CardDescription>Exchange API connectivity</CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testComponent('mexcApi')}
                  disabled={systemState.mexcApi.status === 'loading'}
                >
                  <TestTube className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-3">
                {(() => {
                  const { icon: Icon, color } = getStatusDisplay(systemState.mexcApi.status);
                  return (
                    <>
                      <Icon className={`h-4 w-4 ${color} ${systemState.mexcApi.status === 'loading' ? 'animate-spin' : ''}`} />
                      <span className="font-medium">
                        {systemState.mexcApi.status === 'healthy' ? 'Connected' : 
                         systemState.mexcApi.status === 'loading' ? 'Testing...' : 'Connection Failed'}
                      </span>
                    </>
                  );
                })()}
              </div>
              <p className="text-sm text-muted-foreground">
                {systemState.mexcApi.message || 'Testing MEXC API connectivity...'}
              </p>
              {systemState.credentials.mexc && (
                <div className="mt-3 text-xs text-muted-foreground">
                  <div>API Key: {systemState.credentials.mexc.hasApiKey ? '✓ Configured' : '✗ Missing'}</div>
                  <div>Secret Key: {systemState.credentials.mexc.hasSecretKey ? '✓ Configured' : '✗ Missing'}</div>
                  <div>Mode: {systemState.credentials.mexc.isTestnet ? 'Testnet' : 'Live'}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* OpenAI API */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${getStatusDisplay(systemState.openaiApi.status).bg}`}>
                    <Brain className={`h-5 w-5 ${getStatusDisplay(systemState.openaiApi.status).color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">OpenAI API</CardTitle>
                    <CardDescription>AI agent system integration</CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testComponent('openaiApi')}
                  disabled={systemState.openaiApi.status === 'loading'}
                >
                  <TestTube className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-3">
                {(() => {
                  const { icon: Icon, color } = getStatusDisplay(systemState.openaiApi.status);
                  return (
                    <>
                      <Icon className={`h-4 w-4 ${color} ${systemState.openaiApi.status === 'loading' ? 'animate-spin' : ''}`} />
                      <span className="font-medium">
                        {systemState.openaiApi.status === 'healthy' ? 'Configured' : 
                         systemState.openaiApi.status === 'loading' ? 'Checking...' : 'Not Configured'}
                      </span>
                    </>
                  );
                })()}
              </div>
              <p className="text-sm text-muted-foreground">
                {systemState.openaiApi.message || 'Checking OpenAI API configuration...'}
              </p>
            </CardContent>
          </Card>

          {/* Kinde Auth */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${getStatusDisplay(systemState.kindeAuth.status).bg}`}>
                    <Lock className={`h-5 w-5 ${getStatusDisplay(systemState.kindeAuth.status).color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Kinde Authentication</CardTitle>
                    <CardDescription>User authentication system</CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testComponent('kindeAuth')}
                  disabled={systemState.kindeAuth.status === 'loading'}
                >
                  <TestTube className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-3">
                {(() => {
                  const { icon: Icon, color } = getStatusDisplay(systemState.kindeAuth.status);
                  return (
                    <>
                      <Icon className={`h-4 w-4 ${color} ${systemState.kindeAuth.status === 'loading' ? 'animate-spin' : ''}`} />
                      <span className="font-medium">
                        {systemState.kindeAuth.status === 'healthy' ? 'Working' : 
                         systemState.kindeAuth.status === 'loading' ? 'Testing...' : 'Issues'}
                      </span>
                    </>
                  );
                })()}
              </div>
              <p className="text-sm text-muted-foreground">
                {systemState.kindeAuth.message || 'Testing authentication system...'}
              </p>
              {user && (
                <div className="mt-3 text-xs text-muted-foreground">
                  Current user: {user.name || user.email}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inngest Workflows */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${getStatusDisplay(systemState.inngestWorkflows.status).bg}`}>
                    <GitBranch className={`h-5 w-5 ${getStatusDisplay(systemState.inngestWorkflows.status).color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Inngest Workflows</CardTitle>
                    <CardDescription>Multi-agent workflow system</CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testComponent('inngestWorkflows')}
                  disabled={systemState.inngestWorkflows.status === 'loading'}
                >
                  <TestTube className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-3">
                {(() => {
                  const { icon: Icon, color } = getStatusDisplay(systemState.inngestWorkflows.status);
                  return (
                    <>
                      <Icon className={`h-4 w-4 ${color} ${systemState.inngestWorkflows.status === 'loading' ? 'animate-spin' : ''}`} />
                      <span className="font-medium">
                        {systemState.inngestWorkflows.status === 'healthy' ? 'Operational' : 
                         systemState.inngestWorkflows.status === 'warning' ? 'Fallback Mode' :
                         systemState.inngestWorkflows.status === 'loading' ? 'Checking...' : 'Not Responding'}
                      </span>
                    </>
                  );
                })()}
              </div>
              <p className="text-sm text-muted-foreground">
                {systemState.inngestWorkflows.message || 'Checking workflow system...'}
              </p>
            </CardContent>
          </Card>

          {/* Environment Variables */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${getStatusDisplay(systemState.environment.status).bg}`}>
                    <Shield className={`h-5 w-5 ${getStatusDisplay(systemState.environment.status).color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Environment Configuration</CardTitle>
                    <CardDescription>Required environment variables</CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testComponent('environment')}
                  disabled={systemState.environment.status === 'loading'}
                >
                  <TestTube className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-3">
                {(() => {
                  const { icon: Icon, color } = getStatusDisplay(systemState.environment.status);
                  return (
                    <>
                      <Icon className={`h-4 w-4 ${color} ${systemState.environment.status === 'loading' ? 'animate-spin' : ''}`} />
                      <span className="font-medium">
                        {systemState.environment.status === 'healthy' ? 'Configured' : 
                         systemState.environment.status === 'loading' ? 'Checking...' : 'Issues'}
                      </span>
                    </>
                  );
                })()}
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {systemState.environment.message || 'Checking environment configuration...'}
              </p>
              {systemState.environment.details?.summary && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>
                    Required: {systemState.environment.details.summary.requiredConfigured}/{systemState.environment.details.summary.requiredTotal}
                  </div>
                  <div>
                    Optional: {systemState.environment.details.summary.optionalConfigured}/{systemState.environment.details.summary.optionalTotal}
                  </div>
                  {systemState.environment.details?.summary?.missingRequired && systemState.environment.details.summary.missingRequired.length > 0 && (
                    <div className="text-red-400">
                      Missing: {systemState.environment.details.summary.missingRequired.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* API Credentials Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Key className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <CardTitle className="text-xl">API Credentials Management</CardTitle>
                  <CardDescription>Manage and test your trading and AI service credentials</CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => window.open('/settings', '_self')}
                className="text-sm"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Trading Settings
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Show Credential Details</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCredentials(!showCredentials)}
                >
                  {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">MEXC Exchange</h4>
                    <Badge 
                      variant={systemState.credentials.mexc?.isValid ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {systemState.credentials.mexc?.isValid ? "Valid" : "Invalid"}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>API Key:</span>
                      <span className={systemState.credentials.mexc?.hasApiKey ? 'text-green-500' : 'text-red-500'}>
                        {systemState.credentials.mexc?.hasApiKey ? '✓ Configured' : '✗ Missing'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Secret Key:</span>
                      <span className={systemState.credentials.mexc?.hasSecretKey ? 'text-green-500' : 'text-red-500'}>
                        {systemState.credentials.mexc?.hasSecretKey ? '✓ Configured' : '✗ Missing'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Trading Mode:</span>
                      <span className={systemState.credentials.mexc?.isTestnet ? 'text-yellow-500' : 'text-blue-500'}>
                        {systemState.credentials.mexc?.isTestnet ? 'Testnet' : 'Live Trading'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Connection:</span>
                      <span className={systemState.mexcApi.status === 'healthy' ? 'text-green-500' : 'text-red-500'}>
                        {systemState.mexcApi.status === 'healthy' ? '✓ Connected' : '✗ Disconnected'}
                      </span>
                    </div>
                  </div>
                  
                  {!systemState.credentials.mexc?.isValid && (
                    <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded text-xs text-yellow-600 dark:text-yellow-400">
                      Configure API credentials in Trading Settings to enable automated trading
                    </div>
                  )}
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">AI & Authentication Services</h4>
                    <Badge 
                      variant={systemState.openaiApi.status === 'healthy' && systemState.kindeAuth.status === 'healthy' ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {systemState.openaiApi.status === 'healthy' && systemState.kindeAuth.status === 'healthy' ? "Ready" : "Issues"}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>OpenAI API:</span>
                      <span className={systemState.openaiApi.status === 'healthy' ? 'text-green-500' : 'text-red-500'}>
                        {systemState.openaiApi.status === 'healthy' ? '✓ Configured' : '✗ Missing'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Kinde Auth:</span>
                      <span className={systemState.kindeAuth.status === 'healthy' ? 'text-green-500' : 'text-red-500'}>
                        {systemState.kindeAuth.status === 'healthy' ? '✓ Active' : '✗ Issues'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Workflows:</span>
                      <span className={systemState.inngestWorkflows.status === 'healthy' ? 'text-green-500' : systemState.inngestWorkflows.status === 'warning' ? 'text-yellow-500' : 'text-red-500'}>
                        {systemState.inngestWorkflows.status === 'healthy' ? '✓ Operational' : 
                         systemState.inngestWorkflows.status === 'warning' ? '⚠ Fallback' : '✗ Down'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Database:</span>
                      <span className={systemState.database.status === 'healthy' ? 'text-green-500' : 'text-red-500'}>
                        {systemState.database.status === 'healthy' ? '✓ Connected' : '✗ Issues'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Notice */}
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <div className="font-medium">Security Best Practices</div>
                    <div className="mt-1 space-y-1">
                      <div>• Use API keys with limited permissions (spot trading only)</div>
                      <div>• Never share your secret keys or store them in version control</div>
                      <div>• Regular monitor your account for unauthorized activity</div>
                      <div>• Enable 2FA on your exchange account for additional security</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Recommendations */}
        {(unhealthyCount > 0 || warningCount > 0) && (
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <CardTitle className="text-xl">System Recommendations</CardTitle>
                  <CardDescription>Actions to improve system health</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {systemState.database.status !== 'healthy' && (
                  <div className="p-3 border-l-4 border-red-500 bg-red-500/5">
                    <h4 className="font-medium text-red-700">Database Issues</h4>
                    <p className="text-sm text-red-600 mt-1">{systemState.database.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Check your DATABASE_URL or TURSO_* environment variables and ensure the database is accessible.
                    </p>
                  </div>
                )}
                
                {systemState.mexcApi.status !== 'healthy' && (
                  <div className="p-3 border-l-4 border-red-500 bg-red-500/5">
                    <h4 className="font-medium text-red-700">MEXC API Issues</h4>
                    <p className="text-sm text-red-600 mt-1">{systemState.mexcApi.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Check your internet connection and ensure MEXC API is not experiencing downtime.
                    </p>
                  </div>
                )}
                
                {systemState.openaiApi.status !== 'healthy' && (
                  <div className="p-3 border-l-4 border-red-500 bg-red-500/5">
                    <h4 className="font-medium text-red-700">OpenAI API Issues</h4>
                    <p className="text-sm text-red-600 mt-1">{systemState.openaiApi.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Set the OPENAI_API_KEY environment variable with a valid API key from OpenAI.
                    </p>
                  </div>
                )}
                
                {systemState.kindeAuth.status !== 'healthy' && (
                  <div className="p-3 border-l-4 border-red-500 bg-red-500/5">
                    <h4 className="font-medium text-red-700">Authentication Issues</h4>
                    <p className="text-sm text-red-600 mt-1">{systemState.kindeAuth.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Check your Kinde authentication configuration and environment variables.
                    </p>
                  </div>
                )}
                
                {systemState.environment.status === 'warning' && (
                  <div className="p-3 border-l-4 border-yellow-500 bg-yellow-500/5">
                    <h4 className="font-medium text-yellow-700">Environment Configuration</h4>
                    <p className="text-sm text-yellow-600 mt-1">{systemState.environment.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Consider setting optional environment variables for enhanced functionality.
                    </p>
                  </div>
                )}
                
                {systemState.inngestWorkflows.status === 'warning' && (
                  <div className="p-3 border-l-4 border-yellow-500 bg-yellow-500/5">
                    <h4 className="font-medium text-yellow-700">Workflow System</h4>
                    <p className="text-sm text-yellow-600 mt-1">{systemState.inngestWorkflows.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      System is running in fallback mode. Check Inngest configuration for full functionality.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Play className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <CardTitle className="text-xl">Quick Actions</CardTitle>
                <CardDescription>Common system administration tasks</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="h-auto p-4 flex flex-col space-y-2"
                onClick={() => window.open('/api/health/db', '_blank')}
              >
                <Database className="h-6 w-6" />
                <span>Database Health</span>
                <span className="text-xs text-muted-foreground">View detailed database status</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto p-4 flex flex-col space-y-2"
                onClick={() => window.open('/workflows', '_self')}
              >
                <GitBranch className="h-6 w-6" />
                <span>Workflow Status</span>
                <span className="text-xs text-muted-foreground">Check workflow system</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-auto p-4 flex flex-col space-y-2"
                onClick={() => window.open('/settings', '_self')}
              >
                <Key className="h-6 w-6" />
                <span>Trading Settings</span>
                <span className="text-xs text-muted-foreground">Manage API credentials</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}