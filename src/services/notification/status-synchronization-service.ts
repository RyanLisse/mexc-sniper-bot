/**
 * Status Synchronization Service
 * 
 * Ensures consistent status updates across all credential and connectivity
 * systems when credentials are tested or validated successfully.
 * 
 * Addresses the synchronization gaps identified by the API Analysis Agent.
 */

import { getGlobalStatusResolver } from '@/src/services/notification/unified-status-resolver';
import { getGlobalCredentialValidator } from '@/src/services/api/enhanced-mexc-credential-validator';
import { getGlobalHealthMonitor } from '@/src/services/data/connection-health-monitor';
import { getGlobalRealTimeMonitor } from '@/src/services/notification/real-time-credential-monitor';
import { invalidateUserCredentialsCache } from '@/src/services/api/unified-mexc-service-factory';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface StatusSyncContext {
  userId: string;
  provider: string;
  action: 'credential-test' | 'credential-save' | 'credential-delete' | 'connectivity-change';
  timestamp: string;
  requestId?: string;
}

export interface StatusSyncResult {
  success: boolean;
  cacheInvalidated: boolean;
  statusRefreshed: boolean;
  servicesNotified: string[];
  timestamp: string;
  triggeredBy: string;
  error?: string;
}

// ============================================================================
// Main Service Class
// ============================================================================

export class StatusSynchronizationService {
  private logger = {
    info: (message: string, context?: any) =>
      console.info('[status-sync-service]', message, context || ''),
    warn: (message: string, context?: any) =>
      console.warn('[status-sync-service]', message, context || ''),
    error: (message: string, context?: any, error?: Error) =>
      console.error('[status-sync-service]', message, context || '', error || ''),
    debug: (message: string, context?: any) =>
      console.debug('[status-sync-service]', message, context || ''),
  };

  /**
   * Synchronize all status systems after successful credential validation
   */
  async synchronizeAfterCredentialTest(
    context: StatusSyncContext
  ): Promise<StatusSyncResult> {
    const startTime = Date.now();
    
    console.info('[StatusSync] Starting credential test synchronization', {
      userId: context.userId,
      provider: context.provider,
      action: context.action,
      requestId: context.requestId,
      timestamp: context.timestamp
    });

    try {
      const servicesNotified: string[] = [];
      
      // Step 1: Invalidate user credentials cache
      console.info('[StatusSync] Invalidating user credentials cache', {
        userId: context.userId,
        requestId: context.requestId
      });
      
      invalidateUserCredentialsCache(context.userId);
      servicesNotified.push('unified-mexc-service-cache');

      // Step 2: Reset and refresh global credential validator
      try {
        const credentialValidator = getGlobalCredentialValidator();
        credentialValidator.reset(); // Clear circuit breaker if needed
        
        // Trigger a fresh validation to update global state
        await credentialValidator.validateCredentials();
        servicesNotified.push('global-credential-validator');
        
        console.info('[StatusSync] Global credential validator refreshed', {
          requestId: context.requestId
        });
      } catch (error) {
        console.warn('[StatusSync] Failed to refresh credential validator:', {
          error: error instanceof Error ? error.message : String(error),
          requestId: context.requestId
        });
        // Continue with other services
      }

      // Step 3: Refresh health monitor
      try {
        const healthMonitor = getGlobalHealthMonitor();
        await healthMonitor.performHealthCheck();
        servicesNotified.push('global-health-monitor');
        
        console.info('[StatusSync] Health monitor refreshed', {
          requestId: context.requestId
        });
      } catch (error) {
        console.warn('[StatusSync] Failed to refresh health monitor:', {
          error: error instanceof Error ? error.message : String(error),
          requestId: context.requestId
        });
      }

      // Step 4: Refresh real-time monitor
      try {
        const realTimeMonitor = getGlobalRealTimeMonitor();
        await realTimeMonitor.refresh();
        servicesNotified.push('global-realtime-monitor');
        
        console.info('[StatusSync] Real-time monitor refreshed', {
          requestId: context.requestId
        });
      } catch (error) {
        console.warn('[StatusSync] Failed to refresh real-time monitor:', {
          error: error instanceof Error ? error.message : String(error),
          requestId: context.requestId
        });
      }

      // Step 5: Force refresh unified status resolver
      try {
        const statusResolver = getGlobalStatusResolver();
        await statusResolver.forceRefresh();
        servicesNotified.push('unified-status-resolver');
        
        console.info('[StatusSync] Unified status resolver refreshed', {
          requestId: context.requestId
        });
      } catch (error) {
        console.warn('[StatusSync] Failed to refresh status resolver:', {
          error: error instanceof Error ? error.message : String(error),
          requestId: context.requestId
        });
      }

      const duration = Date.now() - startTime;
      
      console.info('[StatusSync] Credential test synchronization completed', {
        userId: context.userId,
        servicesNotified,
        duration: `${duration}ms`,
        requestId: context.requestId
      });

      return {
        success: true,
        cacheInvalidated: true,
        statusRefreshed: true,
        servicesNotified,
        timestamp: new Date().toISOString(),
        triggeredBy: context.action,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error('[StatusSync] Synchronization failed:', {
        userId: context.userId,
        error: errorMessage,
        duration: `${duration}ms`,
        requestId: context.requestId
      });

      return {
        success: false,
        cacheInvalidated: false,
        statusRefreshed: false,
        servicesNotified: [],
        timestamp: new Date().toISOString(),
        triggeredBy: context.action,
        error: errorMessage,
      };
    }
  }

  /**
   * Synchronize status after credential changes (save/delete)
   */
  async synchronizeAfterCredentialChange(
    context: StatusSyncContext
  ): Promise<StatusSyncResult> {
    console.info('[StatusSync] Starting credential change synchronization', {
      userId: context.userId,
      action: context.action,
      requestId: context.requestId
    });

    // Use the same synchronization logic as credential test
    return this.synchronizeAfterCredentialTest(context);
  }

  /**
   * Get React Query cache keys that should be invalidated
   */
  getReactQueryKeysToInvalidate(userId: string): string[][] {
    return [
      ['mexc-connectivity', userId],
      ['api-credentials', userId],
      ['account-balance', userId, 'active'],
      ['credential-status', userId],
      ['mexc-status'],
      ['enhanced-connectivity'],
    ];
  }

  /**
   * Create synchronization context from request parameters
   */
  createSyncContext(
    userId: string,
    provider: string,
    action: StatusSyncContext['action'],
    requestId?: string
  ): StatusSyncContext {
    return {
      userId,
      provider,
      action,
      timestamp: new Date().toISOString(),
      requestId,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalStatusSyncService: StatusSynchronizationService | null = null;

/**
 * Get or create global status synchronization service instance
 */
export function getGlobalStatusSyncService(): StatusSynchronizationService {
  if (!globalStatusSyncService) {
    globalStatusSyncService = new StatusSynchronizationService();
  }
  return globalStatusSyncService;
}

/**
 * Utility function to synchronize after credential test
 */
export async function syncAfterCredentialTest(
  userId: string,
  provider: string,
  requestId?: string
): Promise<StatusSyncResult> {
  const syncService = getGlobalStatusSyncService();
  const context = syncService.createSyncContext(userId, provider, 'credential-test', requestId);
  return syncService.synchronizeAfterCredentialTest(context);
}

/**
 * Utility function to synchronize after credential changes
 */
export async function syncAfterCredentialChange(
  userId: string,
  provider: string,
  action: 'credential-save' | 'credential-delete',
  requestId?: string
): Promise<StatusSyncResult> {
  const syncService = getGlobalStatusSyncService();
  const context = syncService.createSyncContext(userId, provider, action, requestId);
  return syncService.synchronizeAfterCredentialChange(context);
}