/**
 * Workflow Validation Service
 *
 * Handles input validation for multi-phase strategy workflows
 */

import type {
  MultiPhaseStrategyCreateEvent,
  MultiPhaseStrategyExecuteEvent,
  StrategyAnalysisResult,
  StrategyRecommendationResult,
  ValidationResult,
} from "../types/multi-phase-strategy-types";

export class WorkflowValidationService {
  validateCreationInputs(
    data: MultiPhaseStrategyCreateEvent["data"]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field validation
    if (!data.userId || typeof data.userId !== "string") {
      errors.push("userId is required and must be a string");
    }

    if (!data.symbol || typeof data.symbol !== "string") {
      errors.push("symbol is required and must be a string");
    }

    if (!data.riskTolerance || typeof data.riskTolerance !== "string") {
      errors.push("riskTolerance is required and must be a string");
    }

    if (!data.timeframe || typeof data.timeframe !== "string") {
      errors.push("timeframe is required and must be a string");
    }

    if (!data.workflowId || typeof data.workflowId !== "string") {
      errors.push("workflowId is required and must be a string");
    }

    // Type and value validation
    if (typeof data.capital !== "number" || data.capital <= 0) {
      errors.push("capital must be a positive number");
    }

    if (
      data.entryPrice !== undefined &&
      (typeof data.entryPrice !== "number" || data.entryPrice <= 0)
    ) {
      errors.push("entryPrice must be a positive number when provided");
    }

    if (!data.marketData || typeof data.marketData !== "object") {
      errors.push("marketData is required and must be an object");
    }

    // Business rule validation
    if (
      data.riskTolerance &&
      !["low", "medium", "high"].includes(data.riskTolerance)
    ) {
      errors.push("riskTolerance must be one of: low, medium, high");
    }

    if (
      data.timeframe &&
      !["short", "medium", "long"].includes(data.timeframe)
    ) {
      warnings.push(
        "timeframe should typically be one of: short, medium, long"
      );
    }

    if (data.capital > 1000000) {
      warnings.push(
        "Large capital amount detected - ensure proper risk management"
      );
    }

    if (data.entryPrice && data.entryPrice > 100000) {
      warnings.push(
        "High entry price detected - verify symbol and price accuracy"
      );
    }

    // Symbol format validation
    if (data.symbol && !this.isValidSymbolFormat(data.symbol)) {
      warnings.push(
        "Symbol format may be invalid - ensure it follows exchange standards"
      );
    }

    // AI recommendation validation
    if (data.aiRecommendation && typeof data.aiRecommendation !== "string") {
      warnings.push("aiRecommendation should be a string when provided");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateExecutionInputs(
    data: MultiPhaseStrategyExecuteEvent["data"]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field validation
    if (!data.strategyId || typeof data.strategyId !== "string") {
      errors.push("strategyId is required and must be a string");
    }

    if (!data.userId || typeof data.userId !== "string") {
      errors.push("userId is required and must be a string");
    }

    if (!data.executionMode || typeof data.executionMode !== "string") {
      errors.push("executionMode is required and must be a string");
    }

    if (!data.workflowId || typeof data.workflowId !== "string") {
      errors.push("workflowId is required and must be a string");
    }

    // Business rule validation
    if (
      data.executionMode &&
      !["automatic", "manual", "test"].includes(data.executionMode)
    ) {
      errors.push("executionMode must be one of: automatic, manual, test");
    }

    // ID format validation
    if (data.strategyId && !this.isValidIdFormat(data.strategyId)) {
      errors.push("strategyId format is invalid");
    }

    if (data.userId && !this.isValidIdFormat(data.userId)) {
      errors.push("userId format is invalid");
    }

    if (data.workflowId && !this.isValidIdFormat(data.workflowId)) {
      errors.push("workflowId format is invalid");
    }

    // Phase overrides validation
    if (data.phaseOverrides !== undefined) {
      if (
        typeof data.phaseOverrides !== "object" ||
        data.phaseOverrides === null
      ) {
        errors.push("phaseOverrides must be an object when provided");
      } else {
        const overrideValidation = this.validatePhaseOverrides(
          data.phaseOverrides
        );
        errors.push(...overrideValidation.errors);
        warnings.push(...(overrideValidation.warnings || []));
      }
    }

    // Execution mode specific validation
    if (data.executionMode === "test") {
      warnings.push("Test mode execution - no real trades will be executed");
    }

    if (data.executionMode === "automatic") {
      warnings.push(
        "Automatic execution mode - ensure proper risk controls are in place"
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  isStrategyAnalysisResult(value: unknown): value is StrategyAnalysisResult {
    if (!value || typeof value !== "object") {
      return false;
    }

    const result = value as Record<string, unknown>;

    // Check required top-level properties
    const requiredProps = [
      "strategy",
      "analytics",
      "performanceMetrics",
      "currentPhases",
      "totalPhases",
      "efficiency",
    ];

    for (const prop of requiredProps) {
      if (!(prop in result)) {
        return false;
      }
    }

    // Validate strategy object
    if (!this.isValidStrategy(result.strategy)) {
      return false;
    }

    // Validate analytics object
    if (!result.analytics || typeof result.analytics !== "object") {
      return false;
    }

    // Validate performance metrics
    if (
      !result.performanceMetrics ||
      typeof result.performanceMetrics !== "object"
    ) {
      return false;
    }

    // Validate numeric fields
    if (
      typeof result.currentPhases !== "number" ||
      typeof result.totalPhases !== "number"
    ) {
      return false;
    }

    // Validate efficiency
    if (typeof result.efficiency !== "string") {
      return false;
    }

    return true;
  }

  isStrategyRecommendationResult(
    value: unknown
  ): value is StrategyRecommendationResult {
    if (!value || typeof value !== "object") {
      return false;
    }

    const result = value as Record<string, unknown>;

    // Check required top-level properties
    const requiredProps = [
      "recommendedStrategy",
      "riskAssessment",
      "alternativeStrategies",
      "executionGuidance",
      "reasoning",
    ];

    for (const prop of requiredProps) {
      if (!(prop in result)) {
        return false;
      }
    }

    // Validate recommended strategy
    if (!this.isValidRecommendedStrategy(result.recommendedStrategy)) {
      return false;
    }

    // Validate risk assessment
    if (!this.isValidRiskAssessment(result.riskAssessment)) {
      return false;
    }

    // Validate alternative strategies array
    if (!Array.isArray(result.alternativeStrategies)) {
      return false;
    }

    // Validate execution guidance
    if (!this.isValidExecutionGuidance(result.executionGuidance)) {
      return false;
    }

    // Validate reasoning
    if (typeof result.reasoning !== "string") {
      return false;
    }

    return true;
  }

  validateStrategyConfiguration(configuration: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!configuration || typeof configuration !== "object") {
      errors.push("Strategy configuration must be an object");
      return { isValid: false, errors, warnings };
    }

    const config = configuration as Record<string, unknown>;

    // Validate phases if present
    if (config.phases !== undefined) {
      if (!Array.isArray(config.phases)) {
        errors.push("phases must be an array");
      } else {
        const phaseValidation = this.validatePhases(config.phases);
        errors.push(...phaseValidation.errors);
        warnings.push(...(phaseValidation.warnings || []));
      }
    }

    // Validate risk level
    if (
      config.riskLevel &&
      !["low", "medium", "high"].includes(config.riskLevel as string)
    ) {
      errors.push("riskLevel must be one of: low, medium, high");
    }

    // Validate timeframe
    if (config.timeframe && typeof config.timeframe !== "string") {
      errors.push("timeframe must be a string");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateMarketData(marketData: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!marketData || typeof marketData !== "object") {
      errors.push("Market data must be an object");
      return { isValid: false, errors, warnings };
    }

    const data = marketData as Record<string, unknown>;

    // Check for common market data fields
    const recommendedFields = ["price", "volume", "timestamp", "symbol"];
    const missingFields = recommendedFields.filter((field) => !(field in data));

    if (missingFields.length > 0) {
      warnings.push(
        `Missing recommended market data fields: ${missingFields.join(", ")}`
      );
    }

    // Validate price if present
    if (
      data.price !== undefined &&
      (typeof data.price !== "number" || data.price <= 0)
    ) {
      errors.push("price must be a positive number when provided");
    }

    // Validate volume if present
    if (
      data.volume !== undefined &&
      (typeof data.volume !== "number" || data.volume < 0)
    ) {
      errors.push("volume must be a non-negative number when provided");
    }

    // Validate timestamp if present
    if (data.timestamp !== undefined) {
      const timestamp = new Date(data.timestamp as string);
      if (Number.isNaN(timestamp.getTime())) {
        errors.push("timestamp must be a valid date when provided");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validatePhaseOverrides(
    overrides: Record<string, unknown>
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const [key, value] of Object.entries(overrides)) {
      if (typeof value !== "object" || value === null) {
        errors.push(`Phase override for ${key} must be an object`);
        continue;
      }

      const override = value as Record<string, unknown>;

      // Validate common override fields
      if (
        override.allocation !== undefined &&
        (typeof override.allocation !== "number" ||
          override.allocation < 0 ||
          override.allocation > 1)
      ) {
        errors.push(
          `Phase override allocation for ${key} must be a number between 0 and 1`
        );
      }

      if (
        override.conditions !== undefined &&
        !Array.isArray(override.conditions)
      ) {
        errors.push(`Phase override conditions for ${key} must be an array`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validatePhases(phases: unknown[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];

      if (!phase || typeof phase !== "object") {
        errors.push(`Phase ${i} must be an object`);
        continue;
      }

      const phaseObj = phase as Record<string, unknown>;

      // Validate required phase fields
      if (!phaseObj.id || typeof phaseObj.id !== "string") {
        errors.push(`Phase ${i} must have a valid id`);
      }

      if (!phaseObj.name || typeof phaseObj.name !== "string") {
        errors.push(`Phase ${i} must have a valid name`);
      }

      if (
        typeof phaseObj.allocation !== "number" ||
        phaseObj.allocation < 0 ||
        phaseObj.allocation > 1
      ) {
        errors.push(`Phase ${i} allocation must be a number between 0 and 1`);
      }

      if (!Array.isArray(phaseObj.conditions)) {
        errors.push(`Phase ${i} conditions must be an array`);
      }

      if (!Array.isArray(phaseObj.actions)) {
        errors.push(`Phase ${i} actions must be an array`);
      }
    }

    // Validate total allocation
    const totalAllocation = phases.reduce((sum, phase) => {
      const phaseObj = phase as Record<string, unknown>;
      return (
        sum +
        (typeof phaseObj.allocation === "number" ? phaseObj.allocation : 0)
      );
    }, 0);

    if (Math.abs(totalAllocation - 1.0) > 0.01) {
      warnings.push(
        `Total phase allocation (${totalAllocation.toFixed(2)}) should equal 1.0`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private isValidSymbolFormat(symbol: string): boolean {
    // Basic symbol format validation - typically 3-10 characters, alphanumeric
    const symbolRegex = /^[A-Z0-9]{2,10}$/i;
    return symbolRegex.test(symbol);
  }

  private isValidIdFormat(id: string): boolean {
    // Basic ID format validation - non-empty string
    return id.length > 0 && id.length <= 50;
  }

  private isValidStrategy(strategy: unknown): boolean {
    if (!strategy || typeof strategy !== "object") {
      return false;
    }

    const strategyObj = strategy as Record<string, unknown>;

    // Check required strategy fields
    const requiredFields = [
      "name",
      "description",
      "phases",
      "riskLevel",
      "timeframe",
    ];

    for (const field of requiredFields) {
      if (!(field in strategyObj)) {
        return false;
      }
    }

    // Validate field types
    if (
      typeof strategyObj.name !== "string" ||
      typeof strategyObj.description !== "string"
    ) {
      return false;
    }

    if (!Array.isArray(strategyObj.phases)) {
      return false;
    }

    if (
      typeof strategyObj.riskLevel !== "string" ||
      typeof strategyObj.timeframe !== "string"
    ) {
      return false;
    }

    return true;
  }

  private isValidRecommendedStrategy(strategy: unknown): boolean {
    if (!strategy || typeof strategy !== "object") {
      return false;
    }

    const strategyObj = strategy as Record<string, unknown>;

    // Check required fields
    const requiredFields = ["name", "description", "levels"];

    for (const field of requiredFields) {
      if (!(field in strategyObj)) {
        return false;
      }
    }

    // Validate field types
    if (
      typeof strategyObj.name !== "string" ||
      typeof strategyObj.description !== "string"
    ) {
      return false;
    }

    if (!Array.isArray(strategyObj.levels)) {
      return false;
    }

    return true;
  }

  private isValidRiskAssessment(riskAssessment: unknown): boolean {
    if (!riskAssessment || typeof riskAssessment !== "object") {
      return false;
    }

    const assessment = riskAssessment as Record<string, unknown>;

    // Check required fields
    const requiredFields = ["riskLevel", "timeHorizon", "suitabilityScore"];

    for (const field of requiredFields) {
      if (!(field in assessment)) {
        return false;
      }
    }

    // Validate field types and values
    if (typeof assessment.riskLevel !== "string") {
      return false;
    }

    if (typeof assessment.timeHorizon !== "string") {
      return false;
    }

    if (
      typeof assessment.suitabilityScore !== "number" ||
      assessment.suitabilityScore < 0 ||
      assessment.suitabilityScore > 100
    ) {
      return false;
    }

    return true;
  }

  private isValidExecutionGuidance(guidance: unknown): boolean {
    if (!guidance || typeof guidance !== "object") {
      return false;
    }

    const guidanceObj = guidance as Record<string, unknown>;

    // Check required fields
    const requiredFields = [
      "optimalEntryConditions",
      "monitoringPoints",
      "riskManagement",
    ];

    for (const field of requiredFields) {
      if (!(field in guidanceObj)) {
        return false;
      }
    }

    // Validate that all fields are arrays
    for (const field of requiredFields) {
      if (!Array.isArray(guidanceObj[field])) {
        return false;
      }
    }

    return true;
  }
}
