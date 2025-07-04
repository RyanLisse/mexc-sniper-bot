/**
 * Environment Variables Configuration
 *
 * Centralized environment variable definitions for validation and documentation
 * Extracted from enhanced-environment-validation.ts for modularity
 */

import type { EnvironmentVariable } from "./types";

export const ENVIRONMENT_VARIABLES: EnvironmentVariable[] = [
  // Core Application
  {
    key: "NODE_ENV",
    description: "Application environment mode",
    required: false,
    category: "core",
    defaultValue: "development",
    example: "development",
  },
  {
    key: "ENVIRONMENT",
    description: "Custom environment identifier",
    required: false,
    category: "core",
    defaultValue: "development",
    example: "development",
  },
  {
    key: "LOG_LEVEL",
    description: "Logging level",
    required: false,
    category: "core",
    defaultValue: "info",
    example: "info",
    validator: (value) => ["debug", "info", "warn", "error"].includes(value),
  },

  // API Keys - Critical for Trading
  {
    key: "MEXC_API_KEY",
    description: "MEXC Exchange API key for trading operations",
    required: true,
    category: "api",
    example: "mx_your-mexc-api-key",
    warningIfMissing:
      "Live trading will be unavailable without MEXC credentials",
  },
  {
    key: "MEXC_SECRET_KEY",
    description: "MEXC Exchange secret key",
    required: true,
    category: "api",
    example: "your-mexc-secret-key",
  },
  {
    key: "MEXC_BASE_URL",
    description: "MEXC API base URL",
    required: false,
    category: "api",
    defaultValue: "https://api.mexc.com",
    example: "https://api.mexc.com",
  },

  // AI Services (Optional but Enhanced)
  {
    key: "OPENAI_API_KEY",
    description: "OpenAI API key for AI agent functionality",
    required: false,
    category: "api",
    example: "sk-your-openai-api-key",
    warningIfMissing:
      "AI-enhanced features will be limited without OpenAI API key",
  },
  {
    key: "ANTHROPIC_API_KEY",
    description: "Anthropic Claude API key for enhanced AI capabilities",
    required: false,
    category: "api",
    example: "sk-ant-your-anthropic-api-key",
    warningIfMissing:
      "Enhanced AI capabilities will be limited without Anthropic API key",
  },
  {
    key: "PERPLEXITY_API_KEY",
    description: "Perplexity API key for research and insights",
    required: false,
    category: "api",
    example: "pplx-your-perplexity-api-key",
    warningIfMissing: "Research and insight features will be limited",
  },
  {
    key: "COHERE_API_KEY",
    description: "Cohere API key for embeddings",
    required: false,
    category: "api",
    example: "your-cohere-api-key",
    warningIfMissing: "Pattern embedding features will be limited",
  },

  // Database Configuration
  {
    key: "DATABASE_URL",
    description: "Supabase PostgreSQL database connection URL",
    required: true,
    category: "database",
    example: "postgresql://user:password@region.supabase.co:5432/postgres",
  },

  // Cache Configuration
  {
    key: "REDIS_URL",
    description: "Redis cache connection URL",
    required: false,
    category: "cache",
    defaultValue: "redis://localhost:6379",
    example: "redis://localhost:6379",
  },
  {
    key: "UPSTASH_REDIS_REST_URL",
    description: "Upstash Redis REST API URL",
    required: false,
    category: "cache",
    example: "https://your-redis.upstash.io",
  },
  {
    key: "UPSTASH_REDIS_REST_TOKEN",
    description: "Upstash Redis REST API token",
    required: false,
    category: "cache",
    example: "your-upstash-token",
  },

  // Authentication
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    description: "Supabase project URL",
    required: true,
    category: "security",
    example: "https://your-project.supabase.co",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    description: "Supabase anonymous public key",
    required: true,
    category: "security",
    example: "your-anon-key",
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    description: "Supabase service role key for server-side operations",
    required: true,
    category: "security",
    example: "your-service-role-key",
  },

  // Monitoring & Observability
  {
    key: "INNGEST_EVENT_KEY",
    description: "Inngest event key for workflow management",
    required: false,
    category: "monitoring",
    example: "your-inngest-key",
    warningIfMissing: "Workflow automation will be limited",
  },
  {
    key: "OTEL_EXPORTER_OTLP_ENDPOINT",
    description: "OpenTelemetry OTLP endpoint",
    required: false,
    category: "monitoring",
    example: "https://api.honeycomb.io",
  },
  {
    key: "HONEYCOMB_API_KEY",
    description: "Honeycomb API key for observability",
    required: false,
    category: "monitoring",
    example: "your-honeycomb-key",
  },

  // Security & Encryption
  {
    key: "ENCRYPTION_KEY",
    description: "Application encryption key",
    required: false,
    category: "security",
    defaultValue: "dev-key-32-chars-for-development",
    example: "your-32-character-encryption-key",
  },
  {
    key: "SUPABASE_SMTP_HOST",
    description: "Custom SMTP host for bypassing Supabase email rate limits",
    required: false,
    category: "security",
    example: "smtp.resend.com",
    warningIfMissing: "Using Supabase's limited email service (2 emails/hour)",
  },
  {
    key: "SUPABASE_SMTP_PORT",
    description: "Custom SMTP port",
    required: false,
    category: "security",
    example: "587",
  },
  {
    key: "SUPABASE_SMTP_USER",
    description: "Custom SMTP username",
    required: false,
    category: "security",
    example: "resend",
  },
  {
    key: "SUPABASE_SMTP_PASS",
    description: "Custom SMTP password/API key",
    required: false,
    category: "security",
    example: "re_your-api-key",
  },

  // Development & Testing
  {
    key: "DEBUG",
    description: "Enable debug mode",
    required: false,
    category: "development",
    defaultValue: "false",
    example: "false",
  },
  {
    key: "ENABLE_REAL_MEXC_TESTS",
    description: "Enable real MEXC API tests",
    required: false,
    category: "development",
    defaultValue: "false",
    example: "true",
  },

  // Deployment
  {
    key: "VERCEL_URL",
    description: "Vercel deployment URL",
    required: false,
    category: "deployment",
    example: "your-app.vercel.app",
  },
  {
    key: "NEXT_PUBLIC_VERCEL_URL",
    description: "Public Vercel URL for client-side",
    required: false,
    category: "deployment",
    example: "your-app.vercel.app",
  },
];

// Validation utilities
export const getVariablesByCategory = (
  category: string
): EnvironmentVariable[] => {
  return ENVIRONMENT_VARIABLES.filter((env) => env.category === category);
};

export const getRequiredVariables = (): EnvironmentVariable[] => {
  return ENVIRONMENT_VARIABLES.filter((env) => env.required);
};

export const getCriticalMissing = (
  results: Array<{ key: string; status: string; required: boolean }>
): string[] => {
  return results
    .filter((result) => result.required && result.status === "missing")
    .map((result) => result.key);
};
