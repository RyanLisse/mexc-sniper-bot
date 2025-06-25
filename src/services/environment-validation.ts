/**
 * Environment Validation Service
 *
 * Simplified and modular environment variable validation
 * Refactored from enhanced-environment-validation.ts for maintainability
 */

import type { EnvironmentValidationResult, EnvironmentVariable } from "../config/environment/types";
import {
  ENVIRONMENT_VARIABLES,
  getCriticalMissing,
  getRequiredVariables,
} from "../config/environment/variables";

export class EnvironmentValidation {
  private static instance: EnvironmentValidation;

  private logger = {
    info: (message: string, context?: any) =>
      console.info("[environment-validation]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[environment-validation]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[environment-validation]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[environment-validation]", message, context || ""),
  };

  private constructor() {}

  static getInstance(): EnvironmentValidation {
    if (!EnvironmentValidation.instance) {
      EnvironmentValidation.instance = new EnvironmentValidation();
    }
    return EnvironmentValidation.instance;
  }

  /**
   * Validate all environment variables
   */
  validateEnvironment(): EnvironmentValidationResult {
    const results: EnvironmentValidationResult["results"] = [];
    const categories: Record<string, any> = {};
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Process each environment variable
    for (const envVar of ENVIRONMENT_VARIABLES) {
      const result = this.validateSingleVariable(envVar);
      results.push(result);

      // Track category stats
      if (!categories[envVar.category]) {
        categories[envVar.category] = {
          total: 0,
          configured: 0,
          missing: 0,
          status: "complete" as const,
        };
      }
      categories[envVar.category].total++;

      if (result.status === "configured" || result.status === "default") {
        categories[envVar.category].configured++;
      } else if (result.status === "missing") {
        categories[envVar.category].missing++;
      }

      // Collect warnings
      if (result.message && result.status === "missing" && envVar.warningIfMissing) {
        warnings.push(envVar.warningIfMissing);
      }
    }

    // Calculate category statuses
    Object.keys(categories).forEach((category) => {
      const cat = categories[category];
      if (cat.missing > 0) {
        cat.status = cat.missing === cat.total ? "critical" : "issues";
      }
    });

    // Generate summary
    const summary = {
      total: results.length,
      configured: results.filter((r) => r.status === "configured").length,
      missing: results.filter((r) => r.status === "missing").length,
      invalid: results.filter((r) => r.status === "invalid").length,
      warnings: warnings.length,
    };

    // Determine overall status
    const criticalMissing = getCriticalMissing(results);
    let status: "complete" | "issues" | "critical";

    if (criticalMissing.length > 0) {
      status = "critical";
    } else if (summary.missing > 0 || summary.invalid > 0) {
      status = "issues";
    } else {
      status = "complete";
    }

    // Generate recommendations
    if (criticalMissing.length > 0) {
      recommendations.push(`Critical: Configure required variables: ${criticalMissing.join(", ")}`);
    }

    if (warnings.length > 0) {
      recommendations.push("Configure optional API keys for enhanced features");
    }

    const validationResult: EnvironmentValidationResult = {
      isValid: status !== "critical",
      status,
      summary,
      results,
      categories,
      recommendations,
      documentation: this.generateDocumentation(),
    };

    this.logValidationResults(validationResult);
    return validationResult;
  }

  /**
   * Validate a single environment variable
   */
  private validateSingleVariable(
    envVar: EnvironmentVariable
  ): EnvironmentValidationResult["results"][0] {
    const value = process.env[envVar.key];

    // Check if variable exists
    if (!value || value.trim() === "") {
      if (envVar.defaultValue) {
        // Use default value
        process.env[envVar.key] = envVar.defaultValue;
        return {
          key: envVar.key,
          status: "default",
          value: envVar.defaultValue,
          message: `Using default value: ${envVar.defaultValue}`,
          category: envVar.category,
          required: envVar.required,
        };
      } else {
        // Missing variable
        return {
          key: envVar.key,
          status: "missing",
          message: envVar.warningIfMissing || `${envVar.description} is not configured`,
          category: envVar.category,
          required: envVar.required,
        };
      }
    }

    // Validate value if validator exists
    if (envVar.validator && !envVar.validator(value)) {
      return {
        key: envVar.key,
        status: "invalid",
        value: this.sanitizeValue(envVar.key, value),
        message: `Invalid value for ${envVar.description}`,
        category: envVar.category,
        required: envVar.required,
      };
    }

    // Variable is properly configured
    return {
      key: envVar.key,
      status: "configured",
      value: this.sanitizeValue(envVar.key, value),
      message: envVar.description,
      category: envVar.category,
      required: envVar.required,
    };
  }

  /**
   * Sanitize sensitive values for logging
   */
  private sanitizeValue(key: string, value: string): string {
    const sensitivePatterns = ["key", "secret", "token", "password", "url"];
    const isSensitive = sensitivePatterns.some((pattern) => key.toLowerCase().includes(pattern));

    if (isSensitive) {
      return value.length > 8
        ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
        : "***";
    }

    return value;
  }

  /**
   * Generate environment documentation
   */
  private generateDocumentation(): string {
    const sections = {
      core: "Core Application Settings",
      api: "API Keys and External Services",
      database: "Database Configuration",
      cache: "Cache and Redis Settings",
      security: "Authentication and Security",
      monitoring: "Monitoring and Observability",
      development: "Development Settings",
      deployment: "Deployment Configuration",
    };

    let documentation = "# Environment Variables Documentation\n\n";

    Object.entries(sections).forEach(([category, title]) => {
      const vars = ENVIRONMENT_VARIABLES.filter((v) => v.category === category);
      if (vars.length === 0) return;

      documentation += `## ${title}\n\n`;
      vars.forEach((envVar) => {
        documentation += `### ${envVar.key}\n`;
        documentation += `- **Description**: ${envVar.description}\n`;
        documentation += `- **Required**: ${envVar.required ? "Yes" : "No"}\n`;
        if (envVar.defaultValue) {
          documentation += `- **Default**: ${envVar.defaultValue}\n`;
        }
        if (envVar.example) {
          documentation += `- **Example**: ${envVar.example}\n`;
        }
        if (envVar.warningIfMissing) {
          documentation += `- **Note**: ${envVar.warningIfMissing}\n`;
        }
        documentation += "\n";
      });
    });

    return documentation;
  }

  /**
   * Log validation results
   */
  private logValidationResults(result: EnvironmentValidationResult): void {
    this.logger.info("Environment validation completed", {
      status: result.status,
      summary: result.summary,
    });

    if (result.status === "critical") {
      this.logger.error("Critical environment variables missing", {
        missing: result.results
          .filter((r) => r.required && r.status === "missing")
          .map((r) => r.key),
      });
    }

    if (result.recommendations.length > 0) {
      this.logger.warn("Environment recommendations", {
        recommendations: result.recommendations,
      });
    }
  }

  /**
   * Get environment variable value with fallback
   */
  getEnvVar(key: string, fallback?: string): string {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      if (fallback !== undefined) {
        return fallback;
      }
      const envVar = ENVIRONMENT_VARIABLES.find((v) => v.key === key);
      if (envVar?.defaultValue) {
        return envVar.defaultValue;
      }
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }

  /**
   * Check if environment is ready for production
   */
  isProductionReady(): { ready: boolean; issues: string[] } {
    const result = this.validateEnvironment();
    const issues: string[] = [];

    // Check for critical missing variables
    const criticalMissing = result.results
      .filter((r) => r.required && r.status === "missing")
      .map((r) => r.key);

    if (criticalMissing.length > 0) {
      issues.push(`Missing required variables: ${criticalMissing.join(", ")}`);
    }

    // Check for default values in production
    if (process.env.NODE_ENV === "production") {
      const usingDefaults = result.results
        .filter((r) => r.status === "default" && r.key !== "NODE_ENV")
        .map((r) => r.key);

      if (usingDefaults.length > 0) {
        issues.push(`Using default values in production: ${usingDefaults.join(", ")}`);
      }
    }

    return {
      ready: issues.length === 0,
      issues,
    };
  }
}

// Export singleton instance and backward compatibility
export const environmentValidation = EnvironmentValidation.getInstance();
export const EnhancedEnvironmentValidation = EnvironmentValidation;
