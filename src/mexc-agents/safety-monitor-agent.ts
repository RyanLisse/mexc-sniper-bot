/**
 * Safety Monitor Agent - Legacy Export
 *
 * This file is maintained for backward compatibility.
 * All safety monitoring functionality has been moved to modular components in src/mexc-agents/safety/
 */

// Re-export everything from the new modular safety system
export * from "./safety";
// Maintain backward compatibility with the main agent export
// Legacy export for backward compatibility
export { SafetyMonitorAgent, SafetyMonitorAgent as default } from "./safety";
