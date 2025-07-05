/**
 * EmergencyStop Domain Entity
 * Represents an emergency stop mechanism for trading operations with trigger conditions and actions
 */

import { z } from "zod";
import { AggregateRoot } from "../../base/aggregate-root";
import { DomainValidationError } from "../../errors/trading-errors";
import {
  type EmergencyStopCompleted,
  type EmergencyStopCreated,
  type EmergencyStopFailed,
  type EmergencyStopTriggered,
  SafetyEventFactory,
} from "../../events/safety-events";

// Emergency stop status enumeration
export enum EmergencyStopStatus {
  ARMED = "armed",
  TRIGGERED = "triggered",
  EXECUTING = "executing",
  COMPLETED = "completed",
  FAILED = "failed",
  PARTIAL_FAILURE = "partial_failure",
  INACTIVE = "inactive",
}

// Emergency stop action types
export type EmergencyActionType =
  | "close_all_positions"
  | "cancel_all_orders"
  | "reduce_positions"
  | "halt_trading"
  | "notify_admin"
  | "send_alert"
  | "pause_strategies"
  | "custom_action";

// Emergency stop trigger condition types
export type TriggerConditionType =
  | "drawdown_threshold"
  | "position_risk"
  | "consecutive_losses"
  | "daily_loss_threshold"
  | "monthly_loss_threshold"
  | "portfolio_exposure"
  | "market_volatility"
  | "system_failure"
  | "custom_condition";

export type TriggerPriority = "low" | "medium" | "high" | "critical";

export interface TriggerCondition {
  readonly type: TriggerConditionType;
  readonly threshold: number;
  readonly description: string;
  readonly priority: TriggerPriority;
}

export interface EmergencyAction {
  readonly type: EmergencyActionType;
  readonly priority: number;
  readonly description: string;
  readonly timeout: number;
  readonly retryCount: number;
  readonly canRunInParallel?: boolean;
  readonly dependsOn?: EmergencyActionType[];
}

export interface ActionResult {
  readonly actionType: EmergencyActionType;
  readonly success: boolean;
  readonly duration: number;
  readonly error?: string;
  readonly metadata?: Record<string, any>;
}

export interface TriggerEvaluationResult {
  readonly isTriggered: boolean;
  readonly actualValue: number;
  readonly threshold: number;
  readonly severity: TriggerPriority;
  readonly message?: string;
}

export interface TriggerConditionsEvaluation {
  readonly triggeredConditions: TriggerCondition[];
  readonly prioritizedConditions: TriggerCondition[];
  readonly isEmergencyTriggered: boolean;
  readonly highestSeverity: TriggerPriority;
}

export interface CoordinationPlan {
  readonly parallelGroups: EmergencyAction[][];
  readonly sequentialSteps: EmergencyAction[];
  readonly totalEstimatedTime: number;
  readonly criticalPath: EmergencyAction[];
}

export interface ExecutionSummary {
  readonly totalActions: number;
  readonly successfulActions: number;
  readonly failedActions: number;
  readonly totalExecutionTime: number;
  readonly averageActionTime: number;
  readonly overallSuccess: boolean;
  readonly criticalActionsFailed: boolean;
}

interface EmergencyStopProps {
  readonly id: string;
  readonly portfolioId: string;
  readonly userId: string;
  readonly triggerConditions: TriggerCondition[];
  readonly emergencyActions: EmergencyAction[];
  readonly status: EmergencyStopStatus;
  readonly isActive: boolean;
  readonly autoExecute: boolean;
  readonly lastTriggered?: Date;
  readonly triggerReason?: string;
  readonly triggerData?: Record<string, any>;
  readonly actionResults: ActionResult[];
  readonly totalExecutionTime: number;
  readonly failedActions: ActionResult[];
  readonly completedAt?: Date;
  readonly failureReason?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

// Validation schemas
const TriggerConditionSchema = z.object({
  type: z.enum([
    "drawdown_threshold",
    "position_risk",
    "consecutive_losses",
    "daily_loss_threshold",
    "monthly_loss_threshold",
    "portfolio_exposure",
    "market_volatility",
    "system_failure",
    "custom_condition",
  ]),
  threshold: z.number().finite(),
  description: z.string().min(1).max(200),
  priority: z.enum(["low", "medium", "high", "critical"]),
});

const EmergencyActionSchema = z.object({
  type: z.enum([
    "close_all_positions",
    "cancel_all_orders",
    "reduce_positions",
    "halt_trading",
    "notify_admin",
    "send_alert",
    "pause_strategies",
    "custom_action",
  ]),
  priority: z.number().int().min(1),
  description: z.string().min(1).max(200),
  timeout: z.number().int().min(1000), // Minimum 1 second
  retryCount: z.number().int().min(0).max(10),
  canRunInParallel: z.boolean().optional(),
  dependsOn: z.array(z.string()).optional(),
});

const EmergencyStopPropsSchema = z.object({
  id: z.string().min(1),
  portfolioId: z.string().min(1),
  userId: z.string().min(1),
  triggerConditions: z.array(TriggerConditionSchema).min(1),
  emergencyActions: z.array(EmergencyActionSchema).min(1),
  status: z.nativeEnum(EmergencyStopStatus),
  isActive: z.boolean(),
  autoExecute: z.boolean(),
  lastTriggered: z.date().optional(),
  triggerReason: z.string().optional(),
  triggerData: z.record(z.any()).optional(),
  actionResults: z.array(z.any()).default([]),
  totalExecutionTime: z.number().min(0).default(0),
  failedActions: z.array(z.any()).default([]),
  completedAt: z.date().optional(),
  failureReason: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().min(1),
});

export class EmergencyStop extends AggregateRoot<string> {
  private constructor(private props: EmergencyStopProps) {
    super(props.id);
  }

  static create(props: {
    portfolioId: string;
    userId: string;
    triggerConditions: TriggerCondition[];
    emergencyActions: EmergencyAction[];
    isActive?: boolean;
    autoExecute?: boolean;
  }): EmergencyStop {
    const id = `emergency_stop_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date();

    const emergencyStopProps: EmergencyStopProps = {
      id,
      portfolioId: props.portfolioId,
      userId: props.userId,
      triggerConditions: props.triggerConditions,
      emergencyActions: props.emergencyActions,
      status: EmergencyStopStatus.ARMED,
      isActive: props.isActive ?? true,
      autoExecute: props.autoExecute ?? true,
      actionResults: [],
      totalExecutionTime: 0,
      failedActions: [],
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    const emergencyStop =
      EmergencyStop.createWithValidation(emergencyStopProps);

    // Emit domain event
    emergencyStop.addDomainEvent(
      SafetyEventFactory.createEmergencyStopCreated(id, props.userId, {
        emergencyStopId: id,
        userId: props.userId,
        portfolioId: props.portfolioId,
        triggerConditions: props.triggerConditions,
        emergencyActions: props.emergencyActions,
        isActive: props.isActive ?? true,
        autoExecute: props.autoExecute ?? true,
      })
    );

    return emergencyStop;
  }

  static fromExisting(props: EmergencyStopProps): EmergencyStop {
    return EmergencyStop.createWithValidation(props);
  }

  private static createWithValidation(
    props: EmergencyStopProps
  ): EmergencyStop {
    // Validate props
    const validationResult = EmergencyStopPropsSchema.safeParse(props);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      throw new DomainValidationError(
        firstError.path.join("."),
        "invalid value",
        firstError.message
      );
    }

    // Business rule validations
    EmergencyStop.validateBusinessRules(props);

    return new EmergencyStop(props);
  }

  private static validateBusinessRules(props: EmergencyStopProps): void {
    // Validate trigger conditions are not empty
    if (props.triggerConditions.length === 0) {
      throw new DomainValidationError(
        "triggerConditions",
        props.triggerConditions,
        "Emergency stop must have at least one trigger condition"
      );
    }

    // Validate emergency actions are not empty
    if (props.emergencyActions.length === 0) {
      throw new DomainValidationError(
        "emergencyActions",
        props.emergencyActions,
        "Emergency stop must have at least one emergency action"
      );
    }

    // Validate threshold values are positive for applicable condition types
    for (const condition of props.triggerConditions) {
      if (
        ["drawdown_threshold", "position_risk", "portfolio_exposure"].includes(
          condition.type
        )
      ) {
        if (condition.threshold <= 0 || condition.threshold > 100) {
          throw new DomainValidationError(
            "triggerConditions.threshold",
            condition.threshold,
            `${condition.type} threshold must be between 0 and 100`
          );
        }
      }

      if (condition.type === "consecutive_losses") {
        if (
          condition.threshold <= 0 ||
          !Number.isInteger(condition.threshold)
        ) {
          throw new DomainValidationError(
            "triggerConditions.threshold",
            condition.threshold,
            "Consecutive losses threshold must be a positive integer"
          );
        }
      }
    }

    // Validate action priorities: duplicate priorities are only allowed for parallel-enabled actions
    const priorityGroups = new Map<number, EmergencyAction[]>();
    for (const action of props.emergencyActions) {
      if (!priorityGroups.has(action.priority)) {
        priorityGroups.set(action.priority, []);
      }
      priorityGroups.get(action.priority)!.push(action);
    }
    
    // Check each priority group
    for (const [priority, actions] of priorityGroups) {
      if (actions.length > 1) {
        // Multiple actions with same priority - all must support parallel execution
        const nonParallelActions = actions.filter(action => !action.canRunInParallel);
        if (nonParallelActions.length > 0) {
          throw new DomainValidationError(
            "emergencyActions.priority",
            priority,
            `Actions with priority ${priority} include non-parallel actions but multiple actions share the same priority. Either use unique priorities or enable parallel execution for all actions.`
          );
        }
      }
    }

    // Validate action timeouts
    for (const action of props.emergencyActions) {
      if (action.timeout <= 0) {
        throw new DomainValidationError(
          "emergencyActions.timeout",
          action.timeout,
          "Action timeout must be positive"
        );
      }
    }
  }

  // Getters
  get id(): string {
    return this.props.id;
  }

  get portfolioId(): string {
    return this.props.portfolioId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get triggerConditions(): readonly TriggerCondition[] {
    return this.props.triggerConditions;
  }

  get emergencyActions(): readonly EmergencyAction[] {
    return this.props.emergencyActions;
  }

  get status(): EmergencyStopStatus {
    return this.props.status;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get autoExecute(): boolean {
    return this.props.autoExecute;
  }

  get lastTriggered(): Date | undefined {
    return this.props.lastTriggered;
  }

  get triggerReason(): string | undefined {
    return this.props.triggerReason;
  }

  get triggerData(): Record<string, any> | undefined {
    return this.props.triggerData;
  }

  get actionResults(): readonly ActionResult[] {
    return this.props.actionResults;
  }

  get totalExecutionTime(): number {
    return this.props.totalExecutionTime;
  }

  get failedActions(): readonly ActionResult[] {
    return this.props.failedActions;
  }

  get completedAt(): Date | undefined {
    return this.props.completedAt;
  }

  get failureReason(): string | undefined {
    return this.props.failureReason;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get version(): number {
    return this.props.version;
  }

  // Business logic methods
  evaluateTriggerCondition(
    condition: TriggerCondition,
    marketData: Record<string, any>
  ): TriggerEvaluationResult {
    let actualValue: number;

    // Extract relevant value from market data based on condition type
    switch (condition.type) {
      case "drawdown_threshold":
        actualValue = marketData.currentDrawdown || 0;
        break;
      case "position_risk":
        actualValue = marketData.maxPositionRisk || 0;
        break;
      case "consecutive_losses":
        actualValue = marketData.consecutiveLosses || 0;
        break;
      case "daily_loss_threshold":
        actualValue = marketData.dailyLoss || 0;
        break;
      case "monthly_loss_threshold":
        actualValue = marketData.monthlyLoss || 0;
        break;
      case "portfolio_exposure":
        actualValue = marketData.portfolioExposure || 0;
        break;
      case "market_volatility":
        actualValue = marketData.volatility || 0;
        break;
      default:
        actualValue = marketData[condition.type] || 0;
    }

    const isTriggered = actualValue >= condition.threshold;

    return {
      isTriggered,
      actualValue,
      threshold: condition.threshold,
      severity: condition.priority,
      message: isTriggered
        ? `${condition.description}: ${actualValue} >= ${condition.threshold}`
        : `${condition.description}: ${actualValue} < ${condition.threshold}`,
    };
  }

  evaluateTriggerConditions(
    marketData: Record<string, any>
  ): TriggerConditionsEvaluation {
    const evaluationResults = this.triggerConditions.map((condition) =>
      this.evaluateTriggerCondition(condition, marketData)
    );

    const triggeredConditions = this.triggerConditions.filter(
      (_, index) => evaluationResults[index].isTriggered
    );

    const prioritizedConditions = [...triggeredConditions].sort((a, b) => {
      const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    const isEmergencyTriggered = triggeredConditions.length > 0;
    const highestSeverity =
      prioritizedConditions.length > 0
        ? prioritizedConditions[0].priority
        : "low";

    return {
      triggeredConditions,
      prioritizedConditions,
      isEmergencyTriggered,
      highestSeverity,
    };
  }

  trigger(
    reason: string,
    triggerData: Record<string, any> = {}
  ): EmergencyStop {
    if (!this.isActive) {
      throw new DomainValidationError(
        "status",
        this.status,
        "Cannot trigger inactive emergency stop"
      );
    }

    if (this.status === EmergencyStopStatus.TRIGGERED) {
      throw new DomainValidationError(
        "status",
        this.status,
        "Emergency stop is already triggered"
      );
    }

    const triggeredAt = new Date();
    const updatedStop = this.updateProps({
      status: EmergencyStopStatus.TRIGGERED,
      lastTriggered: triggeredAt,
      triggerReason: reason,
      triggerData,
      updatedAt: triggeredAt,
      version: this.props.version + 1,
    });

    // Emit domain event
    updatedStop.addDomainEvent(
      SafetyEventFactory.createEmergencyStopTriggered(
        this.props.id,
        this.props.userId,
        {
          emergencyStopId: this.props.id,
          userId: this.props.userId,
          portfolioId: this.props.portfolioId,
          reason,
          triggerData,
          triggeredAt,
          scheduledActions: this.props.emergencyActions.map((action) => ({
            actionType: action.type,
            priority: action.priority,
            timeout: action.timeout,
            retryCount: action.retryCount,
          })),
        }
      )
    );

    return updatedStop;
  }

  executeActions(actionResults: ActionResult[]): EmergencyStop {
    if (
      this.status !== EmergencyStopStatus.TRIGGERED &&
      this.status !== EmergencyStopStatus.EXECUTING
    ) {
      throw new DomainValidationError(
        "status",
        this.status,
        "Cannot execute actions on emergency stop that is not triggered"
      );
    }

    const totalExecutionTime = actionResults.reduce(
      (total, result) => total + result.duration,
      0
    );
    const failedActions = actionResults.filter((result) => !result.success);

    let newStatus: EmergencyStopStatus;
    if (failedActions.length === 0) {
      newStatus = EmergencyStopStatus.EXECUTING; // Will be completed in a separate call
    } else if (failedActions.length === actionResults.length) {
      newStatus = EmergencyStopStatus.FAILED;
    } else {
      newStatus = EmergencyStopStatus.PARTIAL_FAILURE;
    }

    return this.updateProps({
      status: newStatus,
      actionResults: [...this.props.actionResults, ...actionResults],
      totalExecutionTime: this.props.totalExecutionTime + totalExecutionTime,
      failedActions: [...this.props.failedActions, ...failedActions],
      updatedAt: new Date(),
      version: this.props.version + 1,
    });
  }

  markAsCompleted(): EmergencyStop {
    if (
      this.status !== EmergencyStopStatus.EXECUTING &&
      this.status !== EmergencyStopStatus.PARTIAL_FAILURE
    ) {
      throw new DomainValidationError(
        "status",
        this.status,
        "Can only mark executing or partially failed emergency stops as completed"
      );
    }

    const completedAt = new Date();
    const updatedStop = this.updateProps({
      status: EmergencyStopStatus.COMPLETED,
      completedAt,
      updatedAt: completedAt,
      version: this.props.version + 1,
    });

    // Emit domain event
    updatedStop.addDomainEvent(
      SafetyEventFactory.createEmergencyStopCompleted(
        this.props.id,
        this.props.userId,
        {
          emergencyStopId: this.props.id,
          userId: this.props.userId,
          portfolioId: this.props.portfolioId,
          triggeredAt: this.props.lastTriggered!,
          completedAt,
          executionSummary: this.generateExecutionSummary(),
          actionResults: this.props.actionResults,
        }
      )
    );

    return updatedStop;
  }

  markAsFailed(failureReason: string): EmergencyStop {
    if (
      this.status === EmergencyStopStatus.COMPLETED ||
      this.status === EmergencyStopStatus.FAILED
    ) {
      throw new DomainValidationError(
        "status",
        this.status,
        "Cannot mark completed or already failed emergency stop as failed"
      );
    }

    const failedAt = new Date();
    const updatedStop = this.updateProps({
      status: EmergencyStopStatus.FAILED,
      failureReason,
      completedAt: failedAt,
      updatedAt: failedAt,
      version: this.props.version + 1,
    });

    // Emit domain event
    updatedStop.addDomainEvent(
      SafetyEventFactory.createEmergencyStopFailed(
        this.props.id,
        this.props.userId,
        {
          emergencyStopId: this.props.id,
          userId: this.props.userId,
          portfolioId: this.props.portfolioId,
          triggeredAt: this.props.lastTriggered!,
          failedAt,
          failureReason,
          failedActions: this.props.failedActions.map((failed) => ({
            actionType: failed.actionType,
            error: failed.error || "Unknown error",
            attemptsCount: 1, // Default to 1 attempt
          })),
          partialResults: this.props.actionResults.filter(
            (result) => result.success
          ),
        }
      )
    );

    return updatedStop;
  }

  createCoordinationPlan(): CoordinationPlan {
    // Sort actions by priority
    const sortedActions = [...this.props.emergencyActions].sort(
      (a, b) => a.priority - b.priority
    );

    // Group parallel actions (same priority + can run in parallel)
    const parallelGroups: EmergencyAction[][] = [];
    const sequentialSteps: EmergencyAction[] = [];

    let currentGroup: EmergencyAction[] = [];
    let currentPriority = -1;

    for (const action of sortedActions) {
      if (action.priority !== currentPriority) {
        if (currentGroup.length > 0) {
          if (currentGroup.every((a) => a.canRunInParallel)) {
            parallelGroups.push(currentGroup);
          } else {
            sequentialSteps.push(...currentGroup);
          }
        }
        currentGroup = [action];
        currentPriority = action.priority;
      } else {
        currentGroup.push(action);
      }
    }

    // Handle the last group
    if (currentGroup.length > 0) {
      if (currentGroup.every((a) => a.canRunInParallel)) {
        parallelGroups.push(currentGroup);
      } else {
        sequentialSteps.push(...currentGroup);
      }
    }

    // Calculate estimated time
    const parallelTime = parallelGroups.reduce(
      (total, group) =>
        total + Math.max(...group.map((action) => action.timeout)),
      0
    );
    const sequentialTime = sequentialSteps.reduce(
      (total, action) => total + action.timeout,
      0
    );
    const totalEstimatedTime = parallelTime + sequentialTime;

    return {
      parallelGroups,
      sequentialSteps,
      totalEstimatedTime,
      criticalPath: sortedActions.filter((action) => action.priority <= 2), // High and critical priority
    };
  }

  generateExecutionSummary(): ExecutionSummary {
    const totalActions = this.props.actionResults.length;
    const successfulActions = this.props.actionResults.filter(
      (result) => result.success
    ).length;
    const failedActions = this.props.failedActions.length;
    const averageActionTime =
      totalActions > 0 ? this.props.totalExecutionTime / totalActions : 0;
    const overallSuccess = failedActions === 0 && totalActions > 0;
    const criticalActionsFailed = this.props.failedActions.some((failed) =>
      this.props.emergencyActions.find(
        (action) => action.type === failed.actionType && action.priority <= 2
      )
    );

    return {
      totalActions,
      successfulActions,
      failedActions,
      totalExecutionTime: this.props.totalExecutionTime,
      averageActionTime,
      overallSuccess,
      criticalActionsFailed,
    };
  }

  reset(): EmergencyStop {
    if (
      this.status !== EmergencyStopStatus.COMPLETED &&
      this.status !== EmergencyStopStatus.FAILED
    ) {
      throw new DomainValidationError(
        "status",
        this.status,
        "Can only reset completed or failed emergency stops"
      );
    }

    return this.updateProps({
      status: EmergencyStopStatus.ARMED,
      lastTriggered: undefined,
      triggerReason: undefined,
      triggerData: undefined,
      actionResults: [],
      totalExecutionTime: 0,
      failedActions: [],
      completedAt: undefined,
      failureReason: undefined,
      updatedAt: new Date(),
      version: this.props.version + 1,
    });
  }

  recover(_recoveryReason: string): EmergencyStop {
    if (this.status !== EmergencyStopStatus.FAILED) {
      throw new DomainValidationError(
        "status",
        this.status,
        "Can only recover from failed emergency stop"
      );
    }

    return this.updateProps({
      status: EmergencyStopStatus.ARMED,
      failureReason: undefined,
      updatedAt: new Date(),
      version: this.props.version + 1,
    });
  }

  activate(): EmergencyStop {
    if (this.isActive) {
      return this;
    }

    return this.updateProps({
      isActive: true,
      status: EmergencyStopStatus.ARMED,
      updatedAt: new Date(),
      version: this.props.version + 1,
    });
  }

  deactivate(): EmergencyStop {
    if (!this.isActive) {
      return this;
    }

    return this.updateProps({
      isActive: false,
      status: EmergencyStopStatus.INACTIVE,
      updatedAt: new Date(),
      version: this.props.version + 1,
    });
  }

  updateTriggerConditions(newConditions: TriggerCondition[]): EmergencyStop {
    if (newConditions.length === 0) {
      throw new DomainValidationError(
        "triggerConditions",
        newConditions,
        "Emergency stop must have at least one trigger condition"
      );
    }

    return this.updateProps({
      triggerConditions: newConditions,
      updatedAt: new Date(),
      version: this.props.version + 1,
    });
  }

  updateEmergencyActions(newActions: EmergencyAction[]): EmergencyStop {
    if (newActions.length === 0) {
      throw new DomainValidationError(
        "emergencyActions",
        newActions,
        "Emergency stop must have at least one emergency action"
      );
    }

    return this.updateProps({
      emergencyActions: newActions,
      updatedAt: new Date(),
      version: this.props.version + 1,
    });
  }

  enableAutoExecution(): EmergencyStop {
    if (this.autoExecute) {
      return this;
    }

    return this.updateProps({
      autoExecute: true,
      updatedAt: new Date(),
      version: this.props.version + 1,
    });
  }

  disableAutoExecution(): EmergencyStop {
    if (!this.autoExecute) {
      return this;
    }

    return this.updateProps({
      autoExecute: false,
      updatedAt: new Date(),
      version: this.props.version + 1,
    });
  }

  // Helper method to create updated instance
  private updateProps(updates: Partial<EmergencyStopProps>): EmergencyStop {
    const updatedProps = { ...this.props, ...updates };
    const updatedEmergencyStop = EmergencyStop.fromExisting(updatedProps);
    updatedEmergencyStop.markAsModified();
    return updatedEmergencyStop;
  }

  // Method to mark events as committed (for testing)
  markEventsAsCommitted(): void {
    this.clearDomainEvents();
  }

  // Get uncommitted events (overridden for type safety)
  getUncommittedEvents(): readonly (
    | EmergencyStopCreated
    | EmergencyStopTriggered
    | EmergencyStopCompleted
    | EmergencyStopFailed
  )[] {
    return this.getDomainEvents() as readonly (
      | EmergencyStopCreated
      | EmergencyStopTriggered
      | EmergencyStopCompleted
      | EmergencyStopFailed
    )[];
  }

  // Convert to plain object for persistence
  toPlainObject(): EmergencyStopProps {
    return { ...this.props };
  }
}
