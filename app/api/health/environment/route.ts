/**
 * Environment Health Check API Route
 * 
 * Comprehensive environment variable validation and health reporting.
 * Provides detailed analysis of missing variables, invalid values, and 
 * recommendations for proper configuration.
 */

import { NextRequest } from 'next/server';
import { apiResponse } from '@/src/lib/api-response';
import { environmentValidation } from '@/src/services/enhanced-environment-validation';

/**
 * GET /api/health/environment
 * Comprehensive environment variable health check
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get comprehensive environment validation
    const validation = environmentValidation.validateEnvironment();
    const healthSummary = environmentValidation.getHealthSummary();
    const missingByCategory = environmentValidation.getMissingByCategory();
    
    const responseTime = Date.now() - startTime;
    
    // Determine HTTP status based on health
    let statusCode = 200;
    if (healthSummary.status === 'critical') {
      statusCode = 503; // Service Unavailable
    } else if (healthSummary.status === 'warning') {
      statusCode = 200; // OK but with warnings
    }
    
    const responseData = {
      status: healthSummary.status,
      timestamp: new Date().toISOString(),
      responseTime,
      environment: process.env.NODE_ENV || 'development',
      validation: {
        isValid: validation.isValid,
        status: validation.status,
        summary: validation.summary,
        health: {
          score: healthSummary.score,
          issues: healthSummary.issues,
          recommendedActions: healthSummary.recommendedActions,
        },
      },
      categories: {
        core: {
          total: validation.results.filter(r => r.category === 'core').length,
          configured: validation.results.filter(r => r.category === 'core' && (r.status === 'configured' || r.status === 'default')).length,
          missing: validation.results.filter(r => r.category === 'core' && r.status === 'missing').length,
        },
        api: {
          total: validation.results.filter(r => r.category === 'api').length,
          configured: validation.results.filter(r => r.category === 'api' && (r.status === 'configured' || r.status === 'default')).length,
          missing: validation.results.filter(r => r.category === 'api' && r.status === 'missing').length,
        },
        database: {
          total: validation.results.filter(r => r.category === 'database').length,
          configured: validation.results.filter(r => r.category === 'database' && (r.status === 'configured' || r.status === 'default')).length,
          missing: validation.results.filter(r => r.category === 'database' && r.status === 'missing').length,
        },
        cache: {
          total: validation.results.filter(r => r.category === 'cache').length,
          configured: validation.results.filter(r => r.category === 'cache' && (r.status === 'configured' || r.status === 'default')).length,
          missing: validation.results.filter(r => r.category === 'cache' && r.status === 'missing').length,
        },
        monitoring: {
          total: validation.results.filter(r => r.category === 'monitoring').length,
          configured: validation.results.filter(r => r.category === 'monitoring' && (r.status === 'configured' || r.status === 'default')).length,
          missing: validation.results.filter(r => r.category === 'monitoring' && r.status === 'missing').length,
        },
        security: {
          total: validation.results.filter(r => r.category === 'security').length,
          configured: validation.results.filter(r => r.category === 'security' && (r.status === 'configured' || r.status === 'default')).length,
          missing: validation.results.filter(r => r.category === 'security' && r.status === 'missing').length,
        },
      },
      missingByCategory: Object.keys(missingByCategory).reduce((acc, category) => {
        acc[category] = missingByCategory[category].map(v => ({
          key: v.key,
          description: v.description,
          required: v.required,
          defaultValue: v.defaultValue,
          warning: v.warningIfMissing,
        }));
        return acc;
      }, {} as Record<string, any>),
      recommendations: validation.recommendations,
      developmentDefaults: validation.developmentDefaults,
    };
    
    const message = healthSummary.status === 'healthy' 
      ? 'Environment configuration is healthy'
      : healthSummary.status === 'warning'
      ? 'Environment configuration has minor issues'
      : 'Environment configuration has critical issues';
    
    return statusCode === 200
      ? apiResponse.success(responseData, { message })
      : apiResponse.error(message, statusCode, responseData);
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('[Environment Health] Environment health check failed:', error);
    
    return apiResponse.error('Environment health check failed', 500, {
      status: 'error',
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/health/environment
 * Generate development environment template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action } = body;
    
    if (action === 'generate_template') {
      const template = environmentValidation.generateDevelopmentTemplate();
      const validation = environmentValidation.validateEnvironment();
      
      return apiResponse.success({
        template,
        filename: '.env.development.template',
        missingCount: validation.summary.missing,
        instructions: [
          '1. Copy the template to .env.local',
          '2. Fill in the required values marked as REQUIRED_VALUE',
          '3. Customize optional values as needed',
          '4. Never commit .env.local to version control',
          '5. Run the health check again to verify configuration',
        ],
      }, { 
        message: 'Development environment template generated successfully' 
      });
    }
    
    if (action === 'validate_specific') {
      const { variables } = body;
      if (!Array.isArray(variables)) {
        return apiResponse.error('Variables array required for specific validation', 400);
      }
      
      const validation = environmentValidation.validateEnvironment();
      const specificResults = validation.results.filter(r => 
        variables.includes(r.key)
      );
      
      return apiResponse.success({
        results: specificResults,
        summary: {
          total: specificResults.length,
          configured: specificResults.filter(r => r.status === 'configured').length,
          missing: specificResults.filter(r => r.status === 'missing').length,
          invalid: specificResults.filter(r => r.status === 'invalid').length,
        },
      }, { 
        message: 'Specific variable validation completed' 
      });
    }
    
    return apiResponse.error('Invalid action. Use "generate_template" or "validate_specific"', 400);
    
  } catch (error) {
    console.error('[Environment Health] POST request failed:', error);
    
    return apiResponse.error('Environment health action failed', 500, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}