/**
 * Bayesian Optimization Model
 *
 * Implements Bayesian optimization for parameter tuning using Gaussian Process
 * regression and acquisition functions for efficient exploration of parameter space.
 */

import { logger } from "../../lib/utils";

export interface BayesianConfig {
  acquisitionFunction: "ei" | "ucb" | "poi"; // Expected Improvement, Upper Confidence Bound, Probability of Improvement
  explorationFactor: number;
  kernelType: "rbf" | "matern" | "linear";
  lengthScale: number;
  noiseVariance: number;
  alpha: number; // Regularization parameter
}

export interface Observation {
  parameters: Record<string, number>;
  objective: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AcquisitionResult {
  parameters: Record<string, number>;
  acquisitionValue: number;
  uncertainty: number;
  meanPrediction: number;
}

export class BayesianOptimizer {
  private config: BayesianConfig;
  private observations: Observation[] = [];
  private parameterBounds: Record<string, { min: number; max: number }> = {};
  private kernelMatrix: number[][] = [];
  private inverseKernelMatrix: number[][] = [];
  private currentBest: { parameters: Record<string, number>; objective: number } | null = null;

  constructor(config?: Partial<BayesianConfig>) {
    this.config = {
      acquisitionFunction: "ei",
      explorationFactor: 2.0,
      kernelType: "rbf",
      lengthScale: 1.0,
      noiseVariance: 0.01,
      alpha: 1e-6,
      ...config,
    };

    logger.info("Bayesian Optimizer initialized", { config: this.config });
  }

  /**
   * Set parameter bounds for optimization
   */
  setParameterBounds(bounds: Record<string, { min: number; max: number }>): void {
    this.parameterBounds = { ...bounds };
    logger.info("Parameter bounds set", { bounds });
  }

  /**
   * Add observation to the dataset
   */
  addObservation(
    parameters: Record<string, number>,
    objective: number,
    metadata?: Record<string, any>
  ): void {
    const observation: Observation = {
      parameters: { ...parameters },
      objective,
      timestamp: new Date(),
      metadata,
    };

    this.observations.push(observation);

    // Update current best
    if (!this.currentBest || objective > this.currentBest.objective) {
      this.currentBest = {
        parameters: { ...parameters },
        objective,
      };
    }

    // Update Gaussian Process model
    this.updateGaussianProcess();

    logger.debug("Observation added", {
      parameters,
      objective,
      totalObservations: this.observations.length,
    });
  }

  /**
   * Generate candidate parameters using acquisition function
   */
  async generateCandidates(
    currentBest?: Record<string, number> | null,
    convergenceHistory?: number[]
  ): Promise<Record<string, number>[]> {
    if (this.observations.length === 0) {
      // Generate random initial candidates
      return this.generateRandomCandidates(5);
    }

    const candidates: Record<string, number>[] = [];
    const numCandidates = Math.min(10, Math.max(3, Math.floor(50 / this.observations.length)));

    // Generate candidates by optimizing acquisition function
    for (let i = 0; i < numCandidates; i++) {
      const candidate = await this.optimizeAcquisitionFunction();
      candidates.push(candidate.parameters);
    }

    // Add some random exploration candidates
    const explorationCandidates = this.generateRandomCandidates(2);
    candidates.push(...explorationCandidates);

    logger.debug("Generated candidates", {
      count: candidates.length,
      acquisitionFunction: this.config.acquisitionFunction,
    });

    return candidates;
  }

  /**
   * Update model with evaluation results
   */
  async updateModel(evaluationResults: any[]): Promise<void> {
    for (const result of evaluationResults) {
      if (result.valid && result.score > Number.NEGATIVE_INFINITY) {
        this.addObservation(result.parameters, result.score, {
          backtestResults: result.backtestResults,
          safetyValidation: result.safetyValidation,
        });
      }
    }

    logger.debug("Model updated with evaluation results", {
      validResults: evaluationResults.filter((r) => r.valid).length,
      totalObservations: this.observations.length,
    });
  }

  /**
   * Get current best parameters and objective
   */
  getCurrentBest(): { parameters: Record<string, number>; objective: number } | null {
    return this.currentBest ? { ...this.currentBest } : null;
  }

  /**
   * Get model statistics
   */
  getModelStats(): any {
    return {
      observations: this.observations.length,
      currentBest: this.currentBest,
      convergenceMetrics: this.calculateConvergenceMetrics(),
      acquisitionFunction: this.config.acquisitionFunction,
      explorationFactor: this.config.explorationFactor,
    };
  }

  /**
   * Update Gaussian Process model
   */
  private updateGaussianProcess(): void {
    if (this.observations.length < 2) return;

    try {
      // Build kernel matrix
      this.kernelMatrix = this.buildKernelMatrix();

      // Add noise to diagonal (regularization)
      for (let i = 0; i < this.kernelMatrix.length; i++) {
        this.kernelMatrix[i][i] += this.config.noiseVariance + this.config.alpha;
      }

      // Compute inverse kernel matrix using Cholesky decomposition
      this.inverseKernelMatrix = this.invertMatrix(this.kernelMatrix);
    } catch (error) {
      logger.error("Failed to update Gaussian Process:", error);
      // Fallback: add more regularization
      this.config.alpha *= 10;
      this.updateGaussianProcess();
    }
  }

  /**
   * Build kernel matrix using specified kernel function
   */
  private buildKernelMatrix(): number[][] {
    const n = this.observations.length;
    const matrix: number[][] = Array(n)
      .fill(null)
      .map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        matrix[i][j] = this.kernelFunction(
          this.observations[i].parameters,
          this.observations[j].parameters
        );
      }
    }

    return matrix;
  }

  /**
   * Kernel function (RBF by default)
   */
  private kernelFunction(params1: Record<string, number>, params2: Record<string, number>): number {
    const keys = Object.keys(this.parameterBounds);
    let squaredDistance = 0;

    for (const key of keys) {
      const diff = (params1[key] || 0) - (params2[key] || 0);
      squaredDistance += diff * diff;
    }

    switch (this.config.kernelType) {
      case "rbf":
        return Math.exp(-squaredDistance / (2 * this.config.lengthScale * this.config.lengthScale));

      case "matern":
        const r = Math.sqrt(squaredDistance);
        const scaledR = (Math.sqrt(3) * r) / this.config.lengthScale;
        return (1 + scaledR) * Math.exp(-scaledR);

      case "linear":
        return keys.reduce((sum, key) => sum + (params1[key] || 0) * (params2[key] || 0), 0);

      default:
        return Math.exp(-squaredDistance / (2 * this.config.lengthScale * this.config.lengthScale));
    }
  }

  /**
   * Predict mean and variance at given parameters
   */
  private predict(parameters: Record<string, number>): { mean: number; variance: number } {
    if (this.observations.length === 0) {
      return { mean: 0, variance: 1 };
    }

    if (this.observations.length === 1) {
      return { mean: this.observations[0].objective, variance: 0.1 };
    }

    try {
      // Compute kernel vector between test point and training points
      const kernelVector = this.observations.map((obs) =>
        this.kernelFunction(parameters, obs.parameters)
      );

      // Compute mean prediction
      const objectiveVector = this.observations.map((obs) => obs.objective);
      const mean = this.dotProduct(
        kernelVector,
        this.matrixVectorProduct(this.inverseKernelMatrix, objectiveVector)
      );

      // Compute variance prediction
      const kernelSelfValue = this.kernelFunction(parameters, parameters);
      const variance = Math.max(
        0,
        kernelSelfValue -
          this.dotProduct(
            kernelVector,
            this.matrixVectorProduct(this.inverseKernelMatrix, kernelVector)
          )
      );

      return { mean, variance };
    } catch (error) {
      logger.error("Prediction failed:", error);
      return { mean: 0, variance: 1 };
    }
  }

  /**
   * Optimize acquisition function to find next candidate
   */
  private async optimizeAcquisitionFunction(): Promise<AcquisitionResult> {
    let bestCandidate: AcquisitionResult | null = null;
    const numTrials = 100;

    // Random search over acquisition function (simple but effective)
    for (let i = 0; i < numTrials; i++) {
      const candidate = this.generateRandomCandidate();
      const prediction = this.predict(candidate);
      const acquisitionValue = this.calculateAcquisitionValue(prediction, candidate);

      if (!bestCandidate || acquisitionValue > bestCandidate.acquisitionValue) {
        bestCandidate = {
          parameters: candidate,
          acquisitionValue,
          uncertainty: Math.sqrt(prediction.variance),
          meanPrediction: prediction.mean,
        };
      }
    }

    return bestCandidate!;
  }

  /**
   * Calculate acquisition function value
   */
  private calculateAcquisitionValue(
    prediction: { mean: number; variance: number },
    parameters: Record<string, number>
  ): number {
    const { mean, variance } = prediction;
    const sigma = Math.sqrt(variance);

    if (sigma < 1e-6) {
      return 0; // No uncertainty, no value in exploring
    }

    switch (this.config.acquisitionFunction) {
      case "ei": // Expected Improvement
        if (!this.currentBest) return mean;

        const improvement = mean - this.currentBest.objective;
        const z = improvement / sigma;
        const phi = this.normalCDF(z);
        const pdf = this.normalPDF(z);

        return improvement * phi + sigma * pdf;

      case "ucb": // Upper Confidence Bound
        return mean + this.config.explorationFactor * sigma;

      case "poi": // Probability of Improvement
        if (!this.currentBest) return 0.5;

        const z_poi = (mean - this.currentBest.objective) / sigma;
        return this.normalCDF(z_poi);

      default:
        return mean + this.config.explorationFactor * sigma;
    }
  }

  /**
   * Generate random candidate within parameter bounds
   */
  private generateRandomCandidate(): Record<string, number> {
    const candidate: Record<string, number> = {};

    for (const [param, bounds] of Object.entries(this.parameterBounds)) {
      candidate[param] = bounds.min + Math.random() * (bounds.max - bounds.min);
    }

    return candidate;
  }

  /**
   * Generate multiple random candidates
   */
  private generateRandomCandidates(count: number): Record<string, number>[] {
    return Array(count)
      .fill(null)
      .map(() => this.generateRandomCandidate());
  }

  /**
   * Calculate convergence metrics
   */
  private calculateConvergenceMetrics(): any {
    if (this.observations.length < 5) {
      return { trend: "insufficient_data" };
    }

    const recentObjectives = this.observations.slice(-10).map((obs) => obs.objective);

    const improvement = Math.max(...recentObjectives) - Math.min(...recentObjectives);
    const trend = this.calculateTrend(recentObjectives);

    return {
      recentImprovement: improvement,
      trend,
      observationCount: this.observations.length,
      bestObjective: this.currentBest?.objective || 0,
    };
  }

  /**
   * Calculate trend in recent objectives
   */
  private calculateTrend(values: number[]): "improving" | "stable" | "declining" {
    if (values.length < 3) return "stable";

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    const improvementThreshold = 0.01;

    if (secondAvg > firstAvg + improvementThreshold) {
      return "improving";
    } else if (secondAvg < firstAvg - improvementThreshold) {
      return "declining";
    } else {
      return "stable";
    }
  }

  // Utility methods for linear algebra operations

  /**
   * Matrix inversion using Gaussian elimination
   */
  private invertMatrix(matrix: number[][]): number[][] {
    const n = matrix.length;
    const augmented: number[][] = matrix.map((row, i) => {
      const newRow = [...row];
      for (let j = 0; j < n; j++) {
        newRow.push(i === j ? 1 : 0);
      }
      return newRow;
    });

    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }

      // Swap rows
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

      // Make diagonal element 1
      const pivot = augmented[i][i];
      if (Math.abs(pivot) < 1e-10) {
        throw new Error("Matrix is singular");
      }

      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] /= pivot;
      }

      // Eliminate column
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = augmented[k][i];
          for (let j = 0; j < 2 * n; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }

    // Extract inverse matrix
    return augmented.map((row) => row.slice(n));
  }

  /**
   * Matrix-vector multiplication
   */
  private matrixVectorProduct(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, val, i) => sum + val * vector[i], 0));
  }

  /**
   * Dot product of two vectors
   */
  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, val, i) => sum + val * b[i], 0);
  }

  /**
   * Normal cumulative distribution function
   */
  private normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  /**
   * Normal probability density function
   */
  private normalPDF(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  /**
   * Error function approximation
   */
  private erf(x: number): number {
    // Abramowitz and Stegun approximation
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }
}
