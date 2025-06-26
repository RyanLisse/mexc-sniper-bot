/**
 * Enhanced Environment Validation Service (Facade)
 *
 * Lightweight facade providing backward compatibility
 * while using the new modular environment validation architecture
 */

// Re-export types and utilities
export type { EnvironmentValidationResult, EnvironmentVariable } from "@/src/config/environment/types";
export { ENVIRONMENT_VARIABLES } from "@/src/config/environment/variables";

// Re-export main service with backward compatibility
export {
  EnvironmentValidation as EnhancedEnvironmentValidation,
  environmentValidation,
} from "./environment-validation";
