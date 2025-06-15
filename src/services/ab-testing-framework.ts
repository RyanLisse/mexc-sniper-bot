/**
 * A/B Testing Framework
 *
 * Statistical framework for testing parameter variations with controlled
 * experiments, statistical significance testing, and gradual rollout capabilities.
 */

import { EventEmitter } from "events";
import { logger } from "../lib/utils";

export interface ABTestConfig {
  controlParameters: Record<string, any>;
  treatmentParameters: Record<string, any>;
  trafficSplit: number; // Percentage for treatment group (0-1)
  minSampleSize: number;
  significanceLevel: number; // Alpha level (e.g., 0.05 for 95% confidence)
  testDuration?: number; // Duration in days
  successMetric: string;
  secondaryMetrics?: string[];
  stratificationFields?: string[]; // Fields to stratify users
  multipleTestingCorrection?: "bonferroni" | "benjamini_hochberg" | "none";
}

export interface ABTestParticipant {
  id: string;
  group: "control" | "treatment";
  assignmentTime: Date;
  stratificationValues?: Record<string, any>;
  metrics: Record<string, number>;
  sessionDuration?: number;
}

export interface ABTestResult {
  config: ABTestConfig;
  participants: {
    control: ABTestParticipant[];
    treatment: ABTestParticipant[];
  };
  statistics: {
    controlMean: number;
    treatmentMean: number;
    controlStdDev: number;
    treatmentStdDev: number;
    effect: number;
    effectSize: number; // Cohen's d
    pValue: number;
    confidenceInterval: [number, number];
    statisticalPower: number;
    requiredSampleSize: number;
  };
  significantImprovement: boolean;
  recommendations: {
    decision: "adopt" | "reject" | "extend_test" | "inconclusive";
    confidence: number;
    reasoning: string[];
  };
  secondaryResults?: Record<string, any>;
  bayesianAnalysis?: {
    probabilityBetter: number;
    expectedLift: number;
    credibleInterval: [number, number];
  };
}

export interface TestVariant {
  id: string;
  name: string;
  parameters: Record<string, any>;
  trafficAllocation: number;
  isControl: boolean;
}

export class ABTestingFramework extends EventEmitter {
  private activeTests = new Map<string, ABTest>();
  private testHistory: ABTestResult[] = [];
  private userAssignments = new Map<string, Map<string, string>>(); // userId -> testId -> variant

  constructor() {
    super();
  }

  /**
   * Start a new A/B test
   */
  async startTest(testId: string, config: ABTestConfig): Promise<string> {
    try {
      // Validate configuration
      this.validateConfig(config);

      // Create test instance
      const test = new ABTest(testId, config);
      this.activeTests.set(testId, test);

      // Start monitoring
      this.startTestMonitoring(testId);

      this.emit("testStarted", { testId, config });
      logger.info("A/B test started", { testId, trafficSplit: config.trafficSplit });

      return testId;
    } catch (error) {
      logger.error("Failed to start A/B test:", error);
      throw error;
    }
  }

  /**
   * Run complete A/B test with automated analysis
   */
  async runABTest(config: {
    controlParameters: Record<string, any>;
    treatmentParameters: Record<string, any>;
    config: ABTestConfig;
  }): Promise<ABTestResult> {
    const testId = `abtest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Start the test
      await this.startTest(testId, {
        controlParameters: config.controlParameters,
        treatmentParameters: config.treatmentParameters,
        ...config.config,
      });

      // Simulate test execution (in real implementation, this would run over time)
      const result = await this.simulateTestExecution(testId);

      // Analyze results
      const analysis = await this.analyzeTest(testId);

      // Stop test
      await this.stopTest(testId);

      this.emit("testCompleted", { testId, result: analysis });

      return analysis;
    } catch (error) {
      logger.error("A/B test execution failed:", error);
      throw error;
    }
  }

  /**
   * Assign user to test variant
   */
  assignUser(
    userId: string,
    testId: string,
    stratificationValues?: Record<string, any>
  ): { group: "control" | "treatment"; parameters: Record<string, any> } {
    const test = this.activeTests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    // Check if user already assigned
    const existingAssignment = this.getUserAssignment(userId, testId);
    if (existingAssignment) {
      return existingAssignment;
    }

    // Assign user to group
    const assignment = test.assignUser(userId, stratificationValues);

    // Store assignment
    if (!this.userAssignments.has(userId)) {
      this.userAssignments.set(userId, new Map());
    }
    this.userAssignments.get(userId)!.set(testId, assignment.group);

    return assignment;
  }

  /**
   * Record metric for user
   */
  recordMetric(userId: string, testId: string, metric: string, value: number): void {
    const test = this.activeTests.get(testId);
    if (!test) {
      logger.warn(`Test ${testId} not found for metric recording`);
      return;
    }

    test.recordMetric(userId, metric, value);
  }

  /**
   * Get user's test assignment
   */
  private getUserAssignment(
    userId: string,
    testId: string
  ): { group: "control" | "treatment"; parameters: Record<string, any> } | null {
    const userTests = this.userAssignments.get(userId);
    if (!userTests) return null;

    const assignment = userTests.get(testId);
    if (!assignment) return null;

    const test = this.activeTests.get(testId);
    if (!test) return null;

    return {
      group: assignment as "control" | "treatment",
      parameters:
        assignment === "control"
          ? test.getConfig().controlParameters
          : test.getConfig().treatmentParameters,
    };
  }

  /**
   * Analyze test results
   */
  async analyzeTest(testId: string): Promise<ABTestResult> {
    const test = this.activeTests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    const config = test.getConfig();
    const participants = test.getParticipants();

    // Calculate basic statistics
    const controlMetrics = participants.control
      .map((p) => p.metrics[config.successMetric])
      .filter((v) => v !== undefined);

    const treatmentMetrics = participants.treatment
      .map((p) => p.metrics[config.successMetric])
      .filter((v) => v !== undefined);

    if (controlMetrics.length === 0 || treatmentMetrics.length === 0) {
      throw new Error("Insufficient data for analysis");
    }

    // Statistical calculations
    const controlMean = this.calculateMean(controlMetrics);
    const treatmentMean = this.calculateMean(treatmentMetrics);
    const controlStdDev = this.calculateStdDev(controlMetrics, controlMean);
    const treatmentStdDev = this.calculateStdDev(treatmentMetrics, treatmentMean);

    const effect = treatmentMean - controlMean;
    const effectSize = this.calculateCohenD(
      treatmentMean,
      controlMean,
      treatmentStdDev,
      controlStdDev,
      treatmentMetrics.length,
      controlMetrics.length
    );

    // Statistical significance test (Welch's t-test)
    const tTestResult = this.welchTTest(
      controlMetrics,
      treatmentMetrics,
      controlMean,
      treatmentMean,
      controlStdDev,
      treatmentStdDev
    );

    const pValue = tTestResult.pValue;
    const confidenceInterval = this.calculateConfidenceInterval(
      effect,
      tTestResult.standardError,
      tTestResult.degreesOfFreedom,
      config.significanceLevel
    );

    // Statistical power analysis
    const statisticalPower = this.calculateStatisticalPower(
      effectSize,
      controlMetrics.length,
      treatmentMetrics.length,
      config.significanceLevel
    );

    const requiredSampleSize = this.calculateRequiredSampleSize(
      effectSize,
      config.significanceLevel,
      0.8 // 80% power
    );

    // Determine significance
    let adjustedAlpha = config.significanceLevel;
    if (config.multipleTestingCorrection) {
      adjustedAlpha = this.adjustForMultipleTesting(
        config.significanceLevel,
        1 + (config.secondaryMetrics?.length || 0),
        config.multipleTestingCorrection
      );
    }

    const significantImprovement = pValue < adjustedAlpha && effect > 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      pValue,
      effect,
      effectSize,
      statisticalPower,
      controlMetrics.length + treatmentMetrics.length,
      requiredSampleSize,
      adjustedAlpha
    );

    // Secondary metrics analysis
    const secondaryResults = config.secondaryMetrics
      ? this.analyzeSecondaryMetrics(participants, config.secondaryMetrics)
      : undefined;

    // Bayesian analysis
    const bayesianAnalysis = this.performBayesianAnalysis(controlMetrics, treatmentMetrics);

    const result: ABTestResult = {
      config,
      participants,
      statistics: {
        controlMean,
        treatmentMean,
        controlStdDev,
        treatmentStdDev,
        effect,
        effectSize,
        pValue,
        confidenceInterval,
        statisticalPower,
        requiredSampleSize,
      },
      significantImprovement,
      recommendations,
      secondaryResults,
      bayesianAnalysis,
    };

    // Add to history
    this.testHistory.push(result);

    return result;
  }

  /**
   * Simulate test execution for demonstration
   */
  private async simulateTestExecution(testId: string): Promise<void> {
    const test = this.activeTests.get(testId);
    if (!test) return;

    const config = test.getConfig();
    const participantsNeeded = Math.max(config.minSampleSize, 1000);

    // Simulate user interactions
    for (let i = 0; i < participantsNeeded; i++) {
      const userId = `user_${i}`;

      // Assign user
      const assignment = this.assignUser(userId, testId);

      // Simulate performance metric based on parameters
      const basePerformance = 0.1; // 10% base success rate
      const performanceBoost = assignment.group === "treatment" ? 0.02 : 0; // 2% boost for treatment

      // Add noise and calculate metric
      const noise = (Math.random() - 0.5) * 0.05; // ±2.5% noise
      const performance = Math.max(0, basePerformance + performanceBoost + noise);

      // Record primary metric
      this.recordMetric(userId, testId, config.successMetric, performance);

      // Record secondary metrics if defined
      if (config.secondaryMetrics) {
        for (const metric of config.secondaryMetrics) {
          const value = performance * (0.8 + Math.random() * 0.4); // Correlated secondary metric
          this.recordMetric(userId, testId, metric, value);
        }
      }
    }

    logger.info("A/B test simulation completed", {
      testId,
      participants: participantsNeeded,
    });
  }

  /**
   * Statistical helper methods
   */
  private calculateMean(values: number[]): number {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private calculateStdDev(values: number[], mean: number): number {
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  private calculateCohenD(
    mean1: number,
    mean2: number,
    std1: number,
    std2: number,
    n1: number,
    n2: number
  ): number {
    const pooledStd = Math.sqrt(((n1 - 1) * std1 * std1 + (n2 - 1) * std2 * std2) / (n1 + n2 - 2));
    return (mean1 - mean2) / pooledStd;
  }

  private welchTTest(
    sample1: number[],
    sample2: number[],
    mean1: number,
    mean2: number,
    std1: number,
    std2: number
  ): { tStatistic: number; pValue: number; degreesOfFreedom: number; standardError: number } {
    const n1 = sample1.length;
    const n2 = sample2.length;

    const variance1 = std1 * std1;
    const variance2 = std2 * std2;

    const standardError = Math.sqrt(variance1 / n1 + variance2 / n2);
    const tStatistic = (mean1 - mean2) / standardError;

    // Welch-Satterthwaite equation for degrees of freedom
    const degreesOfFreedom =
      Math.pow(variance1 / n1 + variance2 / n2, 2) /
      (Math.pow(variance1 / n1, 2) / (n1 - 1) + Math.pow(variance2 / n2, 2) / (n2 - 1));

    // Two-tailed p-value (simplified calculation)
    const pValue = 2 * (1 - this.tCDF(Math.abs(tStatistic), degreesOfFreedom));

    return { tStatistic, pValue, degreesOfFreedom, standardError };
  }

  private calculateConfidenceInterval(
    effect: number,
    standardError: number,
    degreesOfFreedom: number,
    alpha: number
  ): [number, number] {
    const tCritical = this.tInverse(1 - alpha / 2, degreesOfFreedom);
    const margin = tCritical * standardError;

    return [effect - margin, effect + margin];
  }

  private calculateStatisticalPower(
    effectSize: number,
    n1: number,
    n2: number,
    alpha: number
  ): number {
    // Simplified power calculation
    const ncp = (effectSize * Math.sqrt((n1 * n2) / (n1 + n2))) / 2;
    const tCritical = this.tInverse(1 - alpha / 2, n1 + n2 - 2);

    // Approximate power using normal distribution
    const power = 1 - this.normalCDF(tCritical - ncp) + this.normalCDF(-tCritical - ncp);

    return Math.max(0, Math.min(1, power));
  }

  private calculateRequiredSampleSize(effectSize: number, alpha: number, power: number): number {
    // Simplified sample size calculation
    const zAlpha = this.normalInverse(1 - alpha / 2);
    const zBeta = this.normalInverse(power);

    const n = 2 * Math.pow((zAlpha + zBeta) / effectSize, 2);

    return Math.ceil(n);
  }

  private adjustForMultipleTesting(
    alpha: number,
    numTests: number,
    method: "bonferroni" | "benjamini_hochberg" | "none"
  ): number {
    switch (method) {
      case "bonferroni":
        return alpha / numTests;
      case "benjamini_hochberg":
        // Simplified BH correction
        return alpha * (1 / numTests);
      case "none":
      default:
        return alpha;
    }
  }

  private generateRecommendations(
    pValue: number,
    effect: number,
    effectSize: number,
    power: number,
    sampleSize: number,
    requiredSampleSize: number,
    alpha: number
  ): {
    decision: "adopt" | "reject" | "extend_test" | "inconclusive";
    confidence: number;
    reasoning: string[];
  } {
    const reasoning: string[] = [];
    let decision: "adopt" | "reject" | "extend_test" | "inconclusive";
    let confidence: number;

    if (pValue < alpha && effect > 0) {
      if (effectSize > 0.2) {
        // Small to medium effect
        decision = "adopt";
        confidence = 0.9;
        reasoning.push("Statistically significant improvement detected");
        reasoning.push(`Effect size (${effectSize.toFixed(3)}) indicates meaningful impact`);
      } else {
        decision = "adopt";
        confidence = 0.7;
        reasoning.push("Statistically significant but small effect size");
        reasoning.push("Consider practical significance");
      }
    } else if (pValue >= alpha && sampleSize < requiredSampleSize) {
      decision = "extend_test";
      confidence = 0.6;
      reasoning.push("Insufficient sample size for reliable results");
      reasoning.push(`Need ${requiredSampleSize - sampleSize} more participants`);
    } else if (power < 0.8) {
      decision = "extend_test";
      confidence = 0.5;
      reasoning.push("Low statistical power");
      reasoning.push("Risk of missing true effects (Type II error)");
    } else if (pValue >= alpha) {
      decision = "reject";
      confidence = 0.8;
      reasoning.push("No statistically significant improvement");
      reasoning.push("Keep current parameters");
    } else {
      decision = "inconclusive";
      confidence = 0.3;
      reasoning.push("Mixed signals in the data");
      reasoning.push("Consider collecting more data or revising test design");
    }

    return { decision, confidence, reasoning };
  }

  private analyzeSecondaryMetrics(
    participants: { control: ABTestParticipant[]; treatment: ABTestParticipant[] },
    secondaryMetrics: string[]
  ): Record<string, any> {
    const results: Record<string, any> = {};

    for (const metric of secondaryMetrics) {
      const controlValues = participants.control
        .map((p) => p.metrics[metric])
        .filter((v) => v !== undefined);

      const treatmentValues = participants.treatment
        .map((p) => p.metrics[metric])
        .filter((v) => v !== undefined);

      if (controlValues.length > 0 && treatmentValues.length > 0) {
        const controlMean = this.calculateMean(controlValues);
        const treatmentMean = this.calculateMean(treatmentValues);
        const effect = treatmentMean - controlMean;

        results[metric] = {
          controlMean,
          treatmentMean,
          effect,
          relativeImprovement: controlMean > 0 ? effect / controlMean : 0,
        };
      }
    }

    return results;
  }

  private performBayesianAnalysis(
    controlMetrics: number[],
    treatmentMetrics: number[]
  ): { probabilityBetter: number; expectedLift: number; credibleInterval: [number, number] } {
    // Simplified Bayesian analysis using normal priors
    const controlMean = this.calculateMean(controlMetrics);
    const treatmentMean = this.calculateMean(treatmentMetrics);
    const controlStd = this.calculateStdDev(controlMetrics, controlMean);
    const treatmentStd = this.calculateStdDev(treatmentMetrics, treatmentMean);

    // Monte Carlo simulation for Bayesian inference
    const numSamples = 10000;
    let betterCount = 0;
    const liftSamples: number[] = [];

    for (let i = 0; i < numSamples; i++) {
      // Sample from posterior distributions (simplified)
      const controlSample = this.normalRandom(
        controlMean,
        controlStd / Math.sqrt(controlMetrics.length)
      );
      const treatmentSample = this.normalRandom(
        treatmentMean,
        treatmentStd / Math.sqrt(treatmentMetrics.length)
      );

      if (treatmentSample > controlSample) {
        betterCount++;
      }

      const lift = controlSample > 0 ? (treatmentSample - controlSample) / controlSample : 0;
      liftSamples.push(lift);
    }

    const probabilityBetter = betterCount / numSamples;
    const expectedLift = this.calculateMean(liftSamples);

    // 95% credible interval
    liftSamples.sort((a, b) => a - b);
    const credibleInterval: [number, number] = [
      liftSamples[Math.floor(numSamples * 0.025)],
      liftSamples[Math.floor(numSamples * 0.975)],
    ];

    return { probabilityBetter, expectedLift, credibleInterval };
  }

  /**
   * Validate test configuration
   */
  private validateConfig(config: ABTestConfig): void {
    if (config.trafficSplit < 0 || config.trafficSplit > 1) {
      throw new Error("Traffic split must be between 0 and 1");
    }

    if (config.minSampleSize < 1) {
      throw new Error("Minimum sample size must be at least 1");
    }

    if (config.significanceLevel <= 0 || config.significanceLevel >= 1) {
      throw new Error("Significance level must be between 0 and 1");
    }

    if (!config.successMetric) {
      throw new Error("Success metric is required");
    }
  }

  /**
   * Start monitoring test progress
   */
  private startTestMonitoring(testId: string): void {
    // In a real implementation, this would set up monitoring
    logger.info("Started monitoring A/B test", { testId });
  }

  /**
   * Stop active test
   */
  async stopTest(testId: string): Promise<void> {
    const test = this.activeTests.get(testId);
    if (test) {
      this.activeTests.delete(testId);
      this.emit("testStopped", { testId });
      logger.info("A/B test stopped", { testId });
    }
  }

  /**
   * Get test status
   */
  getTestStatus(testId: string): any {
    const test = this.activeTests.get(testId);
    if (!test) return null;

    const participants = test.getParticipants();
    return {
      testId,
      config: test.getConfig(),
      participantCount: {
        control: participants.control.length,
        treatment: participants.treatment.length,
        total: participants.control.length + participants.treatment.length,
      },
      status: "running",
    };
  }

  /**
   * Get test history
   */
  getTestHistory(): ABTestResult[] {
    return [...this.testHistory];
  }

  // Statistical distribution functions (simplified implementations)
  private tCDF(t: number, df: number): number {
    // Simplified t-distribution CDF approximation
    return 0.5 + 0.5 * this.erf(t / Math.sqrt(2));
  }

  private tInverse(p: number, df: number): number {
    // Simplified t-distribution inverse (approximation)
    return this.normalInverse(p) * (1 + 1 / (4 * df));
  }

  private normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private normalInverse(p: number): number {
    // Simplified normal distribution inverse using approximation
    if (p < 0.5) {
      return -this.normalInverse(1 - p);
    }

    const c = [2.515517, 0.802853, 0.010328];
    const d = [1.432788, 0.189269, 0.001308];

    const t = Math.sqrt(-2 * Math.log(1 - p));

    return t - (c[0] + c[1] * t + c[2] * t * t) / (1 + d[0] * t + d[1] * t * t + d[2] * t * t * t);
  }

  private normalRandom(mean = 0, std = 1): number {
    // Box-Muller transformation
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z * std + mean;
  }

  private erf(x: number): number {
    // Simplified error function approximation
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

/**
 * Individual A/B Test Class
 */
class ABTest {
  private testId: string;
  private config: ABTestConfig;
  private participants = new Map<string, ABTestParticipant>();
  private startTime: Date;

  constructor(testId: string, config: ABTestConfig) {
    this.testId = testId;
    this.config = config;
    this.startTime = new Date();
  }

  getConfig(): ABTestConfig {
    return this.config;
  }

  assignUser(
    userId: string,
    stratificationValues?: Record<string, any>
  ): { group: "control" | "treatment"; parameters: Record<string, any> } {
    // Check if user already assigned
    if (this.participants.has(userId)) {
      const participant = this.participants.get(userId)!;
      return {
        group: participant.group,
        parameters:
          participant.group === "control"
            ? this.config.controlParameters
            : this.config.treatmentParameters,
      };
    }

    // Assign user to group based on traffic split
    const hash = this.hashUserId(userId);
    const group = hash < this.config.trafficSplit ? "treatment" : "control";

    // Create participant record
    const participant: ABTestParticipant = {
      id: userId,
      group,
      assignmentTime: new Date(),
      stratificationValues,
      metrics: {},
    };

    this.participants.set(userId, participant);

    return {
      group,
      parameters:
        group === "control" ? this.config.controlParameters : this.config.treatmentParameters,
    };
  }

  recordMetric(userId: string, metric: string, value: number): void {
    const participant = this.participants.get(userId);
    if (participant) {
      participant.metrics[metric] = value;
    }
  }

  getParticipants(): { control: ABTestParticipant[]; treatment: ABTestParticipant[] } {
    const control: ABTestParticipant[] = [];
    const treatment: ABTestParticipant[] = [];

    for (const participant of this.participants.values()) {
      if (participant.group === "control") {
        control.push(participant);
      } else {
        treatment.push(participant);
      }
    }

    return { control, treatment };
  }

  private hashUserId(userId: string): number {
    // Simple hash function for consistent user assignment
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) / 2147483647; // Normalize to 0-1
  }
}
