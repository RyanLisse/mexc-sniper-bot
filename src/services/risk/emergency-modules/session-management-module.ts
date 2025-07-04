/**
 * Session Management Module
 *
 * Handles active emergency sessions, lifecycle management, and session tracking.
 * Extracted from advanced-emergency-coordinator.ts for better modularity.
 */

export interface EmergencySession {
  id: string;
  protocolId: string;
  startTime: string;
  currentLevel: string;
  triggeredBy: string;
  reason: string;
  executedActions: Array<{
    actionId: string;
    startTime: string;
    endTime?: string;
    status: "pending" | "executing" | "completed" | "failed";
    result?: any;
    error?: string;
  }>;
  communications: Array<{
    timestamp: string;
    recipient: string;
    channel: string;
    message: string;
    status: "sent" | "delivered" | "failed";
  }>;
  status:
    | "active"
    | "escalating"
    | "de-escalating"
    | "resolving"
    | "resolved"
    | "failed";
  resolution?: {
    timestamp: string;
    method: "automatic" | "manual";
    verifiedBy: string;
    notes: string;
  };
}

export interface SessionConfig {
  maxConcurrentEmergencies: number;
  emergencySessionTimeout: number;
  autoEscalationEnabled: boolean;
}

export class SessionManagementModule {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[session-management-module]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[session-management-module]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error(
        "[session-management-module]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: any) =>
      console.debug("[session-management-module]", message, context || ""),
  };

  private activeSessions: Map<string, EmergencySession> = new Map();
  private sessionHistory: EmergencySession[] = [];
  private config: SessionConfig;

  constructor(config: SessionConfig) {
    this.config = config;
  }

  /**
   * Create new emergency session
   */
  createSession(
    protocolId: string,
    triggeredBy: string,
    reason: string,
    initialLevel: string
  ): { success: boolean; sessionId?: string; error?: string } {
    try {
      // Check concurrent emergency limit
      if (this.activeSessions.size >= this.config.maxConcurrentEmergencies) {
        return {
          success: false,
          error: "Maximum concurrent emergencies reached",
        };
      }

      const sessionId = this.generateSessionId();
      const session: EmergencySession = {
        id: sessionId,
        protocolId,
        startTime: new Date().toISOString(),
        currentLevel: initialLevel,
        triggeredBy,
        reason,
        executedActions: [],
        communications: [],
        status: "active",
      };

      this.activeSessions.set(sessionId, session);

      this.logger.info("Emergency session created", {
        sessionId,
        protocolId,
        triggeredBy,
        reason,
        activeEmergencies: this.activeSessions.size,
      });

      return { success: true, sessionId };
    } catch (error) {
      this.logger.error("Failed to create emergency session", {
        protocolId,
        triggeredBy,
        reason,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get active session by ID
   */
  getActiveSession(sessionId: string): EmergencySession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getAllActiveSessions(): EmergencySession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Update session status
   */
  updateSessionStatus(
    sessionId: string,
    status: EmergencySession["status"]
  ): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn("Session not found for status update", { sessionId });
      return false;
    }

    const previousStatus = session.status;
    session.status = status;

    this.logger.debug("Session status updated", {
      sessionId,
      previousStatus,
      newStatus: status,
    });

    return true;
  }

  /**
   * Update session level
   */
  updateSessionLevel(sessionId: string, newLevel: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn("Session not found for level update", { sessionId });
      return false;
    }

    const previousLevel = session.currentLevel;
    session.currentLevel = newLevel;

    this.logger.info("Session level updated", {
      sessionId,
      previousLevel,
      newLevel,
    });

    return true;
  }

  /**
   * Add executed action to session
   */
  addExecutedAction(
    sessionId: string,
    action: {
      actionId: string;
      status: "pending" | "executing" | "completed" | "failed";
      result?: any;
      error?: string;
    }
  ): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn("Session not found for action update", { sessionId });
      return false;
    }

    const executedAction = {
      ...action,
      startTime: new Date().toISOString(),
      endTime:
        action.status === "completed" || action.status === "failed"
          ? new Date().toISOString()
          : undefined,
    };

    session.executedActions.push(executedAction);

    this.logger.debug("Executed action added to session", {
      sessionId,
      actionId: action.actionId,
      status: action.status,
    });

    return true;
  }

  /**
   * Add communication to session
   */
  addCommunication(
    sessionId: string,
    communication: {
      recipient: string;
      channel: string;
      message: string;
      status: "sent" | "delivered" | "failed";
    }
  ): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn("Session not found for communication update", {
        sessionId,
      });
      return false;
    }

    const communicationEntry = {
      ...communication,
      timestamp: new Date().toISOString(),
    };

    session.communications.push(communicationEntry);

    this.logger.debug("Communication added to session", {
      sessionId,
      recipient: communication.recipient,
      channel: communication.channel,
      status: communication.status,
    });

    return true;
  }

  /**
   * Resolve session
   */
  resolveSession(
    sessionId: string,
    resolution: {
      method: "automatic" | "manual";
      verifiedBy: string;
      notes: string;
    }
  ): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn("Session not found for resolution", { sessionId });
      return false;
    }

    // Update session with resolution
    session.status = "resolved";
    session.resolution = {
      timestamp: new Date().toISOString(),
      method: resolution.method,
      verifiedBy: resolution.verifiedBy,
      notes: resolution.notes,
    };

    // Move to history
    this.sessionHistory.push({ ...session });
    this.activeSessions.delete(sessionId);

    this.logger.info("Emergency session resolved", {
      sessionId,
      method: resolution.method,
      verifiedBy: resolution.verifiedBy,
      duration: this.calculateSessionDuration(session),
    });

    return true;
  }

  /**
   * Fail session
   */
  failSession(sessionId: string, reason: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn("Session not found for failure", { sessionId });
      return false;
    }

    session.status = "failed";
    session.resolution = {
      timestamp: new Date().toISOString(),
      method: "automatic",
      verifiedBy: "system",
      notes: `Session failed: ${reason}`,
    };

    // Move to history
    this.sessionHistory.push({ ...session });
    this.activeSessions.delete(sessionId);

    this.logger.error("Emergency session failed", {
      sessionId,
      reason,
      duration: this.calculateSessionDuration(session),
    });

    return true;
  }

  /**
   * Check for expired sessions
   */
  checkExpiredSessions(): string[] {
    const expiredSessions: string[] = [];
    const now = Date.now();

    for (const [sessionId, session] of this.activeSessions) {
      const sessionAge = now - new Date(session.startTime).getTime();

      if (sessionAge > this.config.emergencySessionTimeout) {
        this.logger.warn("Emergency session expired", {
          sessionId,
          age: sessionAge,
          timeout: this.config.emergencySessionTimeout,
        });

        this.failSession(sessionId, "Session timeout exceeded");
        expiredSessions.push(sessionId);
      }
    }

    return expiredSessions;
  }

  /**
   * Get session history
   */
  getSessionHistory(limit = 50): EmergencySession[] {
    return this.sessionHistory.slice(-limit);
  }

  /**
   * Get session statistics
   */
  getSessionStatistics(): {
    activeSessions: number;
    totalHistoricalSessions: number;
    averageSessionDuration: number;
    sessionsByStatus: Record<string, number>;
    sessionsByResolutionMethod: Record<string, number>;
  } {
    const historicalSessions = this.sessionHistory;
    const averageSessionDuration =
      historicalSessions.length > 0
        ? historicalSessions.reduce(
            (sum, session) => sum + this.calculateSessionDuration(session),
            0
          ) / historicalSessions.length
        : 0;

    const sessionsByStatus = historicalSessions.reduce(
      (acc, session) => {
        acc[session.status] = (acc[session.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const sessionsByResolutionMethod = historicalSessions
      .filter((session) => session.resolution)
      .reduce(
        (acc, session) => {
          const method = session.resolution!.method;
          acc[method] = (acc[method] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

    return {
      activeSessions: this.activeSessions.size,
      totalHistoricalSessions: historicalSessions.length,
      averageSessionDuration,
      sessionsByStatus,
      sessionsByResolutionMethod,
    };
  }

  /**
   * Clean old session history
   */
  cleanOldSessions(maxAge: number): number {
    const cutoffTime = Date.now() - maxAge;
    const initialCount = this.sessionHistory.length;

    this.sessionHistory = this.sessionHistory.filter((session) => {
      const sessionTime = new Date(session.startTime).getTime();
      return sessionTime > cutoffTime;
    });

    const removedCount = initialCount - this.sessionHistory.length;

    if (removedCount > 0) {
      this.logger.info("Old sessions cleaned from history", {
        removedCount,
        remainingCount: this.sessionHistory.length,
      });
    }

    return removedCount;
  }

  // Private helper methods

  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `emrg_${timestamp}_${randomStr}`;
  }

  private calculateSessionDuration(session: EmergencySession): number {
    const startTime = new Date(session.startTime).getTime();
    const endTime = session.resolution
      ? new Date(session.resolution.timestamp).getTime()
      : Date.now();

    return endTime - startTime;
  }
}
