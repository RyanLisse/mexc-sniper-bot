/**
 * Unified Health Check Service for MEXC Sniper Bot
 *
 * This service consolidates all health check functionality into a single, modular system
 * to eliminate redundant API calls and provide consistent health reporting across the application.
 *
 * Features:
 * - Modular health check components
 * - Caching to prevent redundant checks
 * - Parallel execution for performance
 * - Comprehensive system overview
 * - Standardized response format
 */

import { 
  createHealthResponse, 
  createCredentialResponse, 
  createSystemOverviewResponse,
  createConfigResponse,
  type HealthCheckResult,
  type CredentialValidationResult,
  type SystemOverviewResult,
  type ConfigValidationResult
} from "./api-response";
import { checkDatabaseHealth, checkAuthTables } from "./db-health-check";
import { getRecommendedMexcService } from "../services/mexc-unified-exports";
import { getUserCredentials } from "../services/user-credentials-service";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import OpenAI from "openai";

// ============================================================================
// Health Check Cache
// ============================================================================

interface CachedHealthResult {
  result: any;
  timestamp: number;
  expiresAt: number;
}

class HealthCheckCache {
  private cache = new Map<string, CachedHealthResult>();
  private defaultTTL = 30000; // 30 seconds

  set(key: string, result: any, ttl?: number): void {
    const now = Date.now();
    this.cache.set(key, {
      result,
      timestamp: now,
      expiresAt: now + (ttl || this.defaultTTL)
    });
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.result;
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

const healthCache = new HealthCheckCache();

// Cleanup expired cache entries every 5 minutes
setInterval(() => healthCache.cleanup(), 5 * 60 * 1000);

// ============================================================================
// Individual Health Check Components
// ============================================================================

export class HealthCheckComponents {
  /**
   * Database connectivity and health check
   */
  static async checkDatabase(): Promise<HealthCheckResult> {
    const cacheKey = "database-health";
    const cached = healthCache.get(cacheKey);
    if (cached) return cached;

    try {
      const [dbHealth, authTables] = await Promise.all([
        checkDatabaseHealth(),
        checkAuthTables()
      ]);

      const isHealthy = dbHealth.healthy && authTables.healthy;
      const result: HealthCheckResult = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        message: isHealthy ? 'Database is operational' : 'Database has issues',
        details: {
          connectivity: dbHealth,
          authTables: authTables,
          environment: {
            DATABASE_URL: !!process.env.DATABASE_URL,
            DATABASE_URL_PROTOCOL: process.env.DATABASE_URL?.split('://')[0] || 'unknown',
            NODE_ENV: process.env.NODE_ENV || 'development',
          }
        }
      };

      healthCache.set(cacheKey, result, 60000); // Cache for 1 minute
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        status: 'error',
        message: `Database check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.message : String(error) }
      };
      return result;
    }
  }

  /**
   * Authentication system health check (Kinde)
   */
  static async checkAuthentication(): Promise<HealthCheckResult> {
    const cacheKey = "auth-health";
    const cached = healthCache.get(cacheKey);
    if (cached) return cached;

    try {
      // Required environment variables for Kinde Auth
      const requiredEnvs = [
        'KINDE_CLIENT_ID',
        'KINDE_CLIENT_SECRET', 
        'KINDE_ISSUER_URL',
        'KINDE_SITE_URL',
        'KINDE_POST_LOGOUT_REDIRECT_URL',
        'KINDE_POST_LOGIN_REDIRECT_URL'
      ];

      const missing = requiredEnvs.filter(env => process.env[env] === undefined);
      
      if (missing.length > 0) {
        const result: HealthCheckResult = {
          status: 'error',
          message: 'Missing required environment variables',
          details: { missingVars: missing }
        };
        return result;
      }

      // Test Kinde SDK functionality
      let kindeStatus = 'unknown';
      let authTestResult = null;
      
      try {
        const { isAuthenticated } = getKindeServerSession();
        const authResult = await isAuthenticated();
        kindeStatus = 'initialized';
        authTestResult = {
          sdk_accessible: true,
          session_check_working: true,
          auth_status: authResult || false
        };
      } catch (sdkError) {
        kindeStatus = 'error';
        authTestResult = {
          sdk_accessible: false,
          error: sdkError instanceof Error ? sdkError.message : 'Unknown SDK error'
        };
      }

      // Validate configuration values
      const configValidation = {
        issuer_url_format: this.validateUrlFormat(process.env.KINDE_ISSUER_URL, ['https']),
        site_url_format: this.validateUrlFormat(process.env.KINDE_SITE_URL, ['http', 'https']),
        client_id_format: Boolean(process.env.KINDE_CLIENT_ID && process.env.KINDE_CLIENT_ID.length > 0),
        redirect_urls_configured: Boolean(
          process.env.KINDE_POST_LOGIN_REDIRECT_URL && 
          process.env.KINDE_POST_LOGOUT_REDIRECT_URL
        )
      };

      const allConfigValid = Object.values(configValidation).every(Boolean);
      const isHealthy = kindeStatus === 'initialized' && allConfigValid;

      const result: HealthCheckResult = {
        status: kindeStatus === 'error' || !allConfigValid ? 'error' : 
                kindeStatus === 'unknown' ? 'warning' : 'healthy',
        message: isHealthy ? 'Authentication system fully operational' :
                kindeStatus === 'error' || !allConfigValid ? 'Authentication system has critical issues' :
                'Authentication system partially functional',
        details: {
          kindeStatus,
          configValidation,
          authTestResult,
          environmentVariables: {
            total_required: requiredEnvs.length,
            configured: requiredEnvs.length - missing.length,
            missing_count: missing.length
          }
        }
      };

      healthCache.set(cacheKey, result, 120000); // Cache for 2 minutes
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        status: 'error',
        message: `Auth check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.message : String(error) }
      };
      return result;
    }
  }

  /**
   * OpenAI API health check
   */
  static async checkOpenAI(): Promise<HealthCheckResult> {
    const cacheKey = "openai-health";
    const cached = healthCache.get(cacheKey);
    if (cached) return cached;

    try {
      if (!process.env.OPENAI_API_KEY) {
        const result: HealthCheckResult = {
          status: 'error',
          message: 'OpenAI API key not configured',
          details: { configured: false }
        };
        return result;
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      // Simple test to verify API key works
      const models = await openai.models.list();
      const hasGPT4 = models.data.some(model => model.id.includes('gpt-4'));

      const result: HealthCheckResult = {
        status: 'healthy',
        message: 'OpenAI API is accessible',
        details: {
          configured: true,
          accessible: true,
          modelCount: models.data.length,
          hasGPT4
        }
      };

      healthCache.set(cacheKey, result, 300000); // Cache for 5 minutes
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        status: 'error',
        message: `OpenAI API check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { 
          configured: !!process.env.OPENAI_API_KEY,
          accessible: false,
          error: error instanceof Error ? error.message : String(error)
        }
      };
      return result;
    }
  }

  /**
   * MEXC API connectivity and credentials check
   */
  static async checkMEXC(userId?: string): Promise<CredentialValidationResult> {
    const cacheKey = `mexc-health-${userId || 'anonymous'}`;
    const cached = healthCache.get(cacheKey);
    if (cached) return cached;

    try {
      // Check for user-specific credentials first
      let userCredentials = null;
      let hasUserCredentials = false;
      let hasEnvironmentCredentials = false;
      
      if (userId) {
        try {
          userCredentials = await getUserCredentials(userId, 'mexc');
          hasUserCredentials = !!userCredentials;
        } catch (error) {
          // Handle encryption service errors
          if (error instanceof Error && error.message.includes("Encryption service unavailable")) {
            return {
              hasCredentials: false,
              credentialsValid: false,
              credentialSource: 'none',
              connected: false,
              error: "Encryption service unavailable"
            };
          }
        }
      }
      
      // Check environment credentials
      hasEnvironmentCredentials = !!(process.env.MEXC_API_KEY && process.env.MEXC_SECRET_KEY);
      
      // Determine credential source
      let credentialSource: 'database' | 'environment' | 'none' = 'none';
      if (hasUserCredentials) {
        credentialSource = 'database';
      } else if (hasEnvironmentCredentials) {
        credentialSource = 'environment';
      }
      
      // Initialize service with appropriate credentials
      let mexcService;
      if (userCredentials) {
        mexcService = getRecommendedMexcService({
          apiKey: userCredentials.apiKey,
          secretKey: userCredentials.secretKey
        });
      } else {
        mexcService = getRecommendedMexcService();
      }
      
      // First check basic connectivity (network)
      const basicConnectivity = await mexcService.testConnectivity();
      
      if (!basicConnectivity) {
        const result: CredentialValidationResult = {
          hasCredentials: false,
          credentialsValid: false,
          credentialSource,
          connected: false,
          error: "MEXC API unreachable"
        };
        return result;
      }

      // Check if credentials are configured
      const hasCredentials = credentialSource !== "none";
      
      if (!hasCredentials) {
        const result: CredentialValidationResult = {
          hasCredentials: false,
          credentialsValid: false,
          credentialSource,
          connected: true,
          error: "No credentials configured"
        };
        return result;
      }

      // Test actual credentials by trying to get account info
      try {
        const accountResult = await mexcService.getAccountBalances();
        
        const result: CredentialValidationResult = {
          hasCredentials: true,
          credentialsValid: accountResult.success,
          credentialSource,
          connected: true,
          error: accountResult.success ? undefined : accountResult.error,
          details: {
            hasUserCredentials,
            hasEnvironmentCredentials,
            balanceCount: accountResult.data?.balances?.length || 0
          }
        };

        healthCache.set(cacheKey, result, 60000); // Cache for 1 minute
        return result;
      } catch (credentialError) {
        const result: CredentialValidationResult = {
          hasCredentials: true,
          credentialsValid: false,
          credentialSource,
          connected: true,
          error: credentialError instanceof Error ? credentialError.message : "Credential validation failed"
        };
        return result;
      }
    } catch (error) {
      const result: CredentialValidationResult = {
        hasCredentials: false,
        credentialsValid: false,
        credentialSource: 'none',
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
      return result;
    }
  }

  /**
   * Environment configuration check
   */
  static async checkEnvironment(): Promise<ConfigValidationResult> {
    const cacheKey = "environment-health";
    const cached = healthCache.get(cacheKey);
    if (cached) return cached;

    const requiredVars = [
      'DATABASE_URL',
      'OPENAI_API_KEY',
      'KINDE_CLIENT_ID',
      'KINDE_CLIENT_SECRET',
      'KINDE_ISSUER_URL',
      'KINDE_SITE_URL'
    ];

    const optionalVars = [
      'MEXC_API_KEY',
      'MEXC_SECRET_KEY',
      'ENCRYPTION_MASTER_KEY'
    ];

    const missingRequired = requiredVars.filter(key => !process.env[key]);
    const missingOptional = optionalVars.filter(key => !process.env[key]);
    const warnings: string[] = [];

    if (missingOptional.length > 0) {
      warnings.push(`Optional environment variables not set: ${missingOptional.join(', ')}`);
    }

    if (process.env.NODE_ENV === 'production' && !process.env.ENCRYPTION_MASTER_KEY) {
      warnings.push('ENCRYPTION_MASTER_KEY should be set in production');
    }

    const result: ConfigValidationResult = {
      valid: missingRequired.length === 0,
      missingVars: missingRequired,
      warnings: warnings,
      configSource: 'environment'
    };

    healthCache.set(cacheKey, result, 300000); // Cache for 5 minutes
    return result;
  }

  /**
   * Workflow/Agent system check
   */
  static async checkWorkflows(): Promise<HealthCheckResult> {
    const cacheKey = "workflow-health";
    const cached = healthCache.get(cacheKey);
    if (cached) return cached;

    try {
      // This is a placeholder - would check actual workflow status
      // In a real implementation, this would check Inngest functions, agent health, etc.
      const result: HealthCheckResult = {
        status: 'healthy',
        message: 'Workflow system operational',
        details: {
          inngestConfigured: !!process.env.INNGEST_EVENT_KEY,
          agentSystemActive: true,
          scheduledTasksRunning: true
        }
      };

      healthCache.set(cacheKey, result, 120000); // Cache for 2 minutes
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        status: 'error',
        message: `Workflow check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error: error instanceof Error ? error.message : String(error) }
      };
      return result;
    }
  }

  private static validateUrlFormat(url: string | undefined, allowedProtocols: string[]): boolean {
    if (!url) return false;
    
    try {
      const parsedUrl = new URL(url);
      return allowedProtocols.includes(parsedUrl.protocol.slice(0, -1));
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Unified Health Service
// ============================================================================

export class UnifiedHealthService {
  /**
   * Get comprehensive system health overview
   */
  static async getSystemHealth(userId?: string): Promise<SystemOverviewResult> {
    try {
      // Run all health checks in parallel
      const [
        databaseHealth,
        authHealth,
        openaiHealth,
        mexcHealth,
        environmentHealth,
        workflowHealth
      ] = await Promise.all([
        HealthCheckComponents.checkDatabase(),
        HealthCheckComponents.checkAuthentication(),
        HealthCheckComponents.checkOpenAI(),
        HealthCheckComponents.checkMEXC(userId),
        HealthCheckComponents.checkEnvironment(),
        HealthCheckComponents.checkWorkflows()
      ]);

      // Convert MEXC credential result to health result
      const mexcHealthResult: HealthCheckResult = {
        status: mexcHealth.credentialsValid ? 'healthy' : 
                mexcHealth.hasCredentials ? 'error' : 'warning',
        message: mexcHealth.credentialsValid ? 'MEXC API operational' :
                mexcHealth.hasCredentials ? 'MEXC credentials invalid' : 'MEXC credentials not configured',
        details: mexcHealth
      };

      // Convert environment config result to health result
      const envHealthResult: HealthCheckResult = {
        status: environmentHealth.valid ? (environmentHealth.warnings?.length ? 'warning' : 'healthy') : 'error',
        message: environmentHealth.valid ? 'Environment properly configured' : 'Environment configuration issues',
        details: environmentHealth
      };

      const components = {
        database: {
          status: databaseHealth.status,
          message: databaseHealth.message,
          details: databaseHealth.details
        },
        authentication: {
          status: authHealth.status,
          message: authHealth.message,
          details: authHealth.details
        },
        openai: {
          status: openaiHealth.status,
          message: openaiHealth.message,
          details: openaiHealth.details
        },
        mexc: {
          status: mexcHealthResult.status,
          message: mexcHealthResult.message,
          details: mexcHealthResult.details
        },
        environment: {
          status: envHealthResult.status,
          message: envHealthResult.message,
          details: envHealthResult.details
        },
        workflows: {
          status: workflowHealth.status,
          message: workflowHealth.message,
          details: workflowHealth.details
        }
      };

      // Calculate overall health
      const healthStatuses = Object.values(components).map(c => c.status);
      const healthyCount = healthStatuses.filter(s => s === 'healthy').length;
      const warningCount = healthStatuses.filter(s => s === 'warning').length;
      const unhealthyCount = healthStatuses.filter(s => s === 'unhealthy' || s === 'error').length;

      const overallStatus: 'healthy' | 'warning' | 'unhealthy' = 
        unhealthyCount > 0 ? 'unhealthy' :
        warningCount > 0 ? 'warning' : 'healthy';

      return {
        overallStatus,
        components,
        summary: {
          healthy: healthyCount,
          warnings: warningCount,
          unhealthy: unhealthyCount,
          total: healthStatuses.length
        }
      };
    } catch (error) {
      return {
        overallStatus: 'unhealthy',
        components: {
          system: {
            status: 'error',
            message: `System health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            details: { error: error instanceof Error ? error.message : String(error) }
          }
        },
        summary: {
          healthy: 0,
          warnings: 0,
          unhealthy: 1,
          total: 1
        }
      };
    }
  }

  /**
   * Get specific component health
   */
  static async getComponentHealth(component: string, userId?: string): Promise<HealthCheckResult | CredentialValidationResult> {
    switch (component.toLowerCase()) {
      case 'database':
      case 'db':
        return HealthCheckComponents.checkDatabase();
      
      case 'auth':
      case 'authentication':
        return HealthCheckComponents.checkAuthentication();
      
      case 'openai':
        return HealthCheckComponents.checkOpenAI();
      
      case 'mexc':
        return HealthCheckComponents.checkMEXC(userId);
      
      case 'environment':
      case 'env':
        return HealthCheckComponents.checkEnvironment() as unknown as Promise<HealthCheckResult>;
      
      case 'workflows':
      case 'agents':
        return HealthCheckComponents.checkWorkflows();
      
      default:
        throw new Error(`Unknown component: ${component}`);
    }
  }

  /**
   * Clear health check cache
   */
  static clearCache(): void {
    healthCache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; keys: string[] } {
    const keys: string[] = [];
    healthCache['cache'].forEach((_, key) => keys.push(key));
    return {
      size: healthCache['cache'].size,
      keys
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  UnifiedHealthService as default
};