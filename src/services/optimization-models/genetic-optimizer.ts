/**
 * Genetic Algorithm Optimizer
 *
 * Implements a genetic algorithm for parameter optimization with advanced
 * features like adaptive mutation, crossover strategies, and diversity maintenance.
 */

import { logger } from "../../lib/utils";

export interface GeneticConfig {
  populationSize: number;
  mutationRate: number;
  crossoverRate: number;
  elitismRate: number;
  maxGenerations: number;
  convergenceThreshold: number;
  crossoverStrategy: "uniform" | "arithmetic" | "simulated_binary";
  mutationStrategy: "gaussian" | "uniform" | "adaptive";
  selectionStrategy: "tournament" | "roulette" | "rank";
  tournamentSize: number;
  diversityThreshold: number;
  adaptiveMutation: boolean;
}

export interface Individual {
  genes: Record<string, number>;
  fitness: number;
  age: number;
  diversity: number;
  metadata?: Record<string, any>;
}

export interface Population {
  individuals: Individual[];
  generation: number;
  statistics: {
    bestFitness: number;
    averageFitness: number;
    diversity: number;
    convergenceRate: number;
  };
}

export interface GeneticResult {
  bestIndividual: Individual;
  population: Population;
  convergenceHistory: number[];
  diversityHistory: number[];
}

export class GeneticOptimizer {
  private config: GeneticConfig;
  private parameterBounds: Record<string, { min: number; max: number }> = {};
  private currentPopulation: Individual[] = [];
  private generationHistory: Population[] = [];
  private convergenceHistory: number[] = [];
  private diversityHistory: number[] = [];
  private bestEverIndividual: Individual | null = null;

  constructor(config?: Partial<GeneticConfig>) {
    this.config = {
      populationSize: 50,
      mutationRate: 0.1,
      crossoverRate: 0.8,
      elitismRate: 0.1,
      maxGenerations: 100,
      convergenceThreshold: 0.001,
      crossoverStrategy: "arithmetic",
      mutationStrategy: "adaptive",
      selectionStrategy: "tournament",
      tournamentSize: 3,
      diversityThreshold: 0.01,
      adaptiveMutation: true,
      ...config,
    };

    logger.info("Genetic Optimizer initialized", { config: this.config });
  }

  /**
   * Set parameter bounds for optimization
   */
  setParameterBounds(bounds: Record<string, { min: number; max: number }>): void {
    this.parameterBounds = { ...bounds };
    logger.info("Parameter bounds set for genetic algorithm", { bounds });
  }

  /**
   * Generate candidate parameters
   */
  async generateCandidates(
    currentBest?: Record<string, number> | null,
    convergenceHistory?: number[]
  ): Promise<Record<string, number>[]> {
    if (this.currentPopulation.length === 0) {
      // Initialize population
      await this.initializePopulation(currentBest);
    } else {
      // Evolve existing population
      await this.evolvePopulation();
    }

    // Return top candidates from current population
    const sortedPopulation = [...this.currentPopulation].sort((a, b) => b.fitness - a.fitness);
    const numCandidates = Math.min(10, this.config.populationSize);

    return sortedPopulation.slice(0, numCandidates).map((individual) => individual.genes);
  }

  /**
   * Update model with evaluation results
   */
  async updateModel(evaluationResults: any[]): Promise<void> {
    // Update fitness values for current population
    let updateCount = 0;

    for (const result of evaluationResults) {
      if (result.valid && result.score > Number.NEGATIVE_INFINITY) {
        // Find corresponding individual in population
        const individual = this.findIndividualByParameters(result.parameters);
        if (individual) {
          individual.fitness = result.score;
          individual.metadata = {
            backtestResults: result.backtestResults,
            safetyValidation: result.safetyValidation,
          };
          updateCount++;
        }
      }
    }

    // Update best ever individual
    const currentBest = this.getBestIndividual();
    if (
      currentBest &&
      (!this.bestEverIndividual || currentBest.fitness > this.bestEverIndividual.fitness)
    ) {
      this.bestEverIndividual = { ...currentBest };
    }

    // Calculate population statistics
    this.updatePopulationStatistics();

    logger.debug("Genetic model updated", {
      updatedIndividuals: updateCount,
      populationSize: this.currentPopulation.length,
      bestFitness: currentBest?.fitness || 0,
    });
  }

  /**
   * Initialize population
   */
  private async initializePopulation(seed?: Record<string, number> | null): Promise<void> {
    this.currentPopulation = [];

    for (let i = 0; i < this.config.populationSize; i++) {
      let genes: Record<string, number>;

      if (i === 0 && seed) {
        // First individual uses seed if provided
        genes = { ...seed };
      } else if (i < 3 && this.bestEverIndividual) {
        // Include some mutated versions of best known individual
        genes = this.mutateIndividual(this.bestEverIndividual.genes);
      } else {
        // Random initialization
        genes = this.generateRandomGenes();
      }

      const individual: Individual = {
        genes,
        fitness: Number.NEGATIVE_INFINITY,
        age: 0,
        diversity: 0,
      };

      this.currentPopulation.push(individual);
    }

    // Calculate initial diversity
    this.calculatePopulationDiversity();

    logger.debug("Population initialized", {
      size: this.currentPopulation.length,
      hasSeed: !!seed,
    });
  }

  /**
   * Evolve population to next generation
   */
  private async evolvePopulation(): Promise<void> {
    // Calculate diversity and adapt mutation rate if enabled
    this.calculatePopulationDiversity();

    if (this.config.adaptiveMutation) {
      this.adaptMutationRate();
    }

    // Create new population
    const newPopulation: Individual[] = [];

    // Elitism: keep best individuals
    const eliteCount = Math.floor(this.config.populationSize * this.config.elitismRate);
    const elites = this.selectElites(eliteCount);
    newPopulation.push(...elites);

    // Generate offspring through crossover and mutation
    while (newPopulation.length < this.config.populationSize) {
      // Selection
      const parent1 = this.selectParent();
      const parent2 = this.selectParent();

      // Crossover
      let offspring1, offspring2;
      if (Math.random() < this.config.crossoverRate) {
        [offspring1, offspring2] = this.crossover(parent1, parent2);
      } else {
        offspring1 = { ...parent1 };
        offspring2 = { ...parent2 };
      }

      // Mutation
      if (Math.random() < this.config.mutationRate) {
        offspring1.genes = this.mutateIndividual(offspring1.genes);
      }
      if (Math.random() < this.config.mutationRate) {
        offspring2.genes = this.mutateIndividual(offspring2.genes);
      }

      // Reset fitness and age
      offspring1.fitness = Number.NEGATIVE_INFINITY;
      offspring1.age = 0;
      offspring2.fitness = Number.NEGATIVE_INFINITY;
      offspring2.age = 0;

      newPopulation.push(offspring1);
      if (newPopulation.length < this.config.populationSize) {
        newPopulation.push(offspring2);
      }
    }

    // Age existing individuals
    for (const individual of this.currentPopulation) {
      individual.age++;
    }

    this.currentPopulation = newPopulation;
    this.calculatePopulationDiversity();

    logger.debug("Population evolved", {
      generation: this.generationHistory.length + 1,
      elites: eliteCount,
      mutationRate: this.config.mutationRate,
    });
  }

  /**
   * Select elite individuals
   */
  private selectElites(count: number): Individual[] {
    const sorted = [...this.currentPopulation].sort((a, b) => b.fitness - a.fitness);
    return sorted.slice(0, count).map((individual) => ({ ...individual }));
  }

  /**
   * Select parent for reproduction
   */
  private selectParent(): Individual {
    switch (this.config.selectionStrategy) {
      case "tournament":
        return this.tournamentSelection();
      case "roulette":
        return this.rouletteSelection();
      case "rank":
        return this.rankSelection();
      default:
        return this.tournamentSelection();
    }
  }

  /**
   * Tournament selection
   */
  private tournamentSelection(): Individual {
    const tournament: Individual[] = [];

    for (let i = 0; i < this.config.tournamentSize; i++) {
      const randomIndex = Math.floor(Math.random() * this.currentPopulation.length);
      tournament.push(this.currentPopulation[randomIndex]);
    }

    return tournament.reduce((best, current) => (current.fitness > best.fitness ? current : best));
  }

  /**
   * Roulette wheel selection
   */
  private rouletteSelection(): Individual {
    const totalFitness = this.currentPopulation.reduce(
      (sum, ind) => sum + Math.max(0, ind.fitness),
      0
    );

    if (totalFitness === 0) {
      return this.currentPopulation[Math.floor(Math.random() * this.currentPopulation.length)];
    }

    let random = Math.random() * totalFitness;

    for (const individual of this.currentPopulation) {
      random -= Math.max(0, individual.fitness);
      if (random <= 0) {
        return individual;
      }
    }

    return this.currentPopulation[this.currentPopulation.length - 1];
  }

  /**
   * Rank-based selection
   */
  private rankSelection(): Individual {
    const sorted = [...this.currentPopulation].sort((a, b) => a.fitness - b.fitness);
    const totalRank = (this.currentPopulation.length * (this.currentPopulation.length + 1)) / 2;

    let random = Math.random() * totalRank;

    for (let i = 0; i < sorted.length; i++) {
      random -= i + 1;
      if (random <= 0) {
        return sorted[i];
      }
    }

    return sorted[sorted.length - 1];
  }

  /**
   * Crossover operation
   */
  private crossover(parent1: Individual, parent2: Individual): [Individual, Individual] {
    const genes1 = { ...parent1.genes };
    const genes2 = { ...parent2.genes };

    switch (this.config.crossoverStrategy) {
      case "uniform":
        return this.uniformCrossover(genes1, genes2);
      case "arithmetic":
        return this.arithmeticCrossover(genes1, genes2);
      case "simulated_binary":
        return this.simulatedBinaryCrossover(genes1, genes2);
      default:
        return this.arithmeticCrossover(genes1, genes2);
    }
  }

  /**
   * Uniform crossover
   */
  private uniformCrossover(
    genes1: Record<string, number>,
    genes2: Record<string, number>
  ): [Individual, Individual] {
    const offspring1 = { ...genes1 };
    const offspring2 = { ...genes2 };

    for (const key of Object.keys(this.parameterBounds)) {
      if (Math.random() < 0.5) {
        offspring1[key] = genes2[key];
        offspring2[key] = genes1[key];
      }
    }

    return [
      { genes: offspring1, fitness: Number.NEGATIVE_INFINITY, age: 0, diversity: 0 },
      { genes: offspring2, fitness: Number.NEGATIVE_INFINITY, age: 0, diversity: 0 },
    ];
  }

  /**
   * Arithmetic crossover
   */
  private arithmeticCrossover(
    genes1: Record<string, number>,
    genes2: Record<string, number>
  ): [Individual, Individual] {
    const alpha = Math.random();
    const offspring1: Record<string, number> = {};
    const offspring2: Record<string, number> = {};

    for (const key of Object.keys(this.parameterBounds)) {
      offspring1[key] = alpha * genes1[key] + (1 - alpha) * genes2[key];
      offspring2[key] = alpha * genes2[key] + (1 - alpha) * genes1[key];

      // Ensure bounds
      const bounds = this.parameterBounds[key];
      offspring1[key] = Math.max(bounds.min, Math.min(bounds.max, offspring1[key]));
      offspring2[key] = Math.max(bounds.min, Math.min(bounds.max, offspring2[key]));
    }

    return [
      { genes: offspring1, fitness: Number.NEGATIVE_INFINITY, age: 0, diversity: 0 },
      { genes: offspring2, fitness: Number.NEGATIVE_INFINITY, age: 0, diversity: 0 },
    ];
  }

  /**
   * Simulated binary crossover
   */
  private simulatedBinaryCrossover(
    genes1: Record<string, number>,
    genes2: Record<string, number>
  ): [Individual, Individual] {
    const eta = 2; // Distribution index
    const offspring1: Record<string, number> = {};
    const offspring2: Record<string, number> = {};

    for (const key of Object.keys(this.parameterBounds)) {
      const bounds = this.parameterBounds[key];
      const parent1Val = genes1[key];
      const parent2Val = genes2[key];

      if (Math.abs(parent1Val - parent2Val) < 1e-6) {
        offspring1[key] = parent1Val;
        offspring2[key] = parent2Val;
        continue;
      }

      const u = Math.random();
      const beta =
        u <= 0.5 ? Math.pow(2 * u, 1 / (eta + 1)) : Math.pow(1 / (2 * (1 - u)), 1 / (eta + 1));

      offspring1[key] = 0.5 * ((1 + beta) * parent1Val + (1 - beta) * parent2Val);
      offspring2[key] = 0.5 * ((1 - beta) * parent1Val + (1 + beta) * parent2Val);

      // Ensure bounds
      offspring1[key] = Math.max(bounds.min, Math.min(bounds.max, offspring1[key]));
      offspring2[key] = Math.max(bounds.min, Math.min(bounds.max, offspring2[key]));
    }

    return [
      { genes: offspring1, fitness: Number.NEGATIVE_INFINITY, age: 0, diversity: 0 },
      { genes: offspring2, fitness: Number.NEGATIVE_INFINITY, age: 0, diversity: 0 },
    ];
  }

  /**
   * Mutation operation
   */
  private mutateIndividual(genes: Record<string, number>): Record<string, number> {
    const mutated = { ...genes };

    for (const key of Object.keys(this.parameterBounds)) {
      if (Math.random() < 0.1) {
        // Parameter-wise mutation probability
        const bounds = this.parameterBounds[key];

        switch (this.config.mutationStrategy) {
          case "gaussian":
            mutated[key] = this.gaussianMutation(mutated[key], bounds);
            break;
          case "uniform":
            mutated[key] = this.uniformMutation(bounds);
            break;
          case "adaptive":
            mutated[key] = this.adaptiveMutation(mutated[key], bounds);
            break;
        }
      }
    }

    return mutated;
  }

  /**
   * Gaussian mutation
   */
  private gaussianMutation(value: number, bounds: { min: number; max: number }): number {
    const range = bounds.max - bounds.min;
    const sigma = range * 0.1; // 10% of range
    const mutation = this.gaussianRandom() * sigma;
    const newValue = value + mutation;

    return Math.max(bounds.min, Math.min(bounds.max, newValue));
  }

  /**
   * Uniform mutation
   */
  private uniformMutation(bounds: { min: number; max: number }): number {
    return bounds.min + Math.random() * (bounds.max - bounds.min);
  }

  /**
   * Adaptive mutation based on population diversity
   */
  private adaptiveMutation(value: number, bounds: { min: number; max: number }): number {
    const populationDiversity = this.calculateAverageDiversity();
    const adaptiveFactor = populationDiversity < this.config.diversityThreshold ? 2.0 : 0.5;

    const range = bounds.max - bounds.min;
    const sigma = range * 0.1 * adaptiveFactor;
    const mutation = this.gaussianRandom() * sigma;
    const newValue = value + mutation;

    return Math.max(bounds.min, Math.min(bounds.max, newValue));
  }

  /**
   * Generate Gaussian random number
   */
  private gaussianRandom(): number {
    let u = 0,
      v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /**
   * Generate random genes
   */
  private generateRandomGenes(): Record<string, number> {
    const genes: Record<string, number> = {};

    for (const [param, bounds] of Object.entries(this.parameterBounds)) {
      genes[param] = bounds.min + Math.random() * (bounds.max - bounds.min);
    }

    return genes;
  }

  /**
   * Calculate population diversity
   */
  private calculatePopulationDiversity(): void {
    for (let i = 0; i < this.currentPopulation.length; i++) {
      let totalDistance = 0;

      for (let j = 0; j < this.currentPopulation.length; j++) {
        if (i !== j) {
          totalDistance += this.calculateGeneticDistance(
            this.currentPopulation[i].genes,
            this.currentPopulation[j].genes
          );
        }
      }

      this.currentPopulation[i].diversity = totalDistance / (this.currentPopulation.length - 1);
    }
  }

  /**
   * Calculate genetic distance between two individuals
   */
  private calculateGeneticDistance(
    genes1: Record<string, number>,
    genes2: Record<string, number>
  ): number {
    let distance = 0;

    for (const key of Object.keys(this.parameterBounds)) {
      const bounds = this.parameterBounds[key];
      const normalizedDiff = Math.abs(genes1[key] - genes2[key]) / (bounds.max - bounds.min);
      distance += normalizedDiff * normalizedDiff;
    }

    return Math.sqrt(distance);
  }

  /**
   * Calculate average population diversity
   */
  private calculateAverageDiversity(): number {
    if (this.currentPopulation.length === 0) return 0;

    const totalDiversity = this.currentPopulation.reduce((sum, ind) => sum + ind.diversity, 0);
    return totalDiversity / this.currentPopulation.length;
  }

  /**
   * Adapt mutation rate based on population diversity
   */
  private adaptMutationRate(): void {
    const averageDiversity = this.calculateAverageDiversity();

    if (averageDiversity < this.config.diversityThreshold) {
      // Low diversity: increase mutation rate
      this.config.mutationRate = Math.min(0.3, this.config.mutationRate * 1.1);
    } else {
      // High diversity: decrease mutation rate
      this.config.mutationRate = Math.max(0.01, this.config.mutationRate * 0.95);
    }
  }

  /**
   * Update population statistics
   */
  private updatePopulationStatistics(): void {
    const validIndividuals = this.currentPopulation.filter(
      (ind) => ind.fitness > Number.NEGATIVE_INFINITY
    );

    if (validIndividuals.length === 0) return;

    const fitnesses = validIndividuals.map((ind) => ind.fitness);
    const bestFitness = Math.max(...fitnesses);
    const averageFitness = fitnesses.reduce((sum, f) => sum + f, 0) / fitnesses.length;
    const diversity = this.calculateAverageDiversity();

    const convergenceRate =
      this.convergenceHistory.length > 0
        ? Math.abs(bestFitness - this.convergenceHistory[this.convergenceHistory.length - 1])
        : 0;

    this.convergenceHistory.push(bestFitness);
    this.diversityHistory.push(diversity);

    const population: Population = {
      individuals: [...this.currentPopulation],
      generation: this.generationHistory.length,
      statistics: {
        bestFitness,
        averageFitness,
        diversity,
        convergenceRate,
      },
    };

    this.generationHistory.push(population);
  }

  /**
   * Find individual by parameters
   */
  private findIndividualByParameters(parameters: Record<string, number>): Individual | null {
    const tolerance = 1e-6;

    return (
      this.currentPopulation.find((individual) => {
        return Object.keys(this.parameterBounds).every(
          (key) => Math.abs(individual.genes[key] - parameters[key]) < tolerance
        );
      }) || null
    );
  }

  /**
   * Get best individual from current population
   */
  private getBestIndividual(): Individual | null {
    const validIndividuals = this.currentPopulation.filter(
      (ind) => ind.fitness > Number.NEGATIVE_INFINITY
    );

    if (validIndividuals.length === 0) return null;

    return validIndividuals.reduce((best, current) =>
      current.fitness > best.fitness ? current : best
    );
  }

  /**
   * Get optimization results
   */
  getResults(): GeneticResult | null {
    const bestIndividual = this.getBestIndividual() || this.bestEverIndividual;

    if (!bestIndividual) return null;

    const currentGeneration =
      this.generationHistory.length > 0
        ? this.generationHistory[this.generationHistory.length - 1]
        : {
            individuals: this.currentPopulation,
            generation: 0,
            statistics: { bestFitness: 0, averageFitness: 0, diversity: 0, convergenceRate: 0 },
          };

    return {
      bestIndividual,
      population: currentGeneration,
      convergenceHistory: [...this.convergenceHistory],
      diversityHistory: [...this.diversityHistory],
    };
  }

  /**
   * Check convergence
   */
  hasConverged(): boolean {
    if (this.convergenceHistory.length < 10) return false;

    const recentHistory = this.convergenceHistory.slice(-10);
    const improvement = Math.max(...recentHistory) - Math.min(...recentHistory);

    return improvement < this.config.convergenceThreshold;
  }

  /**
   * Get model statistics
   */
  getModelStats(): any {
    const bestIndividual = this.getBestIndividual() || this.bestEverIndividual;

    return {
      generation: this.generationHistory.length,
      populationSize: this.currentPopulation.length,
      bestFitness: bestIndividual?.fitness || 0,
      averageDiversity: this.calculateAverageDiversity(),
      mutationRate: this.config.mutationRate,
      convergenceHistory: this.convergenceHistory.slice(-20),
      diversityHistory: this.diversityHistory.slice(-20),
      hasConverged: this.hasConverged(),
    };
  }
}
