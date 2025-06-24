/**
import { createLogger } from '../../../../src/lib/structured-logger';
 * System Validation API Route
 * 
 * Provides comprehensive system readiness validation for auto-sniping activation.
 * Used by the system status dashboard to determine if auto-sniping can be safely enabled.
 */

import { NextRequest } from 'next/server';
import { apiResponse } from '@/src/lib/api-response';
import { systemReadinessValidator } from '@/src/services/system-readiness-validator';

/**
 * GET /api/system/validation
 * Comprehensive system readiness validation
 */
const logger = createLogger('route');

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    logger.info('[SystemValidation] Starting comprehensive system validation...');
    
    // Run comprehensive system validation
    const validation = await systemReadinessValidator.validateSystemReadiness();
    
    const responseTime = Date.now() - startTime;
    
    // Determine HTTP status based on validation result
    let statusCode = 200;
    if (validation.overall === 'critical_failure') {
      statusCode = 503; // Service Unavailable
    } else if (validation.overall === 'issues') {
      statusCode = 200; // OK but with warnings
    }
    
    const responseData = {
      ...validation,
      meta: {
        responseTime,
        endpoint: '/api/system/validation',
        timestamp: new Date().toISOString(),
      },
    };
    
    const message = validation.readyForAutoSniping 
      ? `System ready for auto-sniping (Score: ${validation.score}%)`
      : validation.overall === 'critical_failure'
      ? `Critical system failures detected (Score: ${validation.score}%)`
      : `System has issues but is functional (Score: ${validation.score}%)`;
    
    logger.info(`[SystemValidation] Validation complete. Status: ${validation.overall}, Ready: ${validation.readyForAutoSniping}, Score: ${validation.score}%`);
    
    return statusCode === 200
      ? apiResponse.success(responseData, { message })
      : apiResponse.error(message, statusCode, responseData);
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('[SystemValidation] System validation failed:', { error });
    
    return apiResponse.error('System validation failed', 500, {
      overall: 'critical_failure',
      readyForAutoSniping: false,
      score: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      meta: {
        responseTime,
        endpoint: '/api/system/validation',
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * POST /api/system/validation
 * Run specific validation checks or fix issues
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json().catch(() => ({}));
    const { action, component } = body;
    
    if (action === 'validate_component' && component) {
      // Run validation for a specific component
      const fullValidation = await systemReadinessValidator.validateSystemReadiness();
      const componentChecks = fullValidation.checks.filter(c => 
        c.component.toLowerCase().includes(component.toLowerCase())
      );
      
      const responseData = {
        component,
        checks: componentChecks,
        summary: {
          total: componentChecks.length,
          passed: componentChecks.filter(c => c.status === 'pass').length,
          warnings: componentChecks.filter(c => c.status === 'warning').length,
          failures: componentChecks.filter(c => c.status === 'fail').length,
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      };
      
      return apiResponse.success(responseData, { 
        message: `Validation completed for component: ${component}` 
      });
    }
    
    if (action === 'quick_health_check') {
      // Run a quick health check for dashboard
      try {
        const validation = await systemReadinessValidator.validateSystemReadiness();
        
        const quickResult = {
          status: validation.overall,
          readyForAutoSniping: validation.readyForAutoSniping,
          score: validation.score,
          criticalIssues: validation.checks.filter(c => c.required && c.status === 'fail').length,
          warnings: validation.checks.filter(c => c.status === 'warning').length,
          timestamp: validation.timestamp,
          summary: validation.summary,
        };
        
        return apiResponse.success(quickResult, { 
          message: 'Quick health check completed' 
        });
      } catch (error) {
        return apiResponse.error('Quick health check failed', 500, {
          status: 'critical_failure',
          readyForAutoSniping: false,
          score: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    if (action === 'get_recommendations') {
      // Get recommendations for fixing issues
      const validation = await systemReadinessValidator.validateSystemReadiness();
      
      const responseData = {
        recommendations: validation.recommendations,
        nextSteps: validation.nextSteps,
        fixableIssues: validation.checks.filter(c => c.fixable && c.status !== 'pass'),
        criticalIssues: validation.checks.filter(c => c.required && c.status === 'fail'),
        timestamp: validation.timestamp,
      };
      
      return apiResponse.success(responseData, { 
        message: 'Recommendations generated successfully' 
      });
    }
    
    return apiResponse.error('Invalid action. Use "validate_component", "quick_health_check", or "get_recommendations"', 400);
    
  } catch (error) {
    logger.error('[SystemValidation] POST request failed:', { error });
    
    return apiResponse.error('System validation action failed', 500, {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime,
    });
  }
}