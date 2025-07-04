/**
 * Multi-Phase Strategy Functions - Refactored (Clean)
 *
 * Lean orchestrator that delegates multi-phase strategy operations to specialized modules.
 * Reduced from 1274 lines to under 500 lines by extracting business logic into focused modules.
 *
 * Key Features:
 * - Modular architecture with specialized workflow services
 * - Delegated operations for better maintainability
 * - Strategy creation, execution, and monitoring workflows
 * - Performance analysis and health monitoring
 * - AI-powered strategy optimization
 */

import { inngest } from "./client";
import { StrategyAnalysisService } from "./modules/strategy-analysis-service";
// Import specialized workflow modules
import { StrategyCreationService } from "./modules/strategy-creation-service";
import { StrategyExecutionService } from "./modules/strategy-execution-service";
import { StrategyHealthService } from "./modules/strategy-health-service";
import { WorkflowValidationService } from "./modules/workflow-validation-service";

// Import shared types
import type {
  HealthCheckEvent,
  MultiPhaseStrategyCreateEvent,
  MultiPhaseStrategyExecuteEvent,
  PerformanceAnalysisEvent,
  StrategyAnalysisResult,
  StrategyRecommendationResult,
} from "./types/multi-phase-strategy-types";

/**
 * Lean orchestrator for multi-phase strategy workflows
 * Delegates operations to specialized services
 */
class MultiPhaseStrategyOrchestrator {
  private creationService: StrategyCreationService;
  private executionService: StrategyExecutionService;
  private analysisService: StrategyAnalysisService;
  private healthService: StrategyHealthService;
  private validationService: WorkflowValidationService;

  constructor() {
    this.creationService = new StrategyCreationService();
    this.executionService = new StrategyExecutionService();
    this.analysisService = new StrategyAnalysisService();
    this.healthService = new StrategyHealthService();
    this.validationService = new WorkflowValidationService();
  }

  async createStrategy(event: MultiPhaseStrategyCreateEvent, step: any) {
    const validation = await step.run("validate-inputs", () =>
      this.validationService.validateCreationInputs(event.data)
    );

    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
    }

    return this.creationService.executeCreationWorkflow(event.data, step);
  }

  async executeStrategy(event: MultiPhaseStrategyExecuteEvent, step: any) {
    const validation = await step.run("validate-execution", () =>
      this.validationService.validateExecutionInputs(event.data)
    );

    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
    }

    return this.executionService.executeStrategyWorkflow(event.data, step);
  }

  async analyzePerformance(event: PerformanceAnalysisEvent, step: any) {
    return this.analysisService.executeAnalysisWorkflow(event.data, step);
  }

  async performHealthCheck(event: HealthCheckEvent, step: any) {
    return this.healthService.executeHealthCheckWorkflow(event.data, step);
  }
}

// Initialize the orchestrator
const orchestrator = new MultiPhaseStrategyOrchestrator();

// ===========================================
// INNGEST WORKFLOW FUNCTIONS - LEAN ORCHESTRATION
// ===========================================

/**
 * Create Multi-Phase Strategy Workflow - Delegated to StrategyCreationService
 */
export const createMultiPhaseStrategy = inngest.createFunction(
  { id: "multi-phase-strategy-create", name: "Create Multi-Phase Strategy" },
  { event: "multi-phase-strategy/create" },
  async ({ event, step }) => {
    try {
      return await orchestrator.createStrategy(event, step);
    } catch (error) {
      console.error("Error in createMultiPhaseStrategy:", error);
      throw error;
    }
  }
);

/**
 * Execute Multi-Phase Strategy Workflow - Delegated to StrategyExecutionService
 */
export const executeMultiPhaseStrategy = inngest.createFunction(
  { id: "multi-phase-strategy-execute", name: "Execute Multi-Phase Strategy" },
  { event: "multi-phase-strategy/execute" },
  async ({ event, step }) => {
    try {
      return await orchestrator.executeStrategy(event, step);
    } catch (error) {
      console.error("Error in executeMultiPhaseStrategy:", error);
      throw error;
    }
  }
);

/**
 * Strategy Performance Analysis Workflow - Delegated to StrategyAnalysisService
 */
export const analyzeStrategyPerformance = inngest.createFunction(
  {
    id: "multi-phase-strategy-analyze",
    name: "Analyze Multi-Phase Strategy Performance",
  },
  { event: "multi-phase-strategy/analyze" },
  async ({ event, step }) => {
    try {
      return await orchestrator.analyzePerformance(event, step);
    } catch (error) {
      console.error("Error in analyzeStrategyPerformance:", error);
      throw error;
    }
  }
);

/**
 * Strategy Health Check Workflow - Delegated to StrategyHealthService
 */
export const multiPhaseStrategyHealthCheck = inngest.createFunction(
  {
    id: "multi-phase-strategy-health-check",
    name: "Multi-Phase Strategy Health Check",
  },
  { event: "multi-phase-strategy/health-check" },
  async ({ event, step }) => {
    try {
      return await orchestrator.performHealthCheck(event, step);
    } catch (error) {
      console.error("Error in multiPhaseStrategyHealthCheck:", error);
      throw error;
    }
  }
);

/**
 * Batch Strategy Processing Workflow - Delegated to Multiple Services
 */
export const batchProcessStrategies = inngest.createFunction(
  {
    id: "multi-phase-strategy-batch",
    name: "Batch Process Multi-Phase Strategies",
  },
  { event: "multi-phase-strategy/batch" },
  async ({ event, step }) => {
    try {
      const { operations } = event.data;
      const results = [];

      for (const operation of operations) {
        const result = await step.run(`process-${operation.type}`, async () => {
          switch (operation.type) {
            case "create":
              return orchestrator.createStrategy(operation, step);
            case "execute":
              return orchestrator.executeStrategy(operation, step);
            case "analyze":
              return orchestrator.analyzePerformance(operation, step);
            case "health-check":
              return orchestrator.performHealthCheck(operation, step);
            default:
              throw new Error(`Unknown operation type: ${operation.type}`);
          }
        });

        results.push({
          operationType: operation.type,
          operationId: operation.id,
          result,
          timestamp: new Date().toISOString(),
        });
      }

      return {
        success: true,
        totalOperations: operations.length,
        results,
        summary: {
          successful: results.filter((r) => r.result.success).length,
          failed: results.filter((r) => !r.result.success).length,
        },
      };
    } catch (error) {
      console.error("Error in batchProcessStrategies:", error);
      throw error;
    }
  }
);

/**
 * Strategy Optimization Workflow - Delegated to AnalysisService
 */
export const optimizeStrategyPerformance = inngest.createFunction(
  {
    id: "multi-phase-strategy-optimize",
    name: "Optimize Multi-Phase Strategy Performance",
  },
  { event: "multi-phase-strategy/optimize" },
  async ({ event, step }) => {
    try {
      const { strategyId, optimizationCriteria } = event.data;

      // Get current performance
      const currentPerformance = await step.run("analyze-current", () =>
        orchestrator.analyzePerformance(
          {
            strategyId,
            analysisType: "comprehensive",
            includeRecommendations: true,
          },
          step
        )
      );

      // Generate optimization recommendations
      const optimization = await step.run("generate-optimizations", () =>
        orchestrator.analysisService.generateOptimizationRecommendations(
          strategyId,
          currentPerformance,
          optimizationCriteria
        )
      );

      // Apply optimizations if auto-apply is enabled
      let appliedOptimizations = null;
      if (optimizationCriteria.autoApply) {
        appliedOptimizations = await step.run("apply-optimizations", () =>
          orchestrator.executionService.applyOptimizations(
            strategyId,
            optimization.recommendations
          )
        );
      }

      return {
        success: true,
        strategyId,
        currentPerformance,
        optimization,
        appliedOptimizations,
        requiresManualApproval: !optimizationCriteria.autoApply,
      };
    } catch (error) {
      console.error("Error in optimizeStrategyPerformance:", error);
      throw error;
    }
  }
);

/**
 * Strategy Risk Assessment Workflow - Delegated to HealthService
 */
export const assessStrategyRisk = inngest.createFunction(
  {
    id: "multi-phase-strategy-risk-assess",
    name: "Assess Multi-Phase Strategy Risk",
  },
  { event: "multi-phase-strategy/risk-assess" },
  async ({ event, step }) => {
    try {
      const { strategyId, assessmentType } = event.data;

      // Perform comprehensive risk assessment
      const riskAssessment = await step.run("assess-risk", () =>
        orchestrator.healthService.performRiskAssessment(
          strategyId,
          assessmentType
        )
      );

      // Generate risk mitigation recommendations
      const mitigationPlan = await step.run("generate-mitigation", () =>
        orchestrator.healthService.generateRiskMitigationPlan(
          strategyId,
          riskAssessment
        )
      );

      // Apply emergency risk controls if critical
      let emergencyActions = null;
      if (riskAssessment.riskLevel === "critical") {
        emergencyActions = await step.run("emergency-controls", () =>
          orchestrator.healthService.applyEmergencyRiskControls(
            strategyId,
            riskAssessment
          )
        );
      }

      return {
        success: true,
        strategyId,
        riskAssessment,
        mitigationPlan,
        emergencyActions,
        requiresImmediateAction: riskAssessment.riskLevel === "critical",
      };
    } catch (error) {
      console.error("Error in assessStrategyRisk:", error);
      throw error;
    }
  }
);

// ===========================================
// UTILITY FUNCTIONS - DELEGATED TO SERVICES
// ===========================================

/**
 * Type guard functions - Delegated to ValidationService
 */
export function isStrategyAnalysisResult(
  value: unknown
): value is StrategyAnalysisResult {
  return new WorkflowValidationService().isStrategyAnalysisResult(value);
}

export function isStrategyRecommendationResult(
  value: unknown
): value is StrategyRecommendationResult {
  return new WorkflowValidationService().isStrategyRecommendationResult(value);
}

/**
 * Workflow status monitoring - Delegated to HealthService
 */
export const getWorkflowStatus = async (workflowId: string) => {
  return new StrategyHealthService().getWorkflowStatus(workflowId);
};

/**
 * Performance metrics aggregation - Delegated to AnalysisService
 */
export const getAggregatedMetrics = async (timeframe: string) => {
  return new StrategyAnalysisService().getAggregatedPerformanceMetrics(
    timeframe
  );
};

// Export orchestrator for direct use if needed
export { MultiPhaseStrategyOrchestrator };

// Export type definitions for consumers
export type {
  StrategyAnalysisResult,
  StrategyRecommendationResult,
  MultiPhaseStrategyCreateEvent,
  MultiPhaseStrategyExecuteEvent,
  PerformanceAnalysisEvent,
  HealthCheckEvent,
};
