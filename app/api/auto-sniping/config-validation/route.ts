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
// Function defined at bottom of file

const logger = createLogger('route');

// Configuration validation function
async function validateAutoSnipingConfig(config: any): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate required fields
  if (config.maxPositions !== undefined) {
    if (typeof config.maxPositions !== 'number' || config.maxPositions < 1 || config.maxPositions > 50) {
      errors.push('maxPositions must be a number between 1 and 50');
    }
  }
  
  if (config.maxDailyTrades !== undefined) {
    if (typeof config.maxDailyTrades !== 'number' || config.maxDailyTrades < 1 || config.maxDailyTrades > 1000) {
      errors.push('maxDailyTrades must be a number between 1 and 1000');
    }
  }
  
  if (config.positionSizeUSDT !== undefined) {
    if (typeof config.positionSizeUSDT !== 'number' || config.positionSizeUSDT <= 0 || config.positionSizeUSDT > 10000) {
      errors.push('positionSizeUSDT must be a number between 0 and 10000');
    }
  }
  
  if (config.minConfidence !== undefined) {
    if (typeof config.minConfidence !== 'number' || config.minConfidence < 0 || config.minConfidence > 100) {
      errors.push('minConfidence must be a number between 0 and 100');
    }
  }
  
  if (config.stopLossPercentage !== undefined) {
    if (typeof config.stopLossPercentage !== 'number' || config.stopLossPercentage < 0 || config.stopLossPercentage > 50) {
      errors.push('stopLossPercentage must be a number between 0 and 50');
    }
  }
  
  if (config.maxDrawdownPercentage !== undefined) {
    if (typeof config.maxDrawdownPercentage !== 'number' || config.maxDrawdownPercentage < 0 || config.maxDrawdownPercentage > 100) {
      errors.push('maxDrawdownPercentage must be a number between 0 and 100');
    }
  }
  
  // Validate pattern types
  if (config.allowedPatternTypes !== undefined) {
    if (!Array.isArray(config.allowedPatternTypes)) {
      errors.push('allowedPatternTypes must be an array');
    } else {
      const validTypes = ['ready_state', 'pre_ready', 'launch_sequence', 'risk_warning'];
      const invalidTypes = config.allowedPatternTypes.filter((type: any) => !validTypes.includes(type));
      if (invalidTypes.length > 0) {
        errors.push(`Invalid pattern types: ${invalidTypes.join(', ')}. Valid types: ${validTypes.join(', ')}`);
      }
    }
  }
  
  // Add warnings for potentially risky configurations
  if (config.maxPositions > 20) {
    warnings.push('High maxPositions value may increase risk exposure');
  }
  
  if (config.stopLossPercentage < 2) {
    warnings.push('Low stop loss percentage may result in frequent small losses');
  }
  
  if (config.minConfidence < 60) {
    warnings.push('Low minimum confidence may result in lower quality trades');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

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
    logger.error('[Config Validation] Failed to generate readiness report:', { error });
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
    logger.error('[Config Validation] API request failed:', { error });
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
 * Update and validate auto-sniping configuration settings
 */
export const PUT = apiAuthWrapper(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { config, validateOnly = false } = body;
    
    if (!config || typeof config !== 'object') {
      return Response.json(createErrorResponse(
        'Invalid request: config object is required',
        { code: 'MISSING_CONFIG' }
      ), { status: 400 });
    }

    // Validate configuration using the auto-sniping core
    const { OptimizedAutoSnipingCore } = await import('../../../../src/services/optimized-auto-sniping-core');
    const autoSnipingService = OptimizedAutoSnipingCore.getInstance();
    
    // Perform validation
    const validationResult = await validateAutoSnipingConfig(config);
    
    if (!validationResult.isValid) {
      return Response.json(createErrorResponse(
        'Configuration validation failed',
        { 
          errors: validationResult.errors,
          code: 'VALIDATION_FAILED'
        }
      ), { status: 400 });
    }
    
    // If validateOnly is true, just return validation results
    if (validateOnly) {
      return Response.json(createSuccessResponse({
        message: 'Configuration validation passed',
        validation: validationResult,
        wouldUpdate: Object.keys(config)
      }));
    }
    
    // Update the configuration
    try {
      autoSnipingService.updateConfig(config);
      
      // Get updated configuration to confirm changes
      const updatedConfig = await autoSnipingService.getConfig();
      
      return Response.json(createSuccessResponse({
        message: 'Configuration updated successfully',
        updatedFields: Object.keys(config),
        currentConfig: updatedConfig,
        validation: validationResult
      }));
    } catch (updateError) {
      return Response.json(createErrorResponse(
        'Configuration update failed',
        { 
          error: updateError instanceof Error ? updateError.message : 'Unknown error',
          code: 'UPDATE_FAILED'
        }
      ), { status: 500 });
    }
  } catch (error) {
    logger.error('[Config Validation] Configuration update failed:', { error: error instanceof Error ? error.message : String(error) });
    return Response.json(
      createErrorResponse('Configuration update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500 }
    );
  }
});