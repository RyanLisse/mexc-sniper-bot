import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, and, gte, lte, desc, asc } from "drizzle-orm";
import { 
  anomalyModels,
  type InsertAnomalyModel,
  type SelectAnomalyModel
} from "../db/schemas/alerts";
import { agentPerformanceMetrics, systemHealthMetrics } from "../db/schema";

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  score: number; // Standard deviations from normal
  confidence: number; // 0-1 confidence in the result
  explanation?: string;
  features?: Record<string, number>;
}

export interface TrainingDataPoint {
  timestamp: number;
  value: number;
  features?: Record<string, number>;
}

export interface ModelPerformanceMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  falsePositiveRate: number;
}

interface StatisticalModel {
  mean: number;
  stdDev: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  sampleCount: number;
  lastUpdated: number;
}

interface IsolationForestModel {
  trees: IsolationTree[];
  sampleSize: number;
  featureNames: string[];
  lastUpdated: number;
}

interface IsolationTree {
  splitFeature?: string;
  splitValue?: number;
  left?: IsolationTree;
  right?: IsolationTree;
  isLeaf: boolean;
  depth: number;
  size: number;
}

interface SeasonalModel {
  hourlyPatterns: number[];
  dailyPatterns: number[];
  weeklyPatterns: number[];
  seasonalFactors: number[];
  trend: number;
  lastUpdated: number;
}

export class AnomalyDetectionService {
  private db: any;
  private models: Map<string, any> = new Map();
  private trainingQueue: Map<string, TrainingDataPoint[]> = new Map();
  private retrainingThreshold = 1000; // Retrain after 1000 new data points
  private maxModelAge = 86400000; // 24 hours in milliseconds

  constructor(database: any) {
    this.db = database;
  }

  async initialize(): Promise<void> {
    console.log("Initializing Anomaly Detection Service...");
    
    // Load existing models from database
    await this.loadModelsFromDatabase();
    
    // Start background model maintenance
    this.startModelMaintenance();
    
    console.log(`Loaded ${this.models.size} anomaly detection models`);
  }

  // ==========================================
  // ANOMALY DETECTION
  // ==========================================

  async detectAnomaly(
    metricName: string,
    value: number,
    timestamp: number,
    features?: Record<string, number>
  ): Promise<AnomalyDetectionResult> {
    try {
      // Get or create model for this metric
      let model = await this.getModel(metricName);
      
      if (!model) {
        // Create new model if none exists
        model = await this.createModel(metricName, "statistical");
        
        // Return no anomaly for new metrics until we have training data
        return {
          isAnomaly: false,
          score: 0,
          confidence: 0,
          explanation: "Insufficient training data for anomaly detection"
        };
      }

      // Add data point to training queue
      this.addToTrainingQueue(metricName, { timestamp, value, features });

      // Detect anomaly based on model type
      const result = await this.detectAnomalyWithModel(model, value, features);
      
      // Update model if needed
      if (this.shouldRetrainModel(metricName)) {
        this.scheduleModelRetrain(metricName);
      }

      return result;
    } catch (error) {
      console.error(`Error detecting anomaly for ${metricName}:`, error);
      return {
        isAnomaly: false,
        score: 0,
        confidence: 0,
        explanation: "Error during anomaly detection"
      };
    }
  }

  private async detectAnomalyWithModel(
    model: SelectAnomalyModel,
    value: number,
    features?: Record<string, number>
  ): Promise<AnomalyDetectionResult> {
    const modelData = this.deserializeModel(model.modelData);
    
    switch (model.modelType) {
      case "statistical":
        return this.detectStatisticalAnomaly(modelData as StatisticalModel, value);
      case "isolation_forest":
        return this.detectIsolationForestAnomaly(modelData as IsolationForestModel, value, features);
      case "seasonal":
        return this.detectSeasonalAnomaly(modelData as SeasonalModel, value, Date.now());
      default:
        throw new Error(`Unknown model type: ${model.modelType}`);
    }
  }

  private detectStatisticalAnomaly(model: StatisticalModel, value: number): AnomalyDetectionResult {
    // Z-score based detection
    const zScore = Math.abs((value - model.mean) / model.stdDev);
    
    // IQR based detection for additional validation
    const isIQROutlier = value < (model.q1 - 1.5 * model.iqr) || value > (model.q3 + 1.5 * model.iqr);
    
    // Combined scoring
    const isAnomaly = zScore > 2.5 || isIQROutlier;
    const confidence = Math.min(zScore / 4.0, 1.0); // Normalize to 0-1
    
    return {
      isAnomaly,
      score: zScore,
      confidence,
      explanation: isAnomaly 
        ? `Value ${value} is ${zScore.toFixed(2)} standard deviations from mean ${model.mean.toFixed(2)}`
        : "Value is within normal range",
      features: {
        zScore,
        mean: model.mean,
        stdDev: model.stdDev,
        iqrOutlier: isIQROutlier ? 1 : 0
      }
    };
  }

  private detectIsolationForestAnomaly(
    model: IsolationForestModel,
    value: number,
    features?: Record<string, number>
  ): AnomalyDetectionResult {
    // Simplified isolation forest implementation
    const dataPoint = this.buildFeatureVector(value, features, model.featureNames);
    
    let totalPathLength = 0;
    for (const tree of model.trees) {
      totalPathLength += this.calculatePathLength(tree, dataPoint, 0);
    }
    
    const avgPathLength = totalPathLength / model.trees.length;
    const expectedPathLength = this.calculateExpectedPathLength(model.sampleSize);
    
    // Anomaly score based on path length
    const anomalyScore = Math.pow(2, -avgPathLength / expectedPathLength);
    const isAnomaly = anomalyScore > 0.6; // Threshold for anomaly
    
    return {
      isAnomaly,
      score: anomalyScore * 4, // Scale to match statistical model output
      confidence: anomalyScore,
      explanation: isAnomaly 
        ? `Isolation path length ${avgPathLength.toFixed(2)} indicates anomaly`
        : "Normal isolation path length",
      features: {
        pathLength: avgPathLength,
        anomalyScore,
        expectedPathLength
      }
    };
  }

  private detectSeasonalAnomaly(model: SeasonalModel, value: number, timestamp: number): AnomalyDetectionResult {
    const date = new Date(timestamp);
    const hour = date.getHours();
    const dayOfWeek = date.getDay();
    
    // Get expected value based on seasonal patterns
    const hourlyFactor = model.hourlyPatterns[hour] || 1;
    const dailyFactor = model.dailyPatterns[dayOfWeek] || 1;
    
    const expectedValue = model.trend * hourlyFactor * dailyFactor;
    const deviation = Math.abs(value - expectedValue);
    const relativeDeviation = deviation / Math.max(expectedValue, 1);
    
    const isAnomaly = relativeDeviation > 0.3; // 30% deviation threshold
    const score = relativeDeviation * 10; // Scale for compatibility
    
    return {
      isAnomaly,
      score,
      confidence: Math.min(relativeDeviation * 2, 1.0),
      explanation: isAnomaly 
        ? `Value ${value} deviates ${(relativeDeviation * 100).toFixed(1)}% from expected ${expectedValue.toFixed(2)}`
        : "Value matches seasonal pattern",
      features: {
        expectedValue,
        deviation,
        relativeDeviation,
        hourlyFactor,
        dailyFactor
      }
    };
  }

  // ==========================================
  // MODEL MANAGEMENT
  // ==========================================

  async createModel(metricName: string, modelType: "statistical" | "isolation_forest" | "seasonal"): Promise<SelectAnomalyModel> {
    const modelId = `model_${metricName}_${Date.now()}`;
    
    const modelData: InsertAnomalyModel = {
      id: modelId,
      metricName,
      modelType,
      parameters: JSON.stringify(this.getDefaultParameters(modelType)),
      trainingDataFrom: Date.now(),
      trainingDataTo: Date.now(),
      sampleCount: 0,
      modelData: this.serializeModel(this.createEmptyModel(modelType)),
      features: JSON.stringify([]),
      isActive: true,
      lastTrainedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.db.insert(anomalyModels).values(modelData);
    
    const newModel = await this.db
      .select()
      .from(anomalyModels)
      .where(eq(anomalyModels.id, modelId))
      .limit(1);

    this.models.set(metricName, newModel[0]);
    console.log(`Created new ${modelType} model for metric: ${metricName}`);
    
    return newModel[0];
  }

  async trainModel(metricName: string, trainingData: TrainingDataPoint[]): Promise<void> {
    try {
      const model = await this.getModel(metricName);
      if (!model) {
        throw new Error(`Model not found for metric: ${metricName}`);
      }

      console.log(`Training model for ${metricName} with ${trainingData.length} data points`);

      const trainedModel = await this.performTraining(model, trainingData);
      const performance = await this.evaluateModel(trainedModel, trainingData);

      // Update model in database
      await this.db
        .update(anomalyModels)
        .set({
          modelData: this.serializeModel(trainedModel),
          trainingDataFrom: Math.min(...trainingData.map(d => d.timestamp)),
          trainingDataTo: Math.max(...trainingData.map(d => d.timestamp)),
          sampleCount: trainingData.length,
          accuracy: performance.accuracy,
          precision: performance.precision,
          recall: performance.recall,
          f1Score: performance.f1Score,
          falsePositiveRate: performance.falsePositiveRate,
          lastTrainedAt: Date.now(),
          updatedAt: Date.now(),
        })
        .where(eq(anomalyModels.id, model.id));

      // Update in-memory cache
      const updatedModel = await this.db
        .select()
        .from(anomalyModels)
        .where(eq(anomalyModels.id, model.id))
        .limit(1);

      this.models.set(metricName, updatedModel[0]);
      
      console.log(`Model training completed for ${metricName}. Performance: ${performance.f1Score.toFixed(3)} F1-score`);
    } catch (error) {
      console.error(`Error training model for ${metricName}:`, error);
    }
  }

  private async performTraining(model: SelectAnomalyModel, trainingData: TrainingDataPoint[]): Promise<any> {
    const values = trainingData.map(d => d.value);
    
    switch (model.modelType) {
      case "statistical":
        return this.trainStatisticalModel(values);
      case "isolation_forest":
        return this.trainIsolationForest(trainingData);
      case "seasonal":
        return this.trainSeasonalModel(trainingData);
      default:
        throw new Error(`Unknown model type: ${model.modelType}`);
    }
  }

  private trainStatisticalModel(values: number[]): StatisticalModel {
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    const medianIndex = Math.floor(sorted.length * 0.5);
    
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const median = sorted[medianIndex];
    const iqr = q3 - q1;

    return {
      mean,
      stdDev,
      median,
      q1,
      q3,
      iqr,
      sampleCount: values.length,
      lastUpdated: Date.now(),
    };
  }

  private trainIsolationForest(trainingData: TrainingDataPoint[]): IsolationForestModel {
    const numTrees = 100;
    const sampleSize = Math.min(256, trainingData.length);
    const featureNames = ["value", "hour", "dayOfWeek"];
    
    const trees: IsolationTree[] = [];
    
    for (let i = 0; i < numTrees; i++) {
      const sample = this.randomSample(trainingData, sampleSize);
      const featureVectors = sample.map(d => this.buildFeatureVector(d.value, d.features, featureNames));
      const tree = this.buildIsolationTree(featureVectors, featureNames, 0, Math.ceil(Math.log2(sampleSize)));
      trees.push(tree);
    }

    return {
      trees,
      sampleSize,
      featureNames,
      lastUpdated: Date.now(),
    };
  }

  private trainSeasonalModel(trainingData: TrainingDataPoint[]): SeasonalModel {
    // Group data by hour and day of week
    const hourlyGroups: number[][] = Array.from({ length: 24 }, () => []);
    const dailyGroups: number[][] = Array.from({ length: 7 }, () => []);
    
    for (const point of trainingData) {
      const date = new Date(point.timestamp);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      
      hourlyGroups[hour].push(point.value);
      dailyGroups[dayOfWeek].push(point.value);
    }

    // Calculate average for each hour and day
    const hourlyPatterns = hourlyGroups.map(group => 
      group.length > 0 ? group.reduce((sum, val) => sum + val, 0) / group.length : 1
    );
    
    const dailyPatterns = dailyGroups.map(group => 
      group.length > 0 ? group.reduce((sum, val) => sum + val, 0) / group.length : 1
    );

    // Calculate overall trend
    const values = trainingData.map(d => d.value);
    const trend = values.reduce((sum, val) => sum + val, 0) / values.length;

    return {
      hourlyPatterns,
      dailyPatterns,
      weeklyPatterns: dailyPatterns, // Simplified
      seasonalFactors: [1], // Simplified
      trend,
      lastUpdated: Date.now(),
    };
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  private async getModel(metricName: string): Promise<SelectAnomalyModel | null> {
    // Check in-memory cache first
    if (this.models.has(metricName)) {
      return this.models.get(metricName);
    }

    // Load from database
    const models = await this.db
      .select()
      .from(anomalyModels)
      .where(
        and(
          eq(anomalyModels.metricName, metricName),
          eq(anomalyModels.isActive, true)
        )
      )
      .orderBy(desc(anomalyModels.lastTrainedAt))
      .limit(1);

    if (models.length > 0) {
      this.models.set(metricName, models[0]);
      return models[0];
    }

    return null;
  }

  private addToTrainingQueue(metricName: string, dataPoint: TrainingDataPoint): void {
    if (!this.trainingQueue.has(metricName)) {
      this.trainingQueue.set(metricName, []);
    }

    const queue = this.trainingQueue.get(metricName)!;
    queue.push(dataPoint);

    // Keep only recent data points
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    this.trainingQueue.set(metricName, queue.filter(d => d.timestamp > cutoff));
  }

  private shouldRetrainModel(metricName: string): boolean {
    const queue = this.trainingQueue.get(metricName);
    return queue ? queue.length >= this.retrainingThreshold : false;
  }

  private scheduleModelRetrain(metricName: string): void {
    const queue = this.trainingQueue.get(metricName);
    if (queue && queue.length > 0) {
      // Schedule training in the background
      setTimeout(() => {
        this.trainModel(metricName, [...queue]);
        this.trainingQueue.set(metricName, []); // Clear queue after training
      }, 1000);
    }
  }

  private buildFeatureVector(value: number, features?: Record<string, number>, featureNames?: string[]): number[] {
    const now = new Date();
    const baseFeatures = {
      value,
      hour: now.getHours(),
      dayOfWeek: now.getDay(),
      ...features
    };

    if (featureNames) {
      return featureNames.map(name => baseFeatures[name] || 0);
    }

    return Object.values(baseFeatures);
  }

  private calculatePathLength(tree: IsolationTree, dataPoint: number[], depth: number): number {
    if (tree.isLeaf || depth > 20) {
      return depth + this.calculateExpectedPathLength(tree.size);
    }

    const featureIndex = tree.splitFeature ? parseInt(tree.splitFeature) : 0;
    if (dataPoint[featureIndex] < (tree.splitValue || 0)) {
      return this.calculatePathLength(tree.left!, dataPoint, depth + 1);
    } else {
      return this.calculatePathLength(tree.right!, dataPoint, depth + 1);
    }
  }

  private calculateExpectedPathLength(n: number): number {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
  }

  private buildIsolationTree(
    data: number[][],
    featureNames: string[],
    depth: number,
    maxDepth: number
  ): IsolationTree {
    if (data.length <= 1 || depth >= maxDepth) {
      return {
        isLeaf: true,
        depth,
        size: data.length,
      };
    }

    // Random feature selection
    const featureIndex = Math.floor(Math.random() * featureNames.length);
    const featureValues = data.map(point => point[featureIndex]);
    const minVal = Math.min(...featureValues);
    const maxVal = Math.max(...featureValues);
    
    if (minVal === maxVal) {
      return {
        isLeaf: true,
        depth,
        size: data.length,
      };
    }

    // Random split value
    const splitValue = minVal + Math.random() * (maxVal - minVal);
    
    const leftData = data.filter(point => point[featureIndex] < splitValue);
    const rightData = data.filter(point => point[featureIndex] >= splitValue);

    return {
      splitFeature: featureIndex.toString(),
      splitValue,
      left: this.buildIsolationTree(leftData, featureNames, depth + 1, maxDepth),
      right: this.buildIsolationTree(rightData, featureNames, depth + 1, maxDepth),
      isLeaf: false,
      depth,
      size: data.length,
    };
  }

  private randomSample<T>(array: T[], size: number): T[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, size);
  }

  private async evaluateModel(trainedModel: any, testData: TrainingDataPoint[]): Promise<ModelPerformanceMetrics> {
    // Simplified evaluation - in production you'd use proper train/test splits
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;

    for (const point of testData) {
      // This is a simplified evaluation - in reality you'd need labeled anomaly data
      const result = await this.detectAnomalyWithModel(
        { modelType: "statistical", modelData: this.serializeModel(trainedModel) } as SelectAnomalyModel,
        point.value,
        point.features
      );

      // For demonstration, consider values beyond 3 standard deviations as true anomalies
      const isActualAnomaly = Math.abs(point.value - trainedModel.mean) / trainedModel.stdDev > 3;
      
      if (result.isAnomaly && isActualAnomaly) truePositives++;
      else if (result.isAnomaly && !isActualAnomaly) falsePositives++;
      else if (!result.isAnomaly && !isActualAnomaly) trueNegatives++;
      else falseNegatives++;
    }

    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;
    const accuracy = (truePositives + trueNegatives) / testData.length || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
    const falsePositiveRate = falsePositives / (falsePositives + trueNegatives) || 0;

    return {
      accuracy,
      precision,
      recall,
      f1Score,
      falsePositiveRate,
    };
  }

  private getDefaultParameters(modelType: string): Record<string, unknown> {
    switch (modelType) {
      case "statistical":
        return { threshold: 2.5, useIQR: true };
      case "isolation_forest":
        return { numTrees: 100, sampleSize: 256, maxDepth: 8 };
      case "seasonal":
        return { seasonality: "daily", trendWeight: 0.1 };
      default:
        return {};
    }
  }

  private createEmptyModel(modelType: string): any {
    switch (modelType) {
      case "statistical":
        return { mean: 0, stdDev: 1, median: 0, q1: 0, q3: 0, iqr: 0, sampleCount: 0, lastUpdated: Date.now() };
      case "isolation_forest":
        return { trees: [], sampleSize: 256, featureNames: [], lastUpdated: Date.now() };
      case "seasonal":
        return { hourlyPatterns: [], dailyPatterns: [], weeklyPatterns: [], seasonalFactors: [], trend: 0, lastUpdated: Date.now() };
      default:
        return {};
    }
  }

  private serializeModel(model: any): Buffer {
    return Buffer.from(JSON.stringify(model));
  }

  private deserializeModel(modelData: Buffer | null): any {
    if (!modelData) return null;
    return JSON.parse(modelData.toString());
  }

  private async loadModelsFromDatabase(): Promise<void> {
    const models = await this.db
      .select()
      .from(anomalyModels)
      .where(eq(anomalyModels.isActive, true));

    for (const model of models) {
      this.models.set(model.metricName, model);
    }
  }

  private startModelMaintenance(): void {
    // Run model maintenance every hour
    setInterval(() => {
      this.performModelMaintenance();
    }, 3600000);
  }

  private async performModelMaintenance(): Promise<void> {
    console.log("Performing model maintenance...");
    
    const now = Date.now();
    
    for (const [metricName, model] of this.models.entries()) {
      // Check if model needs retraining due to age
      if (now - model.lastTrainedAt > this.maxModelAge) {
        console.log(`Model for ${metricName} is stale, scheduling retrain`);
        this.scheduleModelRetrain(metricName);
      }
    }
  }

  // ==========================================
  // PUBLIC API METHODS
  // ==========================================

  async getModelStatistics(metricName: string) {
    const model = await this.getModel(metricName);
    if (!model) {
      return null;
    }

    const queueSize = this.trainingQueue.get(metricName)?.length || 0;
    
    return {
      modelId: model.id,
      modelType: model.modelType,
      sampleCount: model.sampleCount,
      lastTrained: new Date(model.lastTrainedAt).toISOString(),
      performance: {
        accuracy: model.accuracy,
        precision: model.precision,
        recall: model.recall,
        f1Score: model.f1Score,
        falsePositiveRate: model.falsePositiveRate,
      },
      queuedSamples: queueSize,
      isActive: model.isActive,
    };
  }

  async getAllModelStatistics() {
    const allModels = await this.db
      .select()
      .from(anomalyModels)
      .where(eq(anomalyModels.isActive, true));

    return allModels.map(model => ({
      metricName: model.metricName,
      modelType: model.modelType,
      sampleCount: model.sampleCount,
      lastTrained: new Date(model.lastTrainedAt).toISOString(),
      performance: {
        accuracy: model.accuracy,
        precision: model.precision,
        recall: model.recall,
        f1Score: model.f1Score,
        falsePositiveRate: model.falsePositiveRate,
      },
      queuedSamples: this.trainingQueue.get(model.metricName)?.length || 0,
    }));
  }

  getHealthStatus() {
    return {
      modelsLoaded: this.models.size,
      trainingQueues: this.trainingQueue.size,
      totalQueuedSamples: Array.from(this.trainingQueue.values()).reduce((sum, queue) => sum + queue.length, 0),
    };
  }
}

export default AnomalyDetectionService;