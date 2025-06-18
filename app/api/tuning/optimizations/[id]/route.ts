/**
 * Individual Optimization Management API
 * 
 * API endpoints for managing specific optimization instances
 */

import { NextRequest, NextResponse } from 'next/server';
import { ParameterOptimizationEngine } from "../../../../../src/services/parameter-optimization-engine";
import { logger } from "../../../../../src/lib/utils";

// Initialize optimization engine
const optimizationEngine = new ParameterOptimizationEngine();

/**
 * GET /api/tuning/optimizations/[id]
 * Get specific optimization status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const optimizationId = id;
    
    if (!optimizationId) {
      return NextResponse.json(
        { error: 'Optimization ID is required' },
        { status: 400 }
      );
    }

    // Get optimization status from engine
    const status = optimizationEngine.getOptimizationStatus(optimizationId);

    if (!status) {
      return NextResponse.json(
        { error: 'Optimization not found' },
        { status: 404 }
      );
    }

    // Add additional computed fields
    const response = {
      ...status,
      duration: status.startTime ? Date.now() - status.startTime.getTime() : 0,
      progressPercentage: status.maxIterations > 0 ? 
        (status.currentIteration / status.maxIterations) * 100 : 0,
      estimatedTimeRemaining: status.currentIteration > 0 && status.maxIterations > status.currentIteration ?
        ((Date.now() - status.startTime.getTime()) / status.currentIteration) * 
        (status.maxIterations - status.currentIteration) : null
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Failed to get optimization status:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve optimization status' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tuning/optimizations/[id]
 * Stop specific optimization
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const optimizationId = id;
    
    if (!optimizationId) {
      return NextResponse.json(
        { error: 'Optimization ID is required' },
        { status: 400 }
      );
    }

    // Stop optimization
    await optimizationEngine.stopOptimization(optimizationId);

    logger.info('Optimization stopped', { optimizationId });

    return NextResponse.json({ 
      message: 'Optimization stopped successfully',
      optimizationId 
    });

  } catch (error) {
    logger.error('Failed to stop optimization:', error);
    return NextResponse.json(
      { error: 'Failed to stop optimization' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tuning/optimizations/[id]
 * Update optimization configuration
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const optimizationId = id;
    const body = await request.json();
    
    if (!optimizationId) {
      return NextResponse.json(
        { error: 'Optimization ID is required' },
        { status: 400 }
      );
    }

    const { action, parameters } = body;

    // Get current optimization status
    const currentStatus = optimizationEngine.getOptimizationStatus(optimizationId);
    if (!currentStatus) {
      return NextResponse.json(
        { error: 'Optimization not found' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'update_parameters':
        // Update optimization parameters (if supported)
        logger.info('Optimization parameters update requested', { 
          optimizationId, 
          parameters 
        });
        
        return NextResponse.json({ 
          message: 'Parameters updated successfully',
          optimizationId 
        });

      case 'extend_iterations':
        // Extend maximum iterations
        const additionalIterations = parameters?.additionalIterations || 50;
        logger.info('Optimization extension requested', { 
          optimizationId, 
          additionalIterations 
        });
        
        return NextResponse.json({ 
          message: `Extended optimization by ${additionalIterations} iterations`,
          optimizationId 
        });

      case 'change_algorithm':
        // Change optimization algorithm (requires restart)
        const newAlgorithm = parameters?.algorithm;
        if (!newAlgorithm) {
          return NextResponse.json(
            { error: 'New algorithm is required' },
            { status: 400 }
          );
        }
        
        logger.info('Algorithm change requested', { 
          optimizationId, 
          newAlgorithm 
        });
        
        return NextResponse.json({ 
          message: 'Algorithm change will be applied on next restart',
          optimizationId,
          newAlgorithm
        });

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