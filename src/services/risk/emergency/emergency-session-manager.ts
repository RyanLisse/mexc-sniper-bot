/**
 * Emergency Session Manager
 *
 * Manages the lifecycle of emergency sessions including creation, execution,
 * escalation, de-escalation, and resolution.
 */

import { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events";
import { createTimer } from "@/src/lib/structured-logger";
import type {
  CommunicationEntry,
  EmergencyAction,
  EmergencyLevel,
  EmergencyMetrics,
  EmergencyProtocol,
  EmergencySession,
} from "./emergency-types";

/**
 * Session state tracking
 */
interface SessionState {
  currentLevel: string;
  executingActions: Set<string>;
  failedActions: Set<string>;
  completedActions: Set<string>;
  lastEscalation: number;
  lastDeescalation: number;
  approvalsPending: Set<string>;
  metrics: EmergencyMetrics;
}

/**
 * Emergency session manager
 */
export class EmergencySessionManager extends BrowserCompatibleEventEmitter {
  private sessions: Map<string, EmergencySession> = new Map();
  private sessionStates: Map<string, SessionState> = new Map();
  private sessionHistory: EmergencySession[] = [];
  private activeTimers: Map<string, NodeJS.Timeout> = new Map();

  private logger = {
    info: (message: string, context?: any) =>
      console.info("[emergency-session-manager]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[emergency-session-manager]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error(
        "[emergency-session-manager]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: any) =>
      console.debug("[emergency-session-manager]", message, context || ""),
  };

  constructor(private maxConcurrentSessions: number = 5) {
    super();
  }

  /**
   * Create new emergency session
   */
  async createSession(
    protocolId: string,
    protocol: EmergencyProtocol,
    triggeredBy: string,
    triggerReason: string,
    _context?: Record<string, any>
  ): Promise<string> {
    // Check concurrent session limit
    if (this.sessions.size >= this.maxConcurrentSessions) {
      throw new Error("Maximum concurrent emergency sessions reached");
    }

    const sessionId = this.generateSessionId();
    const now = Date.now();

    const session: EmergencySession = {
      id: sessionId,
      protocolId,
      currentLevel: protocol.emergencyLevels[0].id,
      status: "active",
      startTime: now,
      triggeredBy,
      triggerReason,
      actionsExecuted: [],
      actionResults: {},
      approvals: {},
      communicationLog: [],
      metrics: {
        responseTime: 0,
        resolutionTime: 0,
        actionsSuccessful: 0,
        actionsFailed: 0,
        escalations: 0,
        communicationsSent: 0,
        systemsAffected: [],
        financialImpact: 0,
      },
      recoveryProgress: {
        checkpointsCompleted: [],
        checkpointsFailed: [],
        currentPhase: "initial",
        estimatedCompletion: 0,
        verificationResults: {},
      },
      lessons: [],
    };

    const sessionState: SessionState = {
      currentLevel: protocol.emergencyLevels[0].id,
      executingActions: new Set(),
      failedActions: new Set(),
      completedActions: new Set(),
      lastEscalation: 0,
      lastDeescalation: 0,
      approvalsPending: new Set(),
      metrics: { ...session.metrics },
    };

    this.sessions.set(sessionId, session);
    this.sessionStates.set(sessionId, sessionState);

    this.logger.info("Emergency session created", {
      sessionId,
      protocolId,
      triggeredBy,
      triggerReason,
      activeSessions: this.sessions.size,
    });

    this.emit("session_created", {
      sessionId,
      protocolId,
      triggeredBy,
      triggerReason,
      timestamp: now,
    });

    return sessionId;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): EmergencySession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): EmergencySession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === "active"
    );
  }

  /**
   * Update session status
   */
  updateSessionStatus(
    sessionId: string,
    status: EmergencySession["status"]
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const oldStatus = session.status;
    session.status = status;

    this.logger.info("Session status updated", {
      sessionId,
      oldStatus,
      newStatus: status,
    });

    this.emit("session_status_changed", {
      sessionId,
      oldStatus,
      newStatus: status,
      timestamp: Date.now(),
    });

    // If session is resolved or failed, clean up
    if (status === "resolved" || status === "failed") {
      this.finalizeSession(sessionId);
    }
  }

  /**
   * Execute emergency level
   */
  async executeEmergencyLevel(
    sessionId: string,
    level: EmergencyLevel,
    context?: Record<string, any>
  ): Promise<void> {
    const timer = createTimer(
      "execute_emergency_level",
      "emergency-session-manager"
    );
    const session = this.sessions.get(sessionId);
    const sessionState = this.sessionStates.get(sessionId);

    if (!session || !sessionState) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      this.logger.info("Executing emergency level", {
        sessionId,
        levelId: level.id,
        levelName: level.name,
        severity: level.severity,
        actionCount: level.autoActions.length,
      });

      // Update session level
      session.currentLevel = level.id;
      sessionState.currentLevel = level.id;

      // Execute actions in priority order
      const sortedActions = level.autoActions.sort(
        (a, b) => a.priority - b.priority
      );

      for (const action of sortedActions) {
        try {
          await this.executeAction(sessionId, action, context);
        } catch (error) {
          this.logger.error("Action execution failed", {
            sessionId,
            actionId: action.id,
            error: (error as Error).message,
          });

          // Continue with other actions unless critical
          if (action.type === "system_shutdown") {
            throw error;
          }
        }
      }

      // Set level timeout if specified
      if (level.maxDuration > 0) {
        this.setLevelTimeout(sessionId, level.maxDuration);
      }

      const duration = timer.end({
        status: "success",
        sessionId,
        levelId: level.id,
      });

      this.emit("level_executed", {
        sessionId,
        levelId: level.id,
        severity: level.severity,
        duration,
        timestamp: Date.now(),
      });
    } catch (error) {
      timer.end({ status: "failed", sessionId, levelId: level.id });

      this.logger.error("Emergency level execution failed", {
        sessionId,
        levelId: level.id,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Execute individual action
   */
  private async executeAction(
    sessionId: string,
    action: EmergencyAction,
    context?: Record<string, any>
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    const sessionState = this.sessionStates.get(sessionId);

    if (!session || !sessionState) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Check dependencies
    for (const depId of action.dependencies) {
      if (!sessionState.completedActions.has(depId)) {
        throw new Error(`Action dependency not met: ${depId}`);
      }
    }

    sessionState.executingActions.add(action.id);

    const actionExecution = {
      id: action.id,
      type: action.type,
      startTime: Date.now(),
      endTime: 0,
      status: "executing" as const,
      result: null,
      error: null,
    };

    session.actionsExecuted.push(action.id);

    try {
      this.logger.info("Executing emergency action", {
        sessionId,
        actionId: action.id,
        actionType: action.type,
        timeout: action.timeout,
      });

      // Simulate action execution based on type
      const result = await this.simulateActionExecution(action, context);

      actionExecution.endTime = Date.now();
      actionExecution.status = "completed";
      actionExecution.result = result;

      sessionState.executingActions.delete(action.id);
      sessionState.completedActions.add(action.id);
      sessionState.metrics.actionsSuccessful++;
      session.actionResults[action.id] = result;

      this.logger.info("Emergency action completed", {
        sessionId,
        actionId: action.id,
        duration: actionExecution.endTime - actionExecution.startTime,
        result,
      });
    } catch (error) {
      actionExecution.endTime = Date.now();
      actionExecution.status = "failed";
      actionExecution.error = (error as Error).message;

      sessionState.executingActions.delete(action.id);
      sessionState.failedActions.add(action.id);
      sessionState.metrics.actionsFailed++;
      session.actionResults[action.id] = { error: (error as Error).message };

      // Retry if configured
      if (action.retryCount > 0) {
        this.logger.info("Retrying failed action", {
          sessionId,
          actionId: action.id,
          retriesRemaining: action.retryCount,
        });

        // Note: In real implementation, would implement retry logic
      }

      throw error;
    }
  }

  /**
   * Simulate action execution (replace with real implementations)
   */
  private async simulateActionExecution(
    action: EmergencyAction,
    _context?: Record<string, any>
  ): Promise<any> {
    // Add artificial delay to simulate real execution
    await new Promise((resolve) => setTimeout(resolve, 100));

    switch (action.type) {
      case "halt_trading":
        return { tradingHalted: true, timestamp: Date.now() };

      case "close_positions":
        return { positionsClosed: 5, totalValue: 100000 };

      case "reduce_exposure": {
        const reduction = action.conditions?.reduction_percentage || 50;
        return { exposureReduced: reduction, newExposure: 100 - reduction };
      }

      case "notify_operators":
        return { notificationsSent: 3, channels: ["slack", "email"] };

      case "system_shutdown":
        return { systemShutdown: true, gracefulShutdown: true };

      case "market_maker_pause":
        return { marketMakerPaused: true, openOrders: 12 };

      default:
        return { actionExecuted: true };
    }
  }

  /**
   * Escalate session to next level
   */
  async escalateSession(
    sessionId: string,
    protocol: EmergencyProtocol,
    reason: string,
    forcedBy?: string
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    const sessionState = this.sessionStates.get(sessionId);

    if (!session || !sessionState) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Find current and next level
    const currentLevelIndex = protocol.emergencyLevels.findIndex(
      (l) => l.id === session.currentLevel
    );

    if (
      currentLevelIndex === -1 ||
      currentLevelIndex >= protocol.emergencyLevels.length - 1
    ) {
      this.logger.warn("Cannot escalate - already at highest level", {
        sessionId,
        currentLevel: session.currentLevel,
      });
      return false;
    }

    const nextLevel = protocol.emergencyLevels[currentLevelIndex + 1];
    const now = Date.now();

    session.status = "escalated";
    sessionState.lastEscalation = now;
    sessionState.metrics.escalations++;

    this.logger.info("Escalating emergency session", {
      sessionId,
      fromLevel: session.currentLevel,
      toLevel: nextLevel.id,
      reason,
      forcedBy,
    });

    // Add communication log entry
    this.addCommunicationEntry(sessionId, {
      timestamp: now,
      channel: "system",
      message: `Emergency escalated from ${session.currentLevel} to ${nextLevel.id}. Reason: ${reason}`,
      recipient: "all_stakeholders",
      status: "sent",
    });

    // Execute the next level
    await this.executeEmergencyLevel(sessionId, nextLevel);

    this.emit("session_escalated", {
      sessionId,
      fromLevel: session.currentLevel,
      toLevel: nextLevel.id,
      reason,
      forcedBy,
      timestamp: now,
    });

    return true;
  }

  /**
   * Add communication entry
   */
  addCommunicationEntry(sessionId: string, entry: CommunicationEntry): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.communicationLog.push(entry);

    const sessionState = this.sessionStates.get(sessionId);
    if (sessionState) {
      sessionState.metrics.communicationsSent++;
    }
  }

  /**
   * Set timeout for level execution
   */
  private setLevelTimeout(sessionId: string, timeoutMs: number): void {
    // Clear existing timeout
    const existingTimeout = this.activeTimers.get(sessionId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      this.handleLevelTimeout(sessionId);
    }, timeoutMs);

    this.activeTimers.set(sessionId, timeout);
  }

  /**
   * Handle level timeout
   */
  private handleLevelTimeout(sessionId: string): void {
    this.logger.warn("Emergency level timeout reached", { sessionId });

    this.emit("level_timeout", {
      sessionId,
      timestamp: Date.now(),
    });

    // Auto-escalate if configured
    // Note: Would need protocol reference for auto-escalation logic
  }

  /**
   * Finalize session (move to history and cleanup)
   */
  private finalizeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.endTime = Date.now();

    // Calculate final metrics
    if (session.startTime) {
      const sessionState = this.sessionStates.get(sessionId);
      if (sessionState) {
        sessionState.metrics.resolutionTime =
          session.endTime - session.startTime;
        session.metrics = sessionState.metrics;
      }
    }

    // Move to history
    this.sessionHistory.push({ ...session });

    // Cleanup
    this.sessions.delete(sessionId);
    this.sessionStates.delete(sessionId);

    const timeout = this.activeTimers.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeTimers.delete(sessionId);
    }

    this.logger.info("Session finalized", {
      sessionId,
      status: session.status,
      duration: session.endTime - session.startTime,
      actionsExecuted: session.actionsExecuted.length,
    });

    this.emit("session_finalized", {
      sessionId,
      status: session.status,
      duration: session.endTime - session.startTime,
      timestamp: session.endTime,
    });
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `emrg_${timestamp}_${random}`;
  }

  /**
   * Get session history
   */
  getSessionHistory(limit?: number): EmergencySession[] {
    return limit ? this.sessionHistory.slice(-limit) : [...this.sessionHistory];
  }

  /**
   * Get session metrics summary
   */
  getMetricsSummary(): {
    activeSessions: number;
    totalSessions: number;
    averageResolutionTime: number;
    successRate: number;
    escalationRate: number;
  } {
    const totalSessions = this.sessionHistory.length + this.sessions.size;
    const completedSessions = this.sessionHistory.filter(
      (s) => s.status === "resolved"
    );

    const totalResolutionTime = completedSessions.reduce((sum, session) => {
      return sum + (session.metrics?.resolutionTime || 0);
    }, 0);

    const totalEscalations = this.sessionHistory.reduce((sum, session) => {
      return sum + (session.metrics?.escalations || 0);
    }, 0);

    return {
      activeSessions: this.sessions.size,
      totalSessions,
      averageResolutionTime:
        completedSessions.length > 0
          ? totalResolutionTime / completedSessions.length
          : 0,
      successRate:
        totalSessions > 0 ? completedSessions.length / totalSessions : 0,
      escalationRate: totalSessions > 0 ? totalEscalations / totalSessions : 0,
    };
  }

  /**
   * Cleanup completed sessions (for memory management)
   */
  cleanupHistory(maxHistorySize: number = 1000): number {
    if (this.sessionHistory.length <= maxHistorySize) {
      return 0;
    }

    const toRemove = this.sessionHistory.length - maxHistorySize;
    this.sessionHistory.splice(0, toRemove);

    this.logger.info("Session history cleaned up", {
      removedSessions: toRemove,
      remainingSessions: this.sessionHistory.length,
    });

    return toRemove;
  }

  /**
   * Shutdown manager and cleanup all resources
   */
  async shutdown(): Promise<void> {
    this.logger.info("Shutting down session manager", {
      activeSessions: this.sessions.size,
      activeTimers: this.activeTimers.size,
    });

    // Clear all timers
    for (const timeout of this.activeTimers.values()) {
      clearTimeout(timeout);
    }
    this.activeTimers.clear();

    // Finalize all active sessions
    for (const sessionId of this.sessions.keys()) {
      this.updateSessionStatus(sessionId, "failed");
    }

    this.removeAllListeners();
  }
}
