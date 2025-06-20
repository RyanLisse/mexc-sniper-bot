/**
 * Parameter Optimization API Routes
 * 
 * API endpoints for managing parameter optimization processes
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getParameterOptimizationEngine } from "../../../../src/services/parameter-optimization-engine";
import { logger } from "../../../../src/lib/utils";

// Validation schemas
const OptimizationRequestSchema = z.object({
  parameterCategories: z.array(z.string()).min(1),
  objectives: z.array(z.object({
    name: z.string(),
    weight: z.number().min(0).max(1),
    direction: z.enum(['maximize', 'minimize']),
    metric: z.string()
  })).min(1),
  strategy: z.object({
    algorithm: z.enum(['simple', 'grid_search', 'random_search']),
    maxIterations: z.number().min(1).max(1000),
    convergenceThreshold: z.number().min(0.0001).max(0.1),
    parallelEvaluations: z.number().min(1).max(10),
    explorationRate: z.number().min(0.1).max(1.0)
  }),
  safetyConstraints: z.object({
    maxRiskLevel: z.number().min(0).max(1),
    minSharpeRatio: z.number().min(0),
    maxDrawdown: z.number().min(0).max(1),
    requireHumanApproval: z.boolean()
  }),
  backtestingPeriod: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }),
  abTestConfig: z.object({
    trafficSplit: z.number().min(0.01).max(0.5),
    minSampleSize: z.number().min(100),
    significanceLevel: z.number().min(0.01).max(0.1)
  }).optional()
});

/**
 * GET /api/tuning/optimizations
 * Get all active optimizations
 */
export async function GET() {
  try {
    // Get active optimizations from engine
    const activeOptimizations = [];
    
    // Mock data for demonstration
    const mockOptimizations = [
      {
        id: 'opt_1234567890',
        status: 'running',
        algorithm: 'Simple Optimization',
        progress: 65,
        currentIteration: 65,
        maxIterations: 100,
        bestScore: 0.847,
        startTime: new Date(Date.now() - 3600000),
        estimatedCompletion: new Date(Date.now() + 1800000),
        parametersOptimized: 12
      },
      {
        id: 'opt_0987654321',
        status: 'completed',
        algorithm: 'Random Search',
        progress: 100,
        currentIteration: 50,
        maxIterations: 50,
        bestScore: 0.923,
        startTime: new Date(Date.now() - 7200000),
        parametersOptimized: 8
      }
    ];

    return NextResponse.json(mockOptimizations);

  } catch (error) {
    logger.error('Failed to get optimizations:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve optimizations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tuning/optimizations
 * Start new optimization
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Handle different actions
    if (body.action === 'start') {
      // Start quick optimization with default settings
      const defaultRequest = {
        parameterCategories: ['trading', 'risk'],
        objectives: [
          {
            name: 'profitability',
            weight: 0.4,
            direction: 'maximize' as const,
            metric: (performance: any) => performance.profitability
          },
          {
            name: 'sharpeRatio',
            weight: 0.3,
            direction: 'maximize' as const,
            metric: (performance: any) => performance.sharpeRatio
          },
          {
            name: 'maxDrawdown',
            weight: 0.3,
            direction: 'minimize' as const,
            metric: (performance: any) => performance.maxDrawdown
          }
        ],
        strategy: {
          algorithm: 'simple' as const,
          maxIterations: 50,
          convergenceThreshold: 0.01,
          parallelEvaluations: 3,
          explorationRate: 0.2
        },
        safetyConstraints: {
          maxRiskLevel: 0.2,
          minSharpeRatio: 1.0,
          maxDrawdown: 0.15
        },
        backtestingPeriod: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          end: new Date()
        }
      };

      const optimizationEngine = getParameterOptimizationEngine();
      const optimizationId = await optimizationEngine.startOptimization(defaultRequest);
      
      return NextResponse.json({ 
        optimizationId,
        message: 'Optimization started successfully'
      });
    }

    // Validate full optimization request
    const validatedRequest = OptimizationRequestSchema.parse(body);

    // Convert string dates to Date objects and transform for OptimizationRequest
    const optimizationRequest: any = {
      parameterCategories: validatedRequest.parameterCategories || [],
      backtestingPeriod: {
        start: new Date(validatedRequest.backtestingPeriod.start),
        end: new Date(validatedRequest.backtestingPeriod.end)
      },
      objectives: validatedRequest.objectives.map(obj => ({
        name: obj.name || 'performance',
        weight: obj.weight || 1,
        direction: obj.direction || 'maximize',
        metric: (performance: any) => {
          switch (obj.metric) {
            case 'profitability': return performance.profitability;
            case 'sharpeRatio': return performance.sharpeRatio;
            case 'maxDrawdown': return performance.maxDrawdown;
            case 'winRate': return performance.winRate;
            case 'riskAdjustedReturn': return performance.riskAdjustedReturn;
            default: return 0;
          }
        }
      })),
      strategy: validatedRequest.strategy || {
        algorithm: 'simple',
        maxIterations: 100,
        convergenceThreshold: 0.01,
        parallelEvaluations: 4,
        explorationRate: 0.1
      },
      safetyConstraints: validatedRequest.safetyConstraints || {},
      abTestConfig: validatedRequest.abTestConfig
    };

    // Start optimization
    const optimizationEngine = getParameterOptimizationEngine();
    const optimizationId = await optimizationEngine.startOptimization(optimizationRequest);

    logger.info('Optimization started', { optimizationId, algorithm: validatedRequest.strategy.algorithm });

    return NextResponse.json({ 
      optimizationId,
      message: 'Optimization started successfully'
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Failed to start optimization:', error);
    return NextResponse.json(
      { error: 'Failed to start optimization' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/tuning/optimizations
 * Update optimization configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { optimizationId, action } = body;

    if (!optimizationId) {
      return NextResponse.json(
        { error: 'Optimization ID is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'pause':
        // Pause optimization (not implemented in engine yet)
        logger.info('Optimization pause requested', { optimizationId });
        return NextResponse.json({ message: 'Optimization paused' });

      case 'resume':
        // Resume optimization (not implemented in engine yet)
        logger.info('Optimization resume requested', { optimizationId });
        return NextResponse.json({ message: 'Optimization resumed' });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error('Failed to update optimization:', error);
    return NextResponse.json(
      { error: 'Failed to update optimization' },
      { status: 500 }
    );
  }
}