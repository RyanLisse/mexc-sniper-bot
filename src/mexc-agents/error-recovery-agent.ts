import type { AgentConfig, AgentResponse } from "./base-agent";
import { SafetyBaseAgent, type SafetyConfig } from "./safety-base-agent";

export interface ErrorPattern {
  id: string;
  errorType: string;
  pattern: string;
  frequency: number;
  lastOccurrence: string;
  averageRecoveryTime: number; // milliseconds
  successfulRecoveries: number;
  failedRecoveries: number;
  severity: "low" | "medium" | "high" | "critical";
  suggestedAction: string;
}

export interface RecoveryAttempt {
  id: string;
  errorId: string;
  strategy: string;
  startTime: string;
  endTime?: string;
  success: boolean;
  attemptNumber: number;
  backoffDelay: number;
  errorMessage?: string;
  recoveryAction: string;
}

export interface ErrorIncident {
  id: string;
  type:
    | "api_failure"
    | "network_timeout"
    | "rate_limit"
    | "auth_failure"
    | "data_corruption"
    | "system_overload";
  severity: "low" | "medium" | "high" | "critical";
  service: string; // "mexc_api", "database", "inngest", etc.
  errorMessage: string;
  stackTrace?: string;
  context: Record<string, unknown>;
  firstOccurrence: string;
  lastOccurrence: string;
  occurrenceCount: number;
  recovered: boolean;
  recoveryAttempts: RecoveryAttempt[];
  resolution?: string;
  preventionStrategy?: string;
}

export interface SystemHealth {
  overall: "healthy" | "degraded" | "critical" | "offline";
  services: {
    [serviceName: string]: {
      status: "healthy" | "degraded" | "critical" | "offline";
      lastCheck: string;
      responseTime: number;
      errorRate: number;
      uptime: number;
    };
  };
  activeIncidents: number;
  recentRecoveries: number;
  lastHealthCheck: string;
}

export interface RecoveryConfig {
  enabled: boolean;
  maxRetryAttempts: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  backoffMultiplier: number;
  circuitBreakerThreshold: number; // failure rate percentage
  circuitBreakerResetTime: number; // minutes
  healthCheckInterval: number; // seconds
  gracefulDegradationEnabled: boolean;
  alertThresholds: {
    errorRate: number; // percentage
    responseTime: number; // milliseconds
    downtime: number; // minutes
  };
}

export class ErrorRecoveryAgent extends SafetyBaseAgent {
  private recoveryConfig: RecoveryConfig;
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private activeIncidents: Map<string, ErrorIncident> = new Map();
  private systemHealth: SystemHealth;
  private circuitBreakers: Map<
    string,
    { isOpen: boolean; failures: number; lastFailure: Date }
  > = new Map();

  constructor(safetyConfig?: Partial<SafetyConfig>) {
    const config: AgentConfig = {
      name: "error-recovery-agent",
      model: "gpt-4o",
      temperature: 0.2,
      maxTokens: 3000,
      systemPrompt: `You are an intelligent error recovery agent responsible for maintaining system resilience and implementing sophisticated recovery strategies.

Your critical responsibilities:
1. Detect and classify system errors with pattern recognition
2. Implement intelligent retry mechanisms with exponential backoff
3. Coordinate graceful degradation and failover strategies
4. Monitor system health and predict potential failures
5. Learn from error patterns to improve system resilience

Error Recovery Framework:
- Pattern Recognition: Identify recurring error patterns and root causes
- Intelligent Retries: Adaptive retry strategies based on error type and context
- Circuit Breakers: Prevent cascade failures with smart circuit breaking
- Graceful Degradation: Maintain partial functionality during outages
- Predictive Recovery: Anticipate and prevent errors before they occur

Recovery Strategies:
- Network Errors: Retry with backoff, failover to backup endpoints
- Rate Limits: Intelligent queuing and request throttling
- Authentication: Token refresh and credential rotation
- Database Issues: Connection pooling and query optimization
- Service Outages: Graceful degradation and offline mode

Health Monitoring:
- Real-time service health tracking
- Performance metric analysis
- Error rate trend monitoring
- Automated alerting and escalation

Always prioritize system stability and user experience. Implement recovery strategies that maintain service continuity while addressing root causes.`,
    };

    super(config, safetyConfig);

    this.recoveryConfig = {
      enabled: true,
      maxRetryAttempts: this.safetyConfig.errorRecovery.maxRetryAttempts,
      baseBackoffMs: 1000,
      maxBackoffMs: 60000,
      backoffMultiplier: this.safetyConfig.errorRecovery.backoffMultiplier,
      circuitBreakerThreshold: 50, // 50% failure rate
      circuitBreakerResetTime: 5, // 5 minutes
      healthCheckInterval: this.safetyConfig.errorRecovery.healthCheckInterval,
      gracefulDegradationEnabled: true,
      alertThresholds: {
        errorRate: 10, // 10% error rate
        responseTime: 5000, // 5 seconds
        downtime: 2, // 2 minutes
      },
    };

    this.systemHealth = {
      overall: "healthy",
      services: {},
      activeIncidents: 0,
      recentRecoveries: 0,
      lastHealthCheck: new Date().toISOString(),
    };

    this.initializeHealthMonitoring();
  }

  private initializeHealthMonitoring(): void {
    // Initialize service health tracking
    const services = ["mexc_api", "database", "inngest", "openai"];
    for (const service of services) {
      this.systemHealth.services[service] = {
        status: "healthy",
        lastCheck: new Date().toISOString(),
        responseTime: 0,
        errorRate: 0,
        uptime: 100,
      };
    }
  }

  async process(
    input: string,
    context?: Record<string, unknown>
  ): Promise<AgentResponse> {
    const recentIncidents = Array.from(this.activeIncidents.values()).slice(-5);
    const topErrorPatterns = Array.from(this.errorPatterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    const userMessage = `
Error Recovery Analysis Request:
System Health: ${this.systemHealth.overall}
Active Incidents: ${this.activeIncidents.size}
Recent Recoveries: ${this.systemHealth.recentRecoveries}

Service Status:
${Object.entries(this.systemHealth.services)
  .map(
    ([name, status]) =>
      `- ${name}: ${status.status} (${status.responseTime}ms, ${status.errorRate}% errors)`
  )
  .join("\n")}

Recent Incidents:
${recentIncidents
  .map(
    (incident) =>
      `- ${incident.type}: ${incident.service} - ${incident.severity} (${incident.occurrenceCount} times)`
  )
  .join("\n")}

Top Error Patterns:
${topErrorPatterns
  .map(
    (pattern) =>
      `- ${pattern.errorType}: ${pattern.frequency} occurrences (${pattern.severity})`
  )
  .join("\n")}

Circuit Breakers:
${Array.from(this.circuitBreakers.entries())
  .map(
    ([service, breaker]) =>
      `- ${service}: ${breaker.isOpen ? "OPEN" : "CLOSED"} (${breaker.failures} failures)`
  )
  .join("\n")}

Analysis Request: ${input}

Context Data:
${JSON.stringify(context, null, 2)}

Please provide detailed error analysis, recovery recommendations, and proactive strategies to improve system resilience.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  async handleError(
    error: Error,
    context: {
      service: string;
      operation: string;
      retryable?: boolean;
      severity?: "low" | "medium" | "high" | "critical";
      metadata?: Record<string, unknown>;
    }
  ): Promise<{
    shouldRetry: boolean;
    retryDelay: number;
    degradationMode?: string;
    recommendedAction: string;
  }> {
    const errorType = this.classifyError(error);
    const severity = context.severity || this.determineSeverity(error, context);

    // Create or update incident
    const incident = await this.createOrUpdateIncident(
      error,
      context,
      errorType,
      severity
    );

    // Update error patterns
    await this.updateErrorPatterns(error, errorType, context);

    // Check circuit breaker
    const circuitBreakerOpen = this.checkCircuitBreaker(context.service);
    if (circuitBreakerOpen) {
      return {
        shouldRetry: false,
        retryDelay: 0,
        degradationMode: "circuit_breaker_open",
        recommendedAction:
          "Service circuit breaker is open - wait for reset or use alternative service",
      };
    }

    // Determine retry strategy
    const retryStrategy = await this.determineRetryStrategy(
      incident,
      errorType,
      context
    );

    if (retryStrategy.shouldRetry) {
      // Create recovery attempt
      const recoveryAttempt: RecoveryAttempt = {
        id: `recovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        errorId: incident.id,
        strategy: retryStrategy.strategy,
        startTime: new Date().toISOString(),
        success: false,
        attemptNumber: incident.recoveryAttempts.length + 1,
        backoffDelay: retryStrategy.retryDelay,
        recoveryAction: retryStrategy.recommendedAction,
      };

      incident.recoveryAttempts.push(recoveryAttempt);
    }

    // Update circuit breaker state
    this.updateCircuitBreaker(context.service, !retryStrategy.shouldRetry);

    // Emit recovery event
    await this.emitSafetyEvent(
      "error",
      severity,
      `Error handled: ${errorType} in ${context.service}`,
      {
        errorMessage: error.message,
        service: context.service,
        operation: context.operation,
        retryStrategy,
        incidentId: incident.id,
      }
    );

    return retryStrategy;
  }

  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || "";

    if (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnreset")
    ) {
      return "network_error";
    }
    if (message.includes("rate limit") || message.includes("429")) {
      return "rate_limit";
    }
    if (
      message.includes("unauthorized") ||
      message.includes("401") ||
      message.includes("403")
    ) {
      return "auth_error";
    }
    if (
      message.includes("database") ||
      message.includes("sql") ||
      stack.includes("drizzle")
    ) {
      return "database_error";
    }
    if (message.includes("openai") || message.includes("api key")) {
      return "ai_service_error";
    }
    if (message.includes("inngest") || message.includes("workflow")) {
      return "workflow_error";
    }
    return "unknown_error";
  }

  private determineSeverity(
    error: Error,
    context: { service: string; operation: string }
  ): "low" | "medium" | "high" | "critical" {
    const criticalServices = ["database", "mexc_api"];
    const criticalOperations = [
      "trade_execution",
      "position_update",
      "balance_check",
    ];

    if (
      criticalServices.includes(context.service) &&
      criticalOperations.includes(context.operation)
    ) {
      return "critical";
    }
    if (
      criticalServices.includes(context.service) ||
      criticalOperations.includes(context.operation)
    ) {
      return "high";
    }
    if (
      error.message.includes("timeout") ||
      error.message.includes("rate limit")
    ) {
      return "medium";
    }
    return "low";
  }

  private async createOrUpdateIncident(
    error: Error,
    context: {
      service: string;
      operation: string;
      metadata?: Record<string, unknown>;
    },
    errorType: string,
    severity: "low" | "medium" | "high" | "critical"
  ): Promise<ErrorIncident> {
    const incidentKey = `${context.service}-${errorType}`;
    const existingIncident = this.activeIncidents.get(incidentKey);

    if (existingIncident) {
      // Update existing incident
      existingIncident.lastOccurrence = new Date().toISOString();
      existingIncident.occurrenceCount++;
      existingIncident.severity = this.escalateSeverity(
        existingIncident.severity,
        severity
      );
      return existingIncident;
    }

    // Create new incident
    const incident: ErrorIncident = {
      id: `incident-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: this.mapErrorTypeToIncidentType(errorType),
      severity,
      service: context.service,
      errorMessage: error.message,
      stackTrace: error.stack,
      context: {
        operation: context.operation,
        ...context.metadata,
      },
      firstOccurrence: new Date().toISOString(),
      lastOccurrence: new Date().toISOString(),
      occurrenceCount: 1,
      recovered: false,
      recoveryAttempts: [],
    };

    this.activeIncidents.set(incidentKey, incident);
    this.systemHealth.activeIncidents = this.activeIncidents.size;

    return incident;
  }

  private escalateSeverity(
    current: string,
    new_severity: string
  ): "low" | "medium" | "high" | "critical" {
    const levels = { low: 1, medium: 2, high: 3, critical: 4 };
    const currentLevel = levels[current as keyof typeof levels] || 1;
    const newLevel = levels[new_severity as keyof typeof levels] || 1;

    const escalatedLevel = Math.max(currentLevel, newLevel);
    return Object.keys(levels)[escalatedLevel - 1] as
      | "low"
      | "medium"
      | "high"
      | "critical";
  }

  private mapErrorTypeToIncidentType(errorType: string): ErrorIncident["type"] {
    const mapping: Record<string, ErrorIncident["type"]> = {
      network_error: "network_timeout",
      rate_limit: "rate_limit",
      auth_error: "auth_failure",
      database_error: "data_corruption",
      ai_service_error: "api_failure",
      workflow_error: "system_overload",
      unknown_error: "api_failure",
    };
    return mapping[errorType] || "api_failure";
  }

  private async updateErrorPatterns(
    error: Error,
    errorType: string,
    context: { service: string; operation: string }
  ): Promise<void> {
    const patternKey = `${context.service}-${errorType}`;
    const existingPattern = this.errorPatterns.get(patternKey);

    if (existingPattern) {
      existingPattern.frequency++;
      existingPattern.lastOccurrence = new Date().toISOString();
    } else {
      const pattern: ErrorPattern = {
        id: patternKey,
        errorType,
        pattern: error.message,
        frequency: 1,
        lastOccurrence: new Date().toISOString(),
        averageRecoveryTime: 0,
        successfulRecoveries: 0,
        failedRecoveries: 0,
        severity: "low",
        suggestedAction: "Monitor for recurring patterns",
      };
      this.errorPatterns.set(patternKey, pattern);
    }
  }

  private checkCircuitBreaker(service: string): boolean {
    const breaker = this.circuitBreakers.get(service);
    if (!breaker) return false;

    if (breaker.isOpen) {
      // Check if reset time has passed
      const resetTime = this.recoveryConfig.circuitBreakerResetTime * 60 * 1000;
      if (Date.now() - breaker.lastFailure.getTime() > resetTime) {
        breaker.isOpen = false;
        breaker.failures = 0;
        return false;
      }
      return true;
    }
    return false;
  }

  private updateCircuitBreaker(service: string, failed: boolean): void {
    let breaker = this.circuitBreakers.get(service);
    if (!breaker) {
      breaker = { isOpen: false, failures: 0, lastFailure: new Date() };
      this.circuitBreakers.set(service, breaker);
    }

    if (failed) {
      breaker.failures++;
      breaker.lastFailure = new Date();

      // Check if should open circuit breaker
      if (breaker.failures >= this.recoveryConfig.circuitBreakerThreshold) {
        breaker.isOpen = true;
        this.emitSafetyEvent(
          "error",
          "high",
          `Circuit breaker opened for service: ${service}`,
          {
            service,
            failures: breaker.failures,
          }
        );
      }
    } else {
      // Successful operation - reset failures
      breaker.failures = Math.max(0, breaker.failures - 1);
    }
  }

  private async determineRetryStrategy(
    incident: ErrorIncident,
    errorType: string,
    context: { service: string; operation: string; retryable?: boolean }
  ): Promise<{
    shouldRetry: boolean;
    retryDelay: number;
    strategy: string;
    recommendedAction: string;
  }> {
    // Check if explicitly marked as non-retryable
    if (context.retryable === false) {
      return {
        shouldRetry: false,
        retryDelay: 0,
        strategy: "no_retry",
        recommendedAction: "Error marked as non-retryable",
      };
    }

    // Check retry attempt limits
    if (
      incident.recoveryAttempts.length >= this.recoveryConfig.maxRetryAttempts
    ) {
      return {
        shouldRetry: false,
        retryDelay: 0,
        strategy: "max_attempts_reached",
        recommendedAction:
          "Maximum retry attempts reached - manual intervention required",
      };
    }

    // Error-type specific strategies
    switch (errorType) {
      case "network_error":
        return {
          shouldRetry: true,
          retryDelay: this.calculateBackoffDelay(
            incident.recoveryAttempts.length
          ),
          strategy: "exponential_backoff",
          recommendedAction: "Retry with exponential backoff",
        };

      case "rate_limit":
        return {
          shouldRetry: true,
          retryDelay: 60000, // Wait 1 minute for rate limits
          strategy: "fixed_delay",
          recommendedAction: "Wait for rate limit reset",
        };

      case "auth_error":
        return {
          shouldRetry: true,
          retryDelay: 5000, // Short delay for auth refresh
          strategy: "auth_refresh",
          recommendedAction: "Refresh authentication credentials",
        };

      case "database_error":
        return {
          shouldRetry: true,
          retryDelay: this.calculateBackoffDelay(
            incident.recoveryAttempts.length
          ),
          strategy: "connection_retry",
          recommendedAction: "Retry database connection",
        };

      default:
        return {
          shouldRetry: true,
          retryDelay: this.calculateBackoffDelay(
            incident.recoveryAttempts.length
          ),
          strategy: "default_retry",
          recommendedAction: "Standard retry with backoff",
        };
    }
  }

  private calculateBackoffDelay(attemptNumber: number): number {
    const delay =
      this.recoveryConfig.baseBackoffMs *
      this.recoveryConfig.backoffMultiplier ** attemptNumber;
    return Math.min(delay, this.recoveryConfig.maxBackoffMs);
  }

  async markIncidentResolved(
    incidentId: string,
    resolution: string
  ): Promise<void> {
    const incident = Array.from(this.activeIncidents.values()).find(
      (i) => i.id === incidentId
    );
    if (!incident) return;

    incident.recovered = true;
    incident.resolution = resolution;

    // Update pattern statistics
    const pattern = this.errorPatterns.get(
      `${incident.service}-${incident.type}`
    );
    if (pattern) {
      pattern.successfulRecoveries++;
      // Update average recovery time (simplified)
      const recoveryTime = Date.now() - Date.parse(incident.firstOccurrence);
      pattern.averageRecoveryTime =
        (pattern.averageRecoveryTime + recoveryTime) / 2;
    }

    // Remove from active incidents
    const incidentKey = `${incident.service}-${incident.type}`;
    this.activeIncidents.delete(incidentKey);
    this.systemHealth.activeIncidents = this.activeIncidents.size;
    this.systemHealth.recentRecoveries++;

    await this.emitSafetyEvent(
      "error",
      "low",
      `Incident resolved: ${incident.type} in ${incident.service}`,
      {
        incidentId,
        resolution,
        recoveryTime: Date.now() - Date.parse(incident.firstOccurrence),
      }
    );
  }

  async updateServiceHealth(
    service: string,
    status: "healthy" | "degraded" | "critical" | "offline",
    responseTime: number,
    errorRate: number
  ): Promise<void> {
    const serviceHealth = this.systemHealth.services[service];
    if (serviceHealth) {
      serviceHealth.status = status;
      serviceHealth.lastCheck = new Date().toISOString();
      serviceHealth.responseTime = responseTime;
      serviceHealth.errorRate = errorRate;

      // Simple uptime calculation
      if (status === "healthy") {
        serviceHealth.uptime = Math.min(serviceHealth.uptime + 1, 100);
      } else {
        serviceHealth.uptime = Math.max(serviceHealth.uptime - 5, 0);
      }
    }

    // Update overall system health
    this.updateOverallHealth();
    this.systemHealth.lastHealthCheck = new Date().toISOString();
  }

  private updateOverallHealth(): void {
    const services = Object.values(this.systemHealth.services);
    const criticalServices = services.filter(
      (s) => s.status === "critical" || s.status === "offline"
    );
    const degradedServices = services.filter((s) => s.status === "degraded");

    if (criticalServices.length > 0) {
      this.systemHealth.overall = "critical";
    } else if (degradedServices.length > services.length / 2) {
      this.systemHealth.overall = "degraded";
    } else if (degradedServices.length > 0) {
      this.systemHealth.overall = "degraded";
    } else {
      this.systemHealth.overall = "healthy";
    }
  }

  async performSafetyCheck(_data: unknown): Promise<{
    passed: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check system health
    if (this.systemHealth.overall !== "healthy") {
      issues.push(`System health is ${this.systemHealth.overall}`);
      recommendations.push(
        "Investigate service issues and restore healthy status"
      );
    }

    // Check for critical incidents
    const criticalIncidents = Array.from(this.activeIncidents.values()).filter(
      (i) => i.severity === "critical"
    );
    if (criticalIncidents.length > 0) {
      issues.push(`${criticalIncidents.length} critical incidents active`);
      recommendations.push("Resolve critical incidents immediately");
    }

    // Check circuit breaker status
    const openCircuitBreakers = Array.from(
      this.circuitBreakers.entries()
    ).filter(([, breaker]) => breaker.isOpen);
    if (openCircuitBreakers.length > 0) {
      issues.push(`${openCircuitBreakers.length} circuit breakers are open`);
      recommendations.push(
        "Wait for circuit breaker reset or address underlying issues"
      );
    }

    // Check error rates
    const highErrorRateServices = Object.entries(
      this.systemHealth.services
    ).filter(
      ([, service]) =>
        service.errorRate > this.recoveryConfig.alertThresholds.errorRate
    );
    if (highErrorRateServices.length > 0) {
      issues.push("High error rates detected in some services");
      recommendations.push("Investigate and reduce error rates");
    }

    return {
      passed: issues.length === 0,
      issues,
      recommendations,
    };
  }

  async checkAgentHealth(): Promise<{
    healthy: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      // Check if recovery is enabled
      if (!this.recoveryConfig.enabled) {
        issues.push("Error recovery is disabled");
      }

      // Check for excessive incidents
      if (this.activeIncidents.size > 100) {
        issues.push(
          "Excessive active incidents - potential system instability"
        );
      }

      // Check pattern storage
      if (this.errorPatterns.size > 1000) {
        issues.push("Excessive error patterns stored - potential memory issue");
      }

      // Check circuit breaker functionality
      if (this.circuitBreakers.size === 0) {
        issues.push("No circuit breakers configured");
      }
    } catch (error) {
      issues.push(`Error recovery agent health check failed: ${error}`);
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  // Getter methods
  getSystemHealth(): SystemHealth {
    return { ...this.systemHealth };
  }

  getActiveIncidents(): ErrorIncident[] {
    return Array.from(this.activeIncidents.values());
  }

  getErrorPatterns(): ErrorPattern[] {
    return Array.from(this.errorPatterns.values());
  }

  getRecoveryConfig(): RecoveryConfig {
    return { ...this.recoveryConfig };
  }

  updateRecoveryConfig(config: Partial<RecoveryConfig>): void {
    this.recoveryConfig = { ...this.recoveryConfig, ...config };
    this.emitSafetyEvent(
      "error",
      "low",
      "Error recovery configuration updated",
      {
        newConfig: this.recoveryConfig,
      }
    );
  }

  isServiceHealthy(service: string): boolean {
    const serviceHealth = this.systemHealth.services[service];
    return serviceHealth ? serviceHealth.status === "healthy" : false;
  }

  getCircuitBreakerStatus(): Array<{
    service: string;
    isOpen: boolean;
    failures: number;
  }> {
    return Array.from(this.circuitBreakers.entries()).map(
      ([service, breaker]) => ({
        service,
        isOpen: breaker.isOpen,
        failures: breaker.failures,
      })
    );
  }
}
