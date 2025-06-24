/**
 * Environment Variable Configuration Types
 * 
 * Extracted from enhanced-environment-validation.ts for modularity
 */

export interface EnvironmentVariable {
  key: string;
  description: string;
  required: boolean;
  category:
    | "core"
    | "api"
    | "database"
    | "cache"
    | "monitoring"
    | "security"
    | "development"
    | "deployment";
  defaultValue?: string;
  validator?: (value: string) => boolean;
  example?: string;
  warningIfMissing?: string;
}

export interface EnvironmentValidationResult {
  isValid: boolean;
  status: "complete" | "issues" | "critical";
  summary: {
    total: number;
    configured: number;
    missing: number;
    invalid: number;
    warnings: number;
  };
  results: Array<{
    key: string;
    status: "configured" | "missing" | "invalid" | "default";
    value?: string;
    message?: string;
    category: string;
    required: boolean;
  }>;
  categories: Record<string, {
    total: number;
    configured: number;
    missing: number;
    status: "complete" | "issues" | "critical";
  }>;
  recommendations: string[];
  documentation: string;
}