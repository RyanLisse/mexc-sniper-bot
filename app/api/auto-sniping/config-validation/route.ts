/**
 * Auto-Sniping Configuration Validation API Route
 * 
 * Provides endpoints for validating MEXC API credentials and auto-sniping system readiness.
 * This is a critical endpoint that must be called before enabling auto-sniping functionality.
 */

import { NextRequest } from 'next/server';
import { createLogger } from '../../../../src/lib/structured-logger';
import { apiAuthWrapper } from '@/src/lib/api-auth';
import { createErrorResponse, createSuccessResponse } from '@/src/lib/api-response';
import { MexcConfigValidator } from '@/src/services/mexc-config-validator';

const logger = createLogger('route');

/**
 * GET /api/auto-sniping/config-validation
 * Generate comprehensive system readiness report
 */
export const GET = apiAuthWrapper(async (request: NextRequest) => {
  try {
    const validator = MexcConfigValidator.getInstance();
    const report = await validator.generateSystemReadinessReport();

    return Response.json(createSuccessResponse({
      message: 'System readiness report generated successfully',
      data: report,
    }));
  } catch (error) {
    logger.error('[Config Validation] Failed to generate readiness report:', error);
    return Response.json(
      createErrorResponse('Failed to generate system readiness report', {
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 }
    );
  }
});

/**
 * POST /api/auto-sniping/config-validation
 * Run specific validation checks or quick health check
 */
export const POST = apiAuthWrapper(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { action, component } = body;

    const validator = MexcConfigValidator.getInstance();

    switch (action) {
      case 'health_check':
        const healthCheck = await validator.quickHealthCheck();
        return Response.json(createSuccessResponse({
          message: 'Health check completed',
          data: healthCheck,
        }));

      case 'validate_component':
        if (!component) {
          return Response.json(
            createErrorResponse('Component parameter required for validation', {
              validComponents: ['mexc_credentials', 'pattern_detection', 'safety_systems', 'trading_config'],
            }),
            { status: 400 }
          );
        }

        let validationResult;
        switch (component) {
          case 'mexc_credentials':
            validationResult = await validator.validateMexcCredentials();
            break;
          case 'pattern_detection':
            validationResult = await validator.validatePatternDetection();
            break;
          case 'safety_systems':
            validationResult = await validator.validateSafetySystems();
            break;
          case 'trading_config':
            validationResult = await validator.validateTradingConfiguration();
            break;
          default:
            return Response.json(
              createErrorResponse('Invalid component specified', {
                component,
                validComponents: ['mexc_credentials', 'pattern_detection', 'safety_systems', 'trading_config'],
              }),
              { status: 400 }
            );
        }

        return Response.json(createSuccessResponse({
          message: `${component} validation completed`,
          data: validationResult,
        }));

      case 'full_validation':
        const fullReport = await validator.generateSystemReadinessReport();
        return Response.json(createSuccessResponse({
          message: 'Full system validation completed',
          data: fullReport,
        }));

      default:
        return Response.json(
          createErrorResponse('Invalid action specified', {
            action,
            validActions: ['health_check', 'validate_component', 'full_validation'],
          }),
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('[Config Validation] API request failed:', error);
    return Response.json(
      createErrorResponse('Configuration validation request failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 }
    );
  }
});

/**
 * PUT /api/auto-sniping/config-validation
 * Update configuration settings (for future use)
 */
export const PUT = apiAuthWrapper(async (request: NextRequest) => {
  try {
    // For now, return a placeholder response
    // This will be implemented when we add configuration management UI
    return Response.json(createSuccessResponse({
      message: 'Configuration update endpoint ready',
      data: {
        note: 'Configuration updates will be implemented in the next phase',
        currentlySupported: false,
      },
    }));
  } catch (error) {
    logger.error('[Config Validation] Configuration update failed:', error);
    return Response.json(
      createErrorResponse('Configuration update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 }
    );
  }
});