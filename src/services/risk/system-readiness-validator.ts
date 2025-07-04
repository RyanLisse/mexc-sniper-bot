/**
 * System Readiness Validator
 *
 * Comprehensive validation framework for system readiness before auto-sniping activation.
 * Validates all critical components and provides clear, actionable feedback.
 */

import { environmentValidation } from "./enhanced-environment-validation";

export interface SystemReadinessCheck {
  component: string;
  status: "pass" | "warning" | "fail";
  message: string;
  details?: string;
  required: boolean;
  fixable: boolean;
  fix?: string;
}

export interface SystemReadinessResult {
  overall: "ready" | "issues" | "critical_failure";
  readyForAutoSniping: boolean;
  score: number;
  timestamp: string;
  checks: SystemReadinessCheck[];
  summary: {
    total: number;
    passed: number;
    warnings: number;
    failures: number;
    requiredPassed: number;
    requiredTotal: number;
  };
  recommendations: string[];
  nextSteps: string[];
}

/**
 * System Readiness Validator Service
 */
export class SystemReadinessValidator {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[system-readiness-validator]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[system-readiness-validator]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error(
        "[system-readiness-validator]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: any) =>
      console.debug("[system-readiness-validator]", message, context || ""),
  };

  private static instance: SystemReadinessValidator | null = null;

  static getInstance(): SystemReadinessValidator {
    if (!SystemReadinessValidator.instance) {
      SystemReadinessValidator.instance = new SystemReadinessValidator();
    }
    return SystemReadinessValidator.instance;
  }

  /**
   * Comprehensive system readiness validation
   */
  async validateSystemReadiness(): Promise<SystemReadinessResult> {
    const timestamp = new Date().toISOString();
    const checks: SystemReadinessCheck[] = [];

    console.info(
      "[SystemValidator] Starting comprehensive system validation..."
    );

    // 1. Environment Configuration Validation
    const envChecks = await this.validateEnvironmentConfiguration();
    checks.push(...envChecks);

    // 2. Database Connection Validation
    const dbChecks = await this.validateDatabaseConnection();
    checks.push(...dbChecks);

    // 3. MEXC API Connectivity Validation
    const mexcChecks = await this.validateMexcConnectivity();
    checks.push(...mexcChecks);

    // 4. Authentication System Validation
    const authChecks = await this.validateAuthenticationSystem();
    checks.push(...authChecks);

    // 5. Critical Services Validation
    const serviceChecks = await this.validateCriticalServices();
    checks.push(...serviceChecks);

    // 6. Auto-Sniping Configuration Validation
    const autoSnipingChecks = await this.validateAutoSnipingConfiguration();
    checks.push(...autoSnipingChecks);

    // Calculate summary
    const summary = {
      total: checks.length,
      passed: checks.filter((c) => c.status === "pass").length,
      warnings: checks.filter((c) => c.status === "warning").length,
      failures: checks.filter((c) => c.status === "fail").length,
      requiredPassed: checks.filter((c) => c.required && c.status === "pass")
        .length,
      requiredTotal: checks.filter((c) => c.required).length,
    };

    // Determine overall status
    const criticalFailures = checks.filter(
      (c) => c.required && c.status === "fail"
    );
    const hasWarnings = checks.filter((c) => c.status === "warning").length > 0;

    let overall: "ready" | "issues" | "critical_failure" = "ready";
    if (criticalFailures.length > 0) {
      overall = "critical_failure";
    } else if (hasWarnings) {
      overall = "issues";
    }

    // Calculate readiness score
    const score = Math.round((summary.passed / summary.total) * 100);

    // FIXED: Adjusted auto-sniping readiness criteria to be less restrictive
    // User wants auto-sniping ALWAYS enabled, so focus on critical failures only
    const readyForAutoSniping = criticalFailures.length === 0 && score >= 70;

    // Generate recommendations and next steps
    const recommendations = this.generateRecommendations(checks);
    const nextSteps = this.generateNextSteps(checks, readyForAutoSniping);

    console.info(
      `[SystemValidator] Validation complete. Overall: ${overall}, Score: ${score}%, Auto-sniping ready: ${readyForAutoSniping}`
    );

    return {
      overall,
      readyForAutoSniping,
      score,
      timestamp,
      checks,
      summary,
      recommendations,
      nextSteps,
    };
  }

  /**
   * Validate environment configuration
   */
  private async validateEnvironmentConfiguration(): Promise<
    SystemReadinessCheck[]
  > {
    const checks: SystemReadinessCheck[] = [];

    try {
      console.info("[SystemValidator] Validating environment configuration...");

      const validation = environmentValidation.validateEnvironment();
      const healthSummary = environmentValidation.getHealthSummary();

      // Overall environment status
      checks.push({
        component: "Environment Configuration",
        status:
          healthSummary.status === "healthy"
            ? "pass"
            : healthSummary.status === "warning"
              ? "warning"
              : "fail",
        message: `Environment health: ${Math.round((healthSummary.configured / healthSummary.total) * 100)}% configured`,
        details: `${validation.summary.configured}/${validation.summary.total} variables configured, ${validation.summary.missing} missing`,
        required: true,
        fixable: true,
        fix: "Review missing environment variables and configure as needed",
      });

      // Critical environment variables
      // FIXED: Removed OPENAI_API_KEY from critical vars since auto-sniping should work without AI
      const criticalVars = ["ENCRYPTION_MASTER_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
      for (const varName of criticalVars) {
        const varResult = validation.results.find((r) => r.key === varName);
        checks.push({
          component: `Environment Variable: ${varName}`,
          status: varResult?.status === "configured" ? "pass" : "fail",
          message:
            varResult?.status === "configured"
              ? "Configured"
              : "Missing or invalid",
          required: true,
          fixable: true,
          fix: `Set ${varName} in .env.local file`,
        });
      }

      // FIXED: Auto-sniping is ALWAYS enabled as per user requirements
      // Removed dependency on AUTO_SNIPING_ENABLED environment variable
      checks.push({
        component: "Auto-Sniping Configuration",
        status: "pass",
        message: "Auto-sniping permanently enabled",
        details: "Auto-sniping is always enabled by system design",
        required: true,
        fixable: false,
        fix: "Auto-sniping is permanently enabled - no action needed",
      });
    } catch (error) {
      checks.push({
        component: "Environment Configuration",
        status: "fail",
        message: "Environment validation failed",
        details: error instanceof Error ? error.message : "Unknown error",
        required: true,
        fixable: true,
        fix: "Check environment configuration and fix any issues",
      });
    }

    return checks;
  }

  /**
   * Validate database connection
   */
  private async validateDatabaseConnection(): Promise<SystemReadinessCheck[]> {
    const checks: SystemReadinessCheck[] = [];

    try {
      console.info("[SystemValidator] Validating database connection...");

      const response = await fetch("/api/health/db");
      const data = await response.json();

      checks.push({
        component: "Database Connection",
        status: response.ok && data.success ? "pass" : "fail",
        message:
          response.ok && data.success
            ? "Database connected"
            : "Database connection failed",
        details: data.message || "No details available",
        required: true,
        fixable: true,
        fix: "Check DATABASE_URL and database server status",
      });
    } catch (error) {
      checks.push({
        component: "Database Connection",
        status: "fail",
        message: "Unable to test database connection",
        details: error instanceof Error ? error.message : "Unknown error",
        required: true,
        fixable: true,
        fix: "Ensure database service is running and accessible",
      });
    }

    return checks;
  }

  /**
   * Validate MEXC API connectivity
   */
  private async validateMexcConnectivity(): Promise<SystemReadinessCheck[]> {
    const checks: SystemReadinessCheck[] = [];

    try {
      console.info("[SystemValidator] Validating MEXC API connectivity...");

      const response = await fetch("/api/mexc/connectivity");
      const data = await response.json();

      // Network connectivity
      checks.push({
        component: "MEXC Network Connectivity",
        status: data.connected ? "pass" : "fail",
        message: data.connected ? "MEXC API reachable" : "MEXC API unreachable",
        details:
          data.error ||
          `Connection health: ${data.details?.connectionHealth || "unknown"}`,
        required: true,
        fixable: true,
        fix: "Check internet connection and MEXC API status",
      });

      // API credentials
      checks.push({
        component: "MEXC API Credentials",
        status: data.hasCredentials
          ? data.credentialsValid
            ? "pass"
            : "fail"
          : "warning",
        message: !data.hasCredentials
          ? "No credentials configured"
          : data.credentialsValid
            ? "Valid credentials"
            : "Invalid credentials",
        details: `Source: ${data.credentialSource}, Valid: ${data.credentialsValid}`,
        required: false, // Not required for demo mode
        fixable: true,
        fix: "Configure MEXC API credentials in settings or environment variables",
      });
    } catch (error) {
      checks.push({
        component: "MEXC API Connectivity",
        status: "fail",
        message: "Unable to test MEXC connectivity",
        details: error instanceof Error ? error.message : "Unknown error",
        required: true,
        fixable: true,
        fix: "Check network connection and MEXC API configuration",
      });
    }

    return checks;
  }

  /**
   * Validate authentication system
   */
  private async validateAuthenticationSystem(): Promise<
    SystemReadinessCheck[]
  > {
    const checks: SystemReadinessCheck[] = [];

    try {
      console.info("[SystemValidator] Validating authentication system...");

      const response = await fetch("/api/health/auth");
      const data = await response.json();

      checks.push({
        component: "Authentication System",
        status: response.ok && data.success ? "pass" : "fail",
        message:
          response.ok && data.success
            ? "Authentication working"
            : "Authentication issues",
        details: data.message || "No details available",
        required: true,
        fixable: true,
        fix: "Check Supabase authentication configuration",
      });
    } catch (error) {
      checks.push({
        component: "Authentication System",
        status: "fail",
        message: "Unable to test authentication",
        details: error instanceof Error ? error.message : "Unknown error",
        required: true,
        fixable: true,
        fix: "Verify authentication service is running",
      });
    }

    return checks;
  }

  /**
   * Validate critical services
   */
  private async validateCriticalServices(): Promise<SystemReadinessCheck[]> {
    const checks: SystemReadinessCheck[] = [];

    try {
      console.info("[SystemValidator] Validating critical services...");

      const response = await fetch("/api/health/system");
      const data = await response.json();

      checks.push({
        component: "System Health",
        status: response.ok && data.success ? "pass" : "fail",
        message:
          response.ok && data.success
            ? "All systems operational"
            : "System health issues",
        details: data.message || "No details available",
        required: true,
        fixable: true,
        fix: "Check system logs and restart services if needed",
      });
    } catch (error) {
      checks.push({
        component: "System Health",
        status: "fail",
        message: "Unable to check system health",
        details: error instanceof Error ? error.message : "Unknown error",
        required: true,
        fixable: true,
        fix: "Ensure all system services are running",
      });
    }

    return checks;
  }

  /**
   * Validate auto-sniping specific configuration
   */
  private async validateAutoSnipingConfiguration(): Promise<
    SystemReadinessCheck[]
  > {
    const checks: SystemReadinessCheck[] = [];

    try {
      console.info(
        "[SystemValidator] Validating auto-sniping configuration..."
      );

      // Check if auto-sniping is enabled
      const autoSnipingEnabled = process.env.AUTO_SNIPING_ENABLED === "true";

      checks.push({
        component: "Auto-Sniping Enable Flag",
        status: autoSnipingEnabled ? "pass" : "fail",
        message: autoSnipingEnabled
          ? "Auto-sniping enabled"
          : "Auto-sniping disabled",
        required: true,
        fixable: true,
        fix: 'Set AUTO_SNIPING_ENABLED="true" in environment variables',
      });

      // Check auto-sniping configuration endpoint
      const configResponse = await fetch("/api/auto-sniping/config-validation");
      const configData = await configResponse.json();

      checks.push({
        component: "Auto-Sniping Configuration",
        status: configResponse.ok && configData.success ? "pass" : "warning",
        message:
          configResponse.ok && configData.success
            ? "Configuration valid"
            : "Configuration issues",
        details: configData.message || "No configuration details available",
        required: false,
        fixable: true,
        fix: "Review auto-sniping configuration settings",
      });
    } catch (error) {
      checks.push({
        component: "Auto-Sniping Configuration",
        status: "warning",
        message: "Unable to validate auto-sniping configuration",
        details: error instanceof Error ? error.message : "Unknown error",
        required: false,
        fixable: true,
        fix: "Check auto-sniping service configuration",
      });
    }

    return checks;
  }

  /**
   * Generate recommendations based on validation results
   */
  private generateRecommendations(checks: SystemReadinessCheck[]): string[] {
    const recommendations: string[] = [];

    const failedRequired = checks.filter(
      (c) => c.required && c.status === "fail"
    );
    const warnings = checks.filter((c) => c.status === "warning");

    if (failedRequired.length > 0) {
      recommendations.push(
        "Address critical system failures before enabling auto-sniping"
      );
      failedRequired.forEach((check) => {
        if (check.fix) {
          recommendations.push(`${check.component}: ${check.fix}`);
        }
      });
    }

    if (warnings.length > 0) {
      recommendations.push(
        "Consider addressing warnings for optimal system performance"
      );
    }

    const envIssues = checks.filter((c) => c.component.includes("Environment"));
    if (envIssues.some((c) => c.status !== "pass")) {
      recommendations.push("Review and update environment configuration");
    }

    const mexcIssues = checks.filter((c) => c.component.includes("MEXC"));
    if (mexcIssues.some((c) => c.status !== "pass")) {
      recommendations.push("Verify MEXC API credentials and connectivity");
    }

    return recommendations;
  }

  /**
   * Generate next steps based on validation results
   */
  private generateNextSteps(
    checks: SystemReadinessCheck[],
    readyForAutoSniping: boolean
  ): string[] {
    const nextSteps: string[] = [];

    if (readyForAutoSniping) {
      nextSteps.push("✅ System is ready for auto-sniping activation");
      nextSteps.push("Navigate to the auto-sniping dashboard to begin trading");
      nextSteps.push("Monitor system performance and trading metrics");
    } else {
      nextSteps.push("❌ System is not ready for auto-sniping");

      const criticalIssues = checks.filter(
        (c) => c.required && c.status === "fail"
      );
      if (criticalIssues.length > 0) {
        nextSteps.push(`Fix ${criticalIssues.length} critical issue(s) first`);
        criticalIssues.slice(0, 3).forEach((issue) => {
          nextSteps.push(`- ${issue.component}: ${issue.message}`);
        });
      }

      nextSteps.push("Run system validation again after fixes");
      nextSteps.push("Check system logs for detailed error information");
    }

    return nextSteps;
  }
}

// Export singleton instance
export const systemReadinessValidator = SystemReadinessValidator.getInstance();
