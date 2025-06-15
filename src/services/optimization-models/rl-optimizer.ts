/**
 * Reinforcement Learning Optimizer
 * 
 * Implements a reinforcement learning approach for parameter optimization using
 * Q-learning with function approximation and exploration strategies.
 */

import { logger } from '../../lib/utils';

export interface RLConfig {
  learningRate: number;
  discountFactor: number;
  explorationRate: number;
  explorationDecay: number;
  minExplorationRate: number;
  batchSize: number;
  memorySize: number;
  networkUpdateFrequency: number;
  rewardShaping: boolean;
  doubleQLearning: boolean;
}

export interface Experience {
  state: number[];
  action: Record<string, number>;
  reward: number;
  nextState: number[];
  done: boolean;
  timestamp: Date;
}

export interface State {
  currentParameters: Record<string, number>;
  performanceHistory: number[];
  marketConditions: number[];
  timeFeatures: number[];
}

export interface ActionSpace {
  parameterName: string;
  actionType: 'increase' | 'decrease' | 'set';
  magnitude: number;
}

export class ReinforcementLearningOptimizer {
  private config: RLConfig;
  private parameterBounds: Record<string, { min: number; max: number }> = {};
  private experienceBuffer: Experience[] = [];
  private qNetwork: NeuralNetwork;
  private targetNetwork: NeuralNetwork;
  private currentState: State | null = null;
  private episodeRewards: number[] = [];
  private explorationSchedule: number[] = [];
  private stateNormalizers: Map<string, { mean: number; std: number }> = new Map();

  constructor(config?: Partial<RLConfig>) {
    this.config = {
      learningRate: 0.001,
      discountFactor: 0.95,
      explorationRate: 1.0,
      explorationDecay: 0.995,
      minExplorationRate: 0.1,
      batchSize: 32,
      memorySize: 10000,
      networkUpdateFrequency: 100,
      rewardShaping: true,
      doubleQLearning: true,
      ...config
    };

    this.initializeNetworks();
    logger.info('Reinforcement Learning Optimizer initialized', { config: this.config });
  }

  /**
   * Initialize neural networks
   */
  private initializeNetworks(): void {
    const stateSize = this.calculateStateSize();
    const actionSize = this.calculateActionSize();

    this.qNetwork = new NeuralNetwork([
      stateSize,
      128,
      256,
      128,
      actionSize
    ], this.config.learningRate);

    this.targetNetwork = new NeuralNetwork([
      stateSize,
      128,
      256,
      128,
      actionSize
    ], this.config.learningRate);

    // Initialize target network with same weights
    this.targetNetwork.copyWeights(this.qNetwork);
  }

  /**
   * Set parameter bounds for optimization
   */
  setParameterBounds(bounds: Record<string, { min: number; max: number }>): void {
    this.parameterBounds = { ...bounds };
    
    // Reinitialize networks if bounds change
    if (Object.keys(bounds).length > 0) {
      this.initializeNetworks();
    }
    
    logger.info('Parameter bounds set for RL optimizer', { bounds });
  }

  /**
   * Generate candidate parameters using RL policy
   */
  async generateCandidates(
    currentBest?: Record<string, number> | null,
    convergenceHistory?: number[]
  ): Promise<Record<string, number>[]> {
    if (!this.currentState) {
      this.currentState = this.createInitialState(currentBest);
    }

    const candidates: Record<string, number>[] = [];
    const numCandidates = 5; // Generate multiple candidates per step

    for (let i = 0; i < numCandidates; i++) {
      const action = this.selectAction(this.currentState);
      const newParameters = this.applyAction(this.currentState.currentParameters, action);
      candidates.push(newParameters);
    }

    // Add some random exploration candidates
    const explorationCandidates = this.generateExplorationCandidates(2);
    candidates.push(...explorationCandidates);

    logger.debug('RL candidates generated', { 
      count: candidates.length,
      explorationRate: this.config.explorationRate 
    });

    return candidates;
  }

  /**
   * Update model with evaluation results
   */
  async updateModel(evaluationResults: any[]): Promise<void> {
    if (!this.currentState) return;

    for (const result of evaluationResults) {
      if (result.valid && result.score > -Infinity) {
        // Create experience
        const reward = this.calculateReward(result.score, result.backtestResults);
        const nextState = this.createNextState(result.parameters, result.score);
        
        const experience: Experience = {
          state: this.stateToVector(this.currentState),
          action: result.parameters,
          reward,
          nextState: this.stateToVector(nextState),
          done: false,
          timestamp: new Date()
        };

        this.addExperience(experience);
        this.currentState = nextState;
      }
    }

    // Train the network
    if (this.experienceBuffer.length >= this.config.batchSize) {
      await this.trainNetwork();
    }

    // Update exploration rate
    this.updateExplorationRate();

    // Update target network periodically
    if (this.experienceBuffer.length % this.config.networkUpdateFrequency === 0) {
      this.targetNetwork.copyWeights(this.qNetwork);
    }

    logger.debug('RL model updated', { 
      experiences: this.experienceBuffer.length,
      explorationRate: this.config.explorationRate 
    });
  }

  /**
   * Create initial state
   */
  private createInitialState(currentBest?: Record<string, number> | null): State {
    const defaultParameters: Record<string, number> = {};
    
    for (const [param, bounds] of Object.entries(this.parameterBounds)) {
      defaultParameters[param] = currentBest?.[param] || (bounds.min + bounds.max) / 2;
    }

    return {
      currentParameters: defaultParameters,
      performanceHistory: [0],
      marketConditions: this.getCurrentMarketConditions(),
      timeFeatures: this.getTimeFeatures()
    };
  }

  /**
   * Create next state based on new parameters and performance
   */
  private createNextState(newParameters: Record<string, number>, performance: number): State {
    if (!this.currentState) {
      return this.createInitialState(newParameters);
    }

    const newPerformanceHistory = [...this.currentState.performanceHistory, performance];
    
    // Keep only recent history
    if (newPerformanceHistory.length > 20) {
      newPerformanceHistory.splice(0, newPerformanceHistory.length - 20);
    }

    return {
      currentParameters: newParameters,
      performanceHistory: newPerformanceHistory,
      marketConditions: this.getCurrentMarketConditions(),
      timeFeatures: this.getTimeFeatures()
    };
  }

  /**
   * Convert state to vector for neural network
   */
  private stateToVector(state: State): number[] {
    const vector: number[] = [];

    // Add normalized parameters
    for (const [param, value] of Object.entries(state.currentParameters)) {
      const bounds = this.parameterBounds[param];
      if (bounds) {
        const normalizedValue = (value - bounds.min) / (bounds.max - bounds.min);
        vector.push(normalizedValue);
      }
    }

    // Add performance history features
    vector.push(...this.extractPerformanceFeatures(state.performanceHistory));

    // Add market condition features
    vector.push(...state.marketConditions);

    // Add time features
    vector.push(...state.timeFeatures);

    return vector;
  }

  /**
   * Extract features from performance history
   */
  private extractPerformanceFeatures(history: number[]): number[] {
    if (history.length === 0) return [0, 0, 0, 0];

    const recent = history.slice(-5);
    const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const max = Math.max(...recent);
    const min = Math.min(...recent);
    const trend = recent.length > 1 ? recent[recent.length - 1] - recent[0] : 0;

    return [mean, max, min, trend];
  }

  /**
   * Get current market conditions (mock implementation)
   */
  private getCurrentMarketConditions(): number[] {
    // In a real implementation, this would fetch actual market data
    return [
      Math.random(), // Market volatility
      Math.random(), // Volume
      Math.random(), // Trend strength
      Math.random()  // Correlation index
    ];
  }

  /**
   * Get time-based features
   */
  private getTimeFeatures(): number[] {
    const now = new Date();
    const hour = now.getHours() / 24;
    const dayOfWeek = now.getDay() / 7;
    const dayOfMonth = now.getDate() / 31;
    
    return [hour, dayOfWeek, dayOfMonth];
  }

  /**
   * Select action using epsilon-greedy policy
   */
  private selectAction(state: State): Record<string, number> {
    if (Math.random() < this.config.explorationRate) {
      return this.selectRandomAction();
    } else {
      return this.selectGreedyAction(state);
    }
  }

  /**
   * Select random action for exploration
   */
  private selectRandomAction(): Record<string, number> {
    const action: Record<string, number> = {};
    
    for (const [param, bounds] of Object.entries(this.parameterBounds)) {
      action[param] = bounds.min + Math.random() * (bounds.max - bounds.min);
    }
    
    return action;
  }

  /**
   * Select greedy action using Q-network
   */
  private selectGreedyAction(state: State): Record<string, number> {
    const stateVector = this.stateToVector(state);
    const qValues = this.qNetwork.forward(stateVector);
    
    // Convert Q-values to parameter adjustments
    return this.qValuesToParameters(qValues, state.currentParameters);
  }

  /**
   * Convert Q-values to parameter values
   */
  private qValuesToParameters(qValues: number[], currentParams: Record<string, number>): Record<string, number> {
    const newParams: Record<string, number> = { ...currentParams };
    const paramNames = Object.keys(this.parameterBounds);
    
    // Each parameter gets multiple Q-values for different actions
    const actionsPerParam = Math.floor(qValues.length / paramNames.length);
    
    for (let i = 0; i < paramNames.length; i++) {
      const param = paramNames[i];
      const bounds = this.parameterBounds[param];
      
      // Get Q-values for this parameter
      const paramQValues = qValues.slice(i * actionsPerParam, (i + 1) * actionsPerParam);
      
      // Select best action
      const bestActionIndex = paramQValues.indexOf(Math.max(...paramQValues));
      
      // Convert action index to parameter adjustment
      const adjustment = (bestActionIndex / (actionsPerParam - 1) - 0.5) * 0.1; // ±10% adjustment
      const newValue = currentParams[param] * (1 + adjustment);
      
      newParams[param] = Math.max(bounds.min, Math.min(bounds.max, newValue));
    }
    
    return newParams;
  }

  /**
   * Apply action to current parameters
   */
  private applyAction(currentParams: Record<string, number>, action: Record<string, number>): Record<string, number> {
    const newParams: Record<string, number> = {};
    
    for (const [param, bounds] of Object.entries(this.parameterBounds)) {
      const currentValue = currentParams[param] || (bounds.min + bounds.max) / 2;
      const actionValue = action[param] || currentValue;
      
      newParams[param] = Math.max(bounds.min, Math.min(bounds.max, actionValue));
    }
    
    return newParams;
  }

  /**
   * Calculate reward for the agent
   */
  private calculateReward(performance: number, backtestResults?: any): number {
    let reward = performance;

    if (this.config.rewardShaping && backtestResults) {
      // Add shaped rewards based on additional criteria
      if (backtestResults.sharpeRatio > 1.0) {
        reward += 0.1; // Bonus for good risk-adjusted return
      }
      
      if (backtestResults.maxDrawdown < 0.1) {
        reward += 0.05; // Bonus for low drawdown
      }
      
      if (backtestResults.winRate > 0.6) {
        reward += 0.05; // Bonus for high win rate
      }
    }

    // Penalty for extreme parameter values
    if (this.currentState) {
      for (const [param, value] of Object.entries(this.currentState.currentParameters)) {
        const bounds = this.parameterBounds[param];
        if (bounds) {
          const normalizedValue = (value - bounds.min) / (bounds.max - bounds.min);
          if (normalizedValue < 0.1 || normalizedValue > 0.9) {
            reward -= 0.02; // Small penalty for extreme values
          }
        }
      }
    }

    return reward;
  }

  /**
   * Add experience to replay buffer
   */
  private addExperience(experience: Experience): void {
    this.experienceBuffer.push(experience);
    
    // Remove old experiences if buffer is full
    if (this.experienceBuffer.length > this.config.memorySize) {
      this.experienceBuffer.shift();
    }
  }

  /**
   * Train the neural network using experience replay
   */
  private async trainNetwork(): Promise<void> {
    if (this.experienceBuffer.length < this.config.batchSize) return;

    // Sample random batch
    const batch = this.sampleBatch(this.config.batchSize);
    
    const states = batch.map(exp => exp.state);
    const actions = batch.map(exp => exp.action);
    const rewards = batch.map(exp => exp.reward);
    const nextStates = batch.map(exp => exp.nextState);
    const dones = batch.map(exp => exp.done);

    // Calculate target Q-values
    const targets = await this.calculateTargets(rewards, nextStates, dones);

    // Update Q-network
    for (let i = 0; i < batch.length; i++) {
      const currentQ = this.qNetwork.forward(states[i]);
      const actionIndex = this.parametersToActionIndex(actions[i]);
      
      // Update Q-value for taken action
      currentQ[actionIndex] = targets[i];
      
      // Backward pass
      this.qNetwork.backward(states[i], currentQ);
    }
  }

  /**
   * Sample random batch from experience buffer
   */
  private sampleBatch(batchSize: number): Experience[] {
    const batch: Experience[] = [];
    
    for (let i = 0; i < batchSize; i++) {
      const randomIndex = Math.floor(Math.random() * this.experienceBuffer.length);
      batch.push(this.experienceBuffer[randomIndex]);
    }
    
    return batch;
  }

  /**
   * Calculate target Q-values
   */
  private async calculateTargets(
    rewards: number[],
    nextStates: number[][],
    dones: boolean[]
  ): Promise<number[]> {
    const targets: number[] = [];

    for (let i = 0; i < rewards.length; i++) {
      if (dones[i]) {
        targets.push(rewards[i]);
      } else {
        let nextQValue: number;

        if (this.config.doubleQLearning) {
          // Double Q-learning: use main network to select action, target network to evaluate
          const nextQValues = this.qNetwork.forward(nextStates[i]);
          const bestActionIndex = nextQValues.indexOf(Math.max(...nextQValues));
          const targetQValues = this.targetNetwork.forward(nextStates[i]);
          nextQValue = targetQValues[bestActionIndex];
        } else {
          // Standard Q-learning: use target network for both selection and evaluation
          const targetQValues = this.targetNetwork.forward(nextStates[i]);
          nextQValue = Math.max(...targetQValues);
        }

        targets.push(rewards[i] + this.config.discountFactor * nextQValue);
      }
    }

    return targets;
  }

  /**
   * Convert parameters to action index (simplified)
   */
  private parametersToActionIndex(parameters: Record<string, number>): number {
    // Simplified mapping: use hash of parameters
    const paramString = JSON.stringify(parameters);
    let hash = 0;
    for (let i = 0; i < paramString.length; i++) {
      hash = ((hash << 5) - hash + paramString.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash) % this.calculateActionSize();
  }

  /**
   * Update exploration rate
   */
  private updateExplorationRate(): void {
    this.config.explorationRate = Math.max(
      this.config.minExplorationRate,
      this.config.explorationRate * this.config.explorationDecay
    );
  }

  /**
   * Generate exploration candidates
   */
  private generateExplorationCandidates(count: number): Record<string, number>[] {
    const candidates: Record<string, number>[] = [];
    
    for (let i = 0; i < count; i++) {
      candidates.push(this.selectRandomAction());
    }
    
    return candidates;
  }

  /**
   * Calculate state size for neural network
   */
  private calculateStateSize(): number {
    const paramCount = Object.keys(this.parameterBounds).length;
    const performanceFeatures = 4; // mean, max, min, trend
    const marketFeatures = 4; // volatility, volume, trend, correlation
    const timeFeatures = 3; // hour, day of week, day of month
    
    return paramCount + performanceFeatures + marketFeatures + timeFeatures;
  }

  /**
   * Calculate action size for neural network
   */
  private calculateActionSize(): number {
    const paramCount = Object.keys(this.parameterBounds).length;
    const actionsPerParam = 5; // discrete actions per parameter
    return paramCount * actionsPerParam;
  }

  /**
   * Get model statistics
   */
  getModelStats(): any {
    return {
      experiences: this.experienceBuffer.length,
      explorationRate: this.config.explorationRate,
      episodeRewards: this.episodeRewards.slice(-50),
      averageReward: this.episodeRewards.length > 0 
        ? this.episodeRewards.reduce((sum, r) => sum + r, 0) / this.episodeRewards.length 
        : 0,
      networkUpdateCount: Math.floor(this.experienceBuffer.length / this.config.networkUpdateFrequency),
      currentState: this.currentState
    };
  }
}

/**
 * Simple Neural Network Implementation
 */
class NeuralNetwork {
  private layers: number[];
  private weights: number[][][];
  private biases: number[][];
  private learningRate: number;

  constructor(layers: number[], learningRate: number) {
    this.layers = layers;
    this.learningRate = learningRate;
    this.initializeWeights();
  }

  private initializeWeights(): void {
    this.weights = [];
    this.biases = [];

    for (let i = 0; i < this.layers.length - 1; i++) {
      const layerWeights: number[][] = [];
      const layerBiases: number[] = [];

      for (let j = 0; j < this.layers[i + 1]; j++) {
        const neuronWeights: number[] = [];
        for (let k = 0; k < this.layers[i]; k++) {
          neuronWeights.push((Math.random() - 0.5) * 2 / Math.sqrt(this.layers[i]));
        }
        layerWeights.push(neuronWeights);
        layerBiases.push(0);
      }

      this.weights.push(layerWeights);
      this.biases.push(layerBiases);
    }
  }

  forward(input: number[]): number[] {
    let activation = [...input];

    for (let i = 0; i < this.weights.length; i++) {
      const newActivation: number[] = [];

      for (let j = 0; j < this.weights[i].length; j++) {
        let sum = this.biases[i][j];
        for (let k = 0; k < activation.length; k++) {
          sum += activation[k] * this.weights[i][j][k];
        }
        newActivation.push(this.relu(sum));
      }

      activation = newActivation;
    }

    return activation;
  }

  backward(input: number[], targetOutput: number[]): void {
    // Simplified backpropagation (placeholder)
    // In a real implementation, this would calculate gradients and update weights
    const output = this.forward(input);
    const error = targetOutput.map((target, i) => target - output[i]);
    
    // Simple weight update (placeholder)
    for (let i = 0; i < this.weights.length; i++) {
      for (let j = 0; j < this.weights[i].length; j++) {
        for (let k = 0; k < this.weights[i][j].length; k++) {
          this.weights[i][j][k] += this.learningRate * error[j % error.length] * 0.01;
        }
      }
    }
  }

  copyWeights(sourceNetwork: NeuralNetwork): void {
    this.weights = sourceNetwork.weights.map(layer => 
      layer.map(neuron => [...neuron])
    );
    this.biases = sourceNetwork.biases.map(layer => [...layer]);
  }

  private relu(x: number): number {
    return Math.max(0, x);
  }
}