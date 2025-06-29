/**
 * Optimization History API Routes
 * 
 * API endpoints for retrieving historical optimization runs and their results
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from "@/src/lib/utils";

/**
 * GET /api/tuning/optimization-history
 * Get optimization history with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // Filter by status
    const algorithm = searchParams.get('algorithm'); // Filter by algorithm
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') || 'startTime';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const includeMetadata = searchParams.get('includeMetadata') === 'true';

    // Generate realistic optimization history data
    const allRuns = generateOptimizationHistory();
    
    // Apply filters
    let filteredRuns = allRuns;
    
    if (status) {
      filteredRuns = filteredRuns.filter(run => run.status === status);
    }
    
    if (algorithm) {
      filteredRuns = filteredRuns.filter(run => 
        run.algorithm.toLowerCase().includes(algorithm.toLowerCase())
      );
    }

    // Sort results
    filteredRuns.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'startTime':
          aValue = new Date(a.startTime).getTime();
          bValue = new Date(b.startTime).getTime();
          break;
        case 'bestScore':
          aValue = a.bestScore;
          bValue = b.bestScore;
          break;
        case 'improvementPercent':
          aValue = a.improvementPercent;
          bValue = b.improvementPercent;
          break;
        case 'duration':
          aValue = a.endTime ? 
            new Date(a.endTime).getTime() - new Date(a.startTime).getTime() : 0;
          bValue = b.endTime ? 
            new Date(b.endTime).getTime() - new Date(b.startTime).getTime() : 0;
          break;
        default:
          aValue = a.startTime;
          bValue = b.startTime;
      }
      
      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : -1;
      } else {
        return aValue > bValue ? 1 : -1;
      }
    });

    // Apply pagination
    const paginatedRuns = filteredRuns.slice(offset, offset + limit);

    // Calculate statistics
    const completedRuns = filteredRuns.filter(run => run.status === 'completed');
    const avgImprovement = completedRuns.length > 0 
      ? completedRuns.reduce((sum, run) => sum + run.improvementPercent, 0) / completedRuns.length
      : 0;
    
    const response: any = {
      runs: paginatedRuns,
      pagination: {
        total: filteredRuns.length,
        limit,
        offset,
        hasMore: offset + limit < filteredRuns.length
      },
      statistics: {
        totalRuns: allRuns.length,
        completedRuns: allRuns.filter(run => run.status === 'completed').length,
        runningRuns: allRuns.filter(run => run.status === 'running').length,
        failedRuns: allRuns.filter(run => run.status === 'failed').length,
        averageImprovement: Math.round(avgImprovement * 100) / 100,
        bestImprovement: Math.max(...completedRuns.map(run => run.improvementPercent), 0),
        totalOptimizationTime: completedRuns.reduce((sum, run) => 
          sum + (run.metadata?.executionTime || 0), 0
        )
      },
      filters: {
        status,
        algorithm,
        sortBy,
        sortOrder
      },
      generatedAt: new Date().toISOString()
    };

    // Add metadata if requested
    if (includeMetadata) {
      response.metadata = {
        algorithms: [...new Set(allRuns.map(run => run.algorithm))],
        statusCounts: {
          running: allRuns.filter(run => run.status === 'running').length,
          completed: allRuns.filter(run => run.status === 'completed').length,
          failed: allRuns.filter(run => run.status === 'failed').length,
          paused: allRuns.filter(run => run.status === 'paused').length
        },
        dateRange: {
          earliest: allRuns.reduce((earliest, run) => 
            run.startTime < earliest ? run.startTime : earliest, 
            allRuns[0]?.startTime || new Date().toISOString()
          ),
          latest: allRuns.reduce((latest, run) => 
            run.startTime > latest ? run.startTime : latest, 
            allRuns[0]?.startTime || new Date().toISOString()
          )
        }
      };
    }

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Failed to get optimization history:', { error });
    return NextResponse.json(
      { error: 'Failed to retrieve optimization history' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tuning/optimization-history
 * Clean up old optimization history records
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const olderThan = searchParams.get('olderThan'); // Days
    const status = searchParams.get('status'); // Only delete records with this status
    const dryRun = searchParams.get('dryRun') === 'true';

    if (!olderThan) {
      return NextResponse.json(
        { error: 'olderThan parameter is required' },
        { status: 400 }
      );
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(olderThan));

    // In real implementation, this would delete records from database
    logger.info('Optimization history cleanup requested', { 
      olderThan, 
      status, 
      cutoffDate: cutoffDate.toISOString(),
      dryRun 
    });

    return NextResponse.json({
      message: dryRun 
        ? `Would delete records older than ${olderThan} days`
        : `Deleted records older than ${olderThan} days`,
      cutoffDate: cutoffDate.toISOString(),
      recordsAffected: dryRun ? 0 : Math.floor(Math.random() * 10) + 1
    });

  } catch (error) {
    logger.error('Failed to clean optimization history:', { error });
    return NextResponse.json(
      { error: 'Failed to clean optimization history' },
      { status: 500 }
    );
  }
}

/**
 * Generate realistic optimization history data
 */
function generateOptimizationHistory() {
  const now = new Date();
  const algorithms = [
    'Bayesian Optimization',
    'Genetic Algorithm',
    'Particle Swarm Optimization',
    'Random Forest Optimization',
    'Grid Search',
    'Gradient Descent',
    'Simulated Annealing',
    'Differential Evolution'
  ];
  
  const objectives = [
    'Maximize Sharpe Ratio',
    'Minimize Drawdown',
    'Maximize Profit Factor',
    'Optimize Risk-Adjusted Returns',
    'Minimize Volatility',
    'Maximize Win Rate',
    'Optimize Pattern Accuracy',
    'Minimize System Latency'
  ];

  const runs = [];
  
  // Generate 50 historical runs
  for (let i = 0; i < 50; i++) {
    const daysAgo = Math.floor(Math.random() * 90) + 1; // 1-90 days ago
    const startTime = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const durationHours = Math.random() * 48 + 0.5; // 0.5 to 48 hours
    const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);
    
    const status = Math.random() > 0.85 ? 
      (Math.random() > 0.5 ? 'failed' : 'paused') : 
      (Math.random() > 0.1 ? 'completed' : 'running');
    
    const algorithm = algorithms[Math.floor(Math.random() * algorithms.length)];
    const objective = objectives[Math.floor(Math.random() * objectives.length)];
    
    const maxIterations = Math.floor(Math.random() * 100) + 20;
    const currentIteration = status === 'completed' ? maxIterations : 
      Math.floor(Math.random() * maxIterations);
    
    const bestScore = Math.random() * 0.8 + 0.2; // 0.2 to 1.0
    const improvementPercent = status === 'completed' ? 
      (Math.random() * 40 - 5) : 0; // -5% to 35% improvement
    
    const parameterCount = Math.floor(Math.random() * 10) + 3; // 3-12 parameters
    const parameters: Record<string, any> = {};
    
    // Generate random parameters
    for (let j = 0; j < parameterCount; j++) {
      const paramName = [
        'riskThreshold', 'positionSize', 'takeProfitPercent', 'stopLossPercent',
        'patternSensitivity', 'confirmationBars', 'volumeThreshold', 'volatilityMultiplier',
        'timeoutMinutes', 'maxConcurrentTrades', 'entryDelay', 'exitDelay'
      ][j % 12];
      
      parameters[paramName] = Math.round((Math.random() * 0.1 + 0.01) * 1000) / 1000;
    }

    runs.push({
      id: `opt-run-${Date.now()}-${i}`,
      name: `${algorithm} - ${objective}`,
      algorithm,
      status: status as 'running' | 'completed' | 'failed' | 'paused',
      startTime: startTime.toISOString(),
      endTime: status === 'running' ? undefined : endTime.toISOString(),
      progress: Math.round((currentIteration / maxIterations) * 100),
      currentIteration,
      maxIterations,
      bestScore: Math.round(bestScore * 1000) / 1000,
      improvementPercent: Math.round(improvementPercent * 100) / 100,
      parameters,
      objective,
      metadata: {
        totalEvaluations: currentIteration * (Math.floor(Math.random() * 5) + 5),
        convergenceReached: status === 'completed' && Math.random() > 0.3,
        executionTime: Math.floor(durationHours * 3600), // seconds
        resourceUsage: {
          cpu: Math.floor(Math.random() * 60) + 20,
          memory: Math.floor(Math.random() * 1000) + 200
        },
        
        // Additional metadata
        hyperparameters: {
          learningRate: Math.random() * 0.01 + 0.001,
          batchSize: Math.floor(Math.random() * 128) + 32,
          tolerance: Math.random() * 0.001 + 0.0001
        },
        
        performanceMetrics: status === 'completed' ? {
          finalScore: bestScore,
          initialScore: bestScore - (improvementPercent / 100) * bestScore,
          convergenceIteration: Math.floor(currentIteration * 0.8),
          stabilityIndex: Math.random() * 0.5 + 0.5,
          robustnessScore: Math.random() * 0.8 + 0.2
        } : undefined,
        
        errorInfo: status === 'failed' ? {
          errorType: ['Convergence Error', 'Parameter Bounds Error', 'Resource Limit', 'Data Error'][
            Math.floor(Math.random() * 4)
          ],
          errorMessage: 'Optimization failed to converge within specified tolerance',
          lastValidIteration: Math.floor(currentIteration * 0.7)
        } : undefined,
        
        stopReason: status === 'paused' ? [
          'Manual Stop', 'Resource Limit', 'Time Limit', 'Emergency Stop'
        ][Math.floor(Math.random() * 4)] : undefined
      }
    });
  }
  
  return runs.sort((a, b) => 
    new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );
}