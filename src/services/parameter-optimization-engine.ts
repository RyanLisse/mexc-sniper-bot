/**
 * Parameter Optimization Engine
 * 
 * AI-powered optimization system that automatically adjusts trading parameters,
 * agent configurations, and system settings based on real-time performance
 * metrics, market conditions, and historical data analysis.
 */

import { EventEmitter } from 'events';
import { BayesianOptimizer } from './optimization-models/bayesian-optimizer';
import { GeneticOptimizer } from './optimization-models/genetic-optimizer';
import { ReinforcementLearningOptimizer } from './optimization-models/rl-optimizer';
import { ParameterManager } from '../lib/parameter-management';
import { BacktestingFramework } from './backtesting-framework';
import { ABTestingFramework } from './ab-testing-framework';
import { logger } from '../lib/utils';

export interface OptimizationObjective {
  name: string;
  weight: number;
  direction: 'maximize' | 'minimize';
  metric: (performance: PerformanceMetrics) => number;
}

export interface PerformanceMetrics {
  profitability: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  avgTradeDuration: number;
  systemLatency: number;
  errorRate: number;
  patternAccuracy: number;
  riskAdjustedReturn: number;
  volatility: number;
  calmarRatio: number;
  beta: number;
}

export interface OptimizationStrategy {
  algorithm: 'bayesian' | 'genetic' | 'reinforcement_learning' | 'multi_objective';
  maxIterations: number;
  convergenceThreshold: number;
  parallelEvaluations: number;
  explorationRate: number;
  populationSize?: number; // For genetic algorithm
  acquisitionFunction?: 'ei' | 'ucb' | 'poi'; // For Bayesian optimization
  learningRate?: number; // For RL
}

export interface OptimizationRequest {
  parameterCategories: string[];
  objectives: OptimizationObjective[];
  strategy: OptimizationStrategy;
  safetyConstraints: Record<string, any>;
  backtestingPeriod: {
    start: Date;
    end: Date;
  };
  abTestConfig?: {
    trafficSplit: number;
    minSampleSize: number;
    significanceLevel: number;
  };
}

export interface OptimizationResult {
  optimizedParameters: Record<string, any>;
  performanceImprovement: number;
  confidenceInterval: [number, number];
  backtestResults: any;
  abTestResults?: any;
  convergenceMetrics: {
    iterations: number;
    finalScore: number;
    convergenceRate: number;
  };
  safetyValidation: {
    passed: boolean;
    violations: string[];
  };
}

export class ParameterOptimizationEngine extends EventEmitter {
  private bayesianOptimizer: BayesianOptimizer;
  private geneticOptimizer: GeneticOptimizer;
  private rlOptimizer: ReinforcementLearningOptimizer;
  private parameterManager: ParameterManager;
  private backtestingFramework: BacktestingFramework;
  private abTestingFramework: ABTestingFramework;
  
  private activeOptimizations = new Map<string, any>();
  private optimizationHistory: any[] = [];
  private performanceBaseline: PerformanceMetrics | null = null;

  constructor() {
    super();
    this.initializeComponents();
  }

  private initializeComponents(): void {
    this.bayesianOptimizer = new BayesianOptimizer();
    this.geneticOptimizer = new GeneticOptimizer();
    this.rlOptimizer = new ReinforcementLearningOptimizer();
    this.parameterManager = new ParameterManager();
    this.backtestingFramework = new BacktestingFramework();
    this.abTestingFramework = new ABTestingFramework();

    logger.info('Parameter Optimization Engine initialized with all components');
  }

  /**
   * Start optimization process
   */
  async startOptimization(request: OptimizationRequest): Promise<string> {
    const optimizationId = this.generateOptimizationId();
    
    try {
      // Validate request
      await this.validateOptimizationRequest(request);
      
      // Initialize optimization state
      const optimization = {
        id: optimizationId,
        request,
        status: 'running',
        startTime: new Date(),
        currentIteration: 0,
        bestParameters: null,
        bestScore: -Infinity,
        convergenceHistory: [],
      };
      
      this.activeOptimizations.set(optimizationId, optimization);
      
      // Start optimization process
      this.runOptimization(optimization);
      
      this.emit('optimizationStarted', { optimizationId, request });
      
      return optimizationId;
    } catch (error) {
      logger.error('Failed to start optimization:', error);
      throw error;
    }
  }

  /**
   * Main optimization execution loop
   */
  private async runOptimization(optimization: any): Promise<void> {
    const { request } = optimization;
    
    try {
      // Get current baseline performance
      if (!this.performanceBaseline) {
        this.performanceBaseline = await this.getCurrentPerformance();
      }
      
      // Select optimization algorithm
      const optimizer = this.selectOptimizer(request.strategy.algorithm);
      
      // Run optimization iterations
      for (let iteration = 0; iteration < request.strategy.maxIterations; iteration++) {
        optimization.currentIteration = iteration;
        
        // Generate parameter candidates
        const candidates = await optimizer.generateCandidates(
          optimization.bestParameters,
          optimization.convergenceHistory
        );
        
        // Evaluate candidates
        const evaluationResults = await this.evaluateCandidates(
          candidates,
          request
        );
        
        // Update best parameters
        const bestCandidate = this.selectBestCandidate(
          evaluationResults,
          request.objectives
        );
        
        if (bestCandidate.score > optimization.bestScore) {
          optimization.bestParameters = bestCandidate.parameters;
          optimization.bestScore = bestCandidate.score;
          
          this.emit('improvementFound', {
            optimizationId: optimization.id,
            improvement: bestCandidate.score - optimization.bestScore,
            parameters: bestCandidate.parameters
          });
        }
        
        // Check convergence
        optimization.convergenceHistory.push(bestCandidate.score);
        if (this.checkConvergence(optimization.convergenceHistory, request.strategy.convergenceThreshold)) {
          break;
        }
        
        // Update optimizer with results
        await optimizer.updateModel(evaluationResults);
        
        this.emit('iterationCompleted', {
          optimizationId: optimization.id,
          iteration,
          bestScore: optimization.bestScore
        });
      }
      
      // Finalize optimization
      await this.finalizeOptimization(optimization);
      
    } catch (error) {
      optimization.status = 'failed';
      optimization.error = error.message;
      logger.error('Optimization failed:', error);
      this.emit('optimizationFailed', { optimizationId: optimization.id, error });
    }
  }

  /**
   * Evaluate parameter candidates
   */
  private async evaluateCandidates(
    candidates: any[],
    request: OptimizationRequest
  ): Promise<any[]> {
    const results = [];
    
    for (const candidate of candidates) {
      try {
        // Validate safety constraints
        const safetyValidation = await this.validateSafetyConstraints(
          candidate,
          request.safetyConstraints
        );
        
        if (!safetyValidation.passed) {
          results.push({
            parameters: candidate,
            score: -Infinity,
            safetyValidation,
            valid: false
          });
          continue;
        }
        
        // Run backtesting
        const backtestResults = await this.backtestingFramework.runBacktest({
          parameters: candidate,
          period: request.backtestingPeriod,
          objectives: request.objectives
        });
        
        // Calculate objective score
        const score = this.calculateObjectiveScore(
          backtestResults.performance,
          request.objectives
        );
        
        results.push({
          parameters: candidate,
          score,
          backtestResults,
          safetyValidation,
          valid: true
        });
        
      } catch (error) {
        logger.error('Failed to evaluate candidate:', error);
        results.push({
          parameters: candidate,
          score: -Infinity,
          error: error.message,
          valid: false
        });
      }
    }
    
    return results;
  }

  /**
   * Calculate multi-objective score
   */
  private calculateObjectiveScore(
    performance: PerformanceMetrics,
    objectives: OptimizationObjective[]
  ): number {
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const objective of objectives) {
      const metricValue = objective.metric(performance);
      const normalizedValue = objective.direction === 'maximize' ? metricValue : -metricValue;
      totalScore += normalizedValue * objective.weight;
      totalWeight += objective.weight;
    }
    
    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Validate safety constraints
   */
  private async validateSafetyConstraints(
    parameters: any,
    constraints: Record<string, any>
  ): Promise<{ passed: boolean; violations: string[] }> {
    const violations: string[] = [];
    
    try {
      // Check parameter bounds
      for (const [paramName, paramValue] of Object.entries(parameters)) {
        const constraint = constraints[paramName];
        if (constraint) {
          if (constraint.min !== undefined && paramValue < constraint.min) {
            violations.push(`${paramName} below minimum: ${paramValue} < ${constraint.min}`);
          }
          if (constraint.max !== undefined && paramValue > constraint.max) {
            violations.push(`${paramName} above maximum: ${paramValue} > ${constraint.max}`);
          }
        }
      }
      
      // Check system constraints
      if (constraints.maxRisk && parameters.riskLevel > constraints.maxRisk) {
        violations.push(`Risk level exceeds maximum: ${parameters.riskLevel} > ${constraints.maxRisk}`);
      }
      
      if (constraints.minSharpeRatio && parameters.expectedSharpeRatio < constraints.minSharpeRatio) {
        violations.push(`Expected Sharpe ratio below minimum: ${parameters.expectedSharpeRatio} < ${constraints.minSharpeRatio}`);
      }
      
      return {
        passed: violations.length === 0,
        violations
      };
      
    } catch (error) {
      logger.error('Safety constraint validation failed:', error);
      return {
        passed: false,
        violations: ['Safety validation error: ' + error.message]
      };
    }
  }

  /**
   * Select best candidate from evaluation results
   */
  private selectBestCandidate(
    results: any[],
    objectives: OptimizationObjective[]
  ): any {
    const validResults = results.filter(r => r.valid && r.score > -Infinity);
    
    if (validResults.length === 0) {
      throw new Error('No valid candidates found');
    }
    
    // Sort by score (highest first)
    validResults.sort((a, b) => b.score - a.score);
    
    return validResults[0];
  }

  /**
   * Check convergence criteria
   */
  private checkConvergence(history: number[], threshold: number): boolean {
    if (history.length < 10) return false;
    
    const recentScores = history.slice(-10);
    const improvement = Math.max(...recentScores) - Math.min(...recentScores);
    
    return improvement < threshold;
  }

  /**
   * Finalize optimization and apply results
   */
  private async finalizeOptimization(optimization: any): Promise<void> {
    try {
      const { request } = optimization;
      
      // Run A/B test if configured
      let abTestResults = null;
      if (request.abTestConfig && optimization.bestParameters) {
        abTestResults = await this.abTestingFramework.runABTest({
          controlParameters: await this.parameterManager.getCurrentParameters(),
          treatmentParameters: optimization.bestParameters,
          config: request.abTestConfig
        });
        
        // Only apply if A/B test shows significant improvement
        if (!abTestResults.significantImprovement) {
          optimization.status = 'completed_no_improvement';
          optimization.abTestResults = abTestResults;
          this.emit('optimizationCompleted', { optimizationId: optimization.id, applied: false });
          return;
        }
      }
      
      // Apply optimized parameters
      if (optimization.bestParameters) {
        await this.applyOptimizedParameters(
          optimization.bestParameters,
          optimization.id
        );
      }
      
      optimization.status = 'completed';
      optimization.endTime = new Date();
      optimization.abTestResults = abTestResults;
      
      // Add to history
      this.optimizationHistory.push({
        ...optimization,
        duration: optimization.endTime - optimization.startTime
      });
      
      this.emit('optimizationCompleted', { 
        optimizationId: optimization.id, 
        applied: true,
        improvement: optimization.bestScore
      });
      
    } catch (error) {
      optimization.status = 'failed';
      optimization.error = error.message;
      logger.error('Failed to finalize optimization:', error);
      throw error;
    }
  }

  /**
   * Apply optimized parameters to the system
   */
  private async applyOptimizedParameters(
    parameters: any,
    optimizationId: string
  ): Promise<void> {
    try {
      // Create parameter version snapshot
      await this.parameterManager.createSnapshot(`optimization_${optimizationId}`);
      
      // Apply parameters with validation
      await this.parameterManager.updateParameters(parameters, {
        source: 'optimization',
        optimizationId,
        timestamp: new Date()
      });
      
      logger.info('Optimized parameters applied successfully', { optimizationId, parameters });
      
    } catch (error) {
      logger.error('Failed to apply optimized parameters:', error);
      throw error;
    }
  }

  /**
   * Get current system performance metrics
   */
  private async getCurrentPerformance(): Promise<PerformanceMetrics> {
    // This would integrate with existing performance monitoring
    // For now, return mock metrics
    return {
      profitability: 0.15,
      sharpeRatio: 1.2,
      maxDrawdown: 0.08,
      winRate: 0.65,
      avgTradeDuration: 3600,
      systemLatency: 150,
      errorRate: 0.02,
      patternAccuracy: 0.78,
      riskAdjustedReturn: 0.12,
      volatility: 0.25,
      calmarRatio: 1.8,
      beta: 0.85
    };
  }

  /**
   * Select appropriate optimizer based on algorithm type
   */
  private selectOptimizer(algorithm: string): any {
    switch (algorithm) {
      case 'bayesian':
        return this.bayesianOptimizer;
      case 'genetic':
        return this.geneticOptimizer;
      case 'reinforcement_learning':
        return this.rlOptimizer;
      default:
        return this.bayesianOptimizer; // Default to Bayesian
    }
  }

  /**
   * Validate optimization request
   */
  private async validateOptimizationRequest(request: OptimizationRequest): Promise<void> {
    if (!request.parameterCategories || request.parameterCategories.length === 0) {
      throw new Error('Parameter categories are required');
    }
    
    if (!request.objectives || request.objectives.length === 0) {
      throw new Error('Optimization objectives are required');
    }
    
    // Validate objective weights sum to 1
    const totalWeight = request.objectives.reduce((sum, obj) => sum + obj.weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      throw new Error('Objective weights must sum to 1.0');
    }
    
    // Validate backtesting period
    if (request.backtestingPeriod.start >= request.backtestingPeriod.end) {
      throw new Error('Invalid backtesting period');
    }
  }

  /**
   * Generate unique optimization ID
   */
  private generateOptimizationId(): string {
    return `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get optimization status
   */
  getOptimizationStatus(optimizationId: string): any {
    return this.activeOptimizations.get(optimizationId);
  }

  /**
   * Stop optimization
   */
  async stopOptimization(optimizationId: string): Promise<void> {
    const optimization = this.activeOptimizations.get(optimizationId);
    if (optimization) {
      optimization.status = 'stopped';
      optimization.endTime = new Date();
      this.emit('optimizationStopped', { optimizationId });
    }
  }

  /**
   * Get optimization history
   */
  getOptimizationHistory(): any[] {
    return this.optimizationHistory;
  }

  /**
   * Get current performance baseline
   */
  getPerformanceBaseline(): PerformanceMetrics | null {
    return this.performanceBaseline;
  }
}