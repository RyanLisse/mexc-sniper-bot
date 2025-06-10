import type { AgentContext } from "@/src/types/agent-types";
import { Agent, run } from "@openai/agents";
import OpenAI from "openai";

export interface EnhancedAgentConfig {
  name: string;
  instructions: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Array<Record<string, unknown>>;
  toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
}

export interface EnhancedAgentResponse {
  content: string;
  reasoning?: string;
  toolCalls?: unknown[];
  metadata: {
    agent: string;
    timestamp: string;
    tokensUsed?: number;
    model?: string;
    executionTime?: number;
  };
}

export interface AgentHandoff {
  toAgent: string;
  context: AgentContext;
  reason: string;
}

export class EnhancedBaseAgent {
  protected agent: Agent;
  protected config: EnhancedAgentConfig;
  protected openai: OpenAI;

  constructor(config: EnhancedAgentConfig) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Initialize OpenAI Agent
    // Type assertion needed as @openai/agents has strict tool requirements
    // but runtime behavior works correctly with standard tool definitions
    this.agent = new Agent({
      name: config.name,
      instructions: config.instructions,
      model: config.model || "gpt-4o",
      tools: (config.tools || []) as never[],
    });
  }

  /**
   * Process input using OpenAI Agents framework with multi-agent handoff capabilities
   */
  async processWithAgent(input: string, context?: AgentContext): Promise<EnhancedAgentResponse> {
    const startTime = Date.now();

    try {
      // Prepare context-aware prompt
      const contextualInput = this.prepareContextualInput(input, context);

      // Run the agent with OpenAI Agents framework
      const result = await run(this.agent, contextualInput);

      const executionTime = Date.now() - startTime;

      return {
        content: result.finalOutput || "",
        reasoning: this.extractReasoning(result),
        toolCalls: this.extractToolCalls(result),
        metadata: {
          agent: this.config.name,
          timestamp: new Date().toISOString(),
          model: this.config.model || "gpt-4o",
          executionTime,
        },
      };
    } catch (error) {
      console.error(`[${this.config.name}] Enhanced agent error:`, error);
      throw new Error(`Enhanced agent ${this.config.name} failed: ${error}`);
    }
  }

  /**
   * Legacy compatibility method - fallback to standard OpenAI API
   */
  protected async callOpenAI(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options?: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>
  ): Promise<EnhancedAgentResponse> {
    const startTime = Date.now();

    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.model || "gpt-4o",
        messages: [
          {
            role: "system",
            content: this.config.instructions,
          },
          ...messages,
        ],
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 2000,
        ...options,
      });

      const content = "choices" in response ? response.choices[0]?.message?.content || "" : "";
      const executionTime = Date.now() - startTime;

      return {
        content,
        metadata: {
          agent: this.config.name,
          timestamp: new Date().toISOString(),
          tokensUsed: "usage" in response ? response.usage?.total_tokens : undefined,
          model: "model" in response ? response.model : undefined,
          executionTime,
        },
      };
    } catch (error) {
      console.error(`[${this.config.name}] OpenAI API error:`, error);
      throw new Error(`Agent ${this.config.name} failed: ${error}`);
    }
  }

  /**
   * Determine if this agent should hand off to another agent
   */
  protected shouldHandoff(_input: string, _context?: AgentContext): AgentHandoff | null {
    // Override in subclasses to implement handoff logic
    return null;
  }

  /**
   * Public accessor for handoff decision logic (used by orchestrator)
   */
  public checkHandoff(input: string, context?: AgentContext): AgentHandoff | null {
    return this.shouldHandoff(input, context);
  }

  /**
   * Execute multi-agent handoff
   */
  async executeWithHandoff(
    input: string,
    context?: AgentContext,
    agentRegistry?: Map<string, EnhancedBaseAgent>
  ): Promise<EnhancedAgentResponse> {
    const handoff = this.shouldHandoff(input, context);

    if (handoff && agentRegistry?.has(handoff.toAgent)) {
      const targetAgent = agentRegistry.get(handoff.toAgent);
      if (!targetAgent) {
        throw new Error(`Agent ${handoff.toAgent} not found in registry`);
      }
      return targetAgent.processWithAgent(input, {
        ...context,
        ...handoff.context,
        handoffReason: handoff.reason,
        sourceAgent: this.config.name,
      });
    }

    return this.processWithAgent(input, context);
  }

  /**
   * Prepare contextual input by combining user input with context
   */
  private prepareContextualInput(input: string, context?: AgentContext): string {
    if (!context || Object.keys(context).length === 0) {
      return input;
    }

    const contextString = Object.entries(context)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join("\n");

    return `Context:\n${contextString}\n\nUser Input:\n${input}`;
  }

  /**
   * Extract reasoning from agent result
   */
  private extractReasoning(result: unknown): string | undefined {
    // Extract reasoning steps if available in result
    const resultObj = result as Record<string, unknown>;
    return (resultObj.reasoning as string) || (resultObj.thinking as string) || undefined;
  }

  /**
   * Extract tool calls from agent result
   */
  private extractToolCalls(result: unknown): unknown[] | undefined {
    const resultObj = result as Record<string, unknown>;
    return (resultObj.toolCalls as unknown[]) || (resultObj.tool_calls as unknown[]) || undefined;
  }

  /**
   * Process method - should be implemented by subclasses
   */
  async process(input: string, context?: AgentContext): Promise<EnhancedAgentResponse> {
    return this.processWithAgent(input, context);
  }
}
