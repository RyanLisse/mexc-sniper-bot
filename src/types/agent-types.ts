/**
 * Type definitions for the multi-agent system
 */

export interface AgentContext {
  [key: string]: unknown;
}

export interface AgentHandoff {
  toAgent: string;
  reason: string;
  context?: AgentContext;
}

export interface EnhancedAgentResponse {
  content: string;
  reasoning?: string;
  confidence: number;
  toolCalls?: unknown[];
  handoff?: AgentHandoff;
  metadata: {
    agent: string;
    timestamp: string;
    tokensUsed?: number;
    model?: string;
    processingTime?: number;
  };
}

export interface PatternListing {
  vcoinId: string;
  symbolName: string;
  projectName?: string;
  patternSts?: number;
  patternSt?: number;
  patternTt?: number;
  hasReadyPattern: boolean;
  confidence: number;
  firstOpenTime: number;
  estimatedLaunchTime?: number;
  [key: string]: unknown;
}

export interface CalendarListing {
  vcoinId: string;
  symbolName: string;
  projectName?: string;
  firstOpenTime: number;
  [key: string]: unknown;
}
