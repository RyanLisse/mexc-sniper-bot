import crypto from "node:crypto";
import { globalEnhancedAgentCache, initializeAgentCache } from "@/src/lib/enhanced-agent-cache";
import { ErrorLoggingService } from "@/src/services/error-logging-service";
import OpenAI from "openai";

export interface AgentConfig {
  name: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt: string;
  cacheEnabled?: boolean;
  cacheTTL?: number; // Cache TTL in milliseconds
}

export interface CachedResponse {
  response: AgentResponse;
  timestamp: number;
  expiresAt: number;
}

export interface AgentResponse {
  content: string;
  metadata: {
    agent: string;
    timestamp: string;
    tokensUsed?: number;
    model?: string;
    fromCache?: boolean;
    cacheTimestamp?: string;
    // Enhanced metadata for service layer integration
    serviceLayer?: boolean;
    performanceMetrics?: number | Record<string, unknown>;
    executionTimeMs?: number;
    cached?: boolean;
    operationalData?: boolean;
    error?: boolean;
    [key: string]: unknown; // Allow additional metadata properties
  };
}

export class BaseAgent {
  protected openai: OpenAI;
  protected config: AgentConfig;
  protected responseCache: Map<string, CachedResponse>;
  private readonly defaultCacheTTL = 5 * 60 * 1000; // 5 minutes default
  private cacheCleanupInterval?: NodeJS.Timeout;

  constructor(config: AgentConfig) {
    this.config = {
      cacheEnabled: true,
      cacheTTL: this.defaultCacheTTL,
      ...config,
    };
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.responseCache = new Map();

    // Clean up expired cache entries every 10 minutes
    this.cacheCleanupInterval = setInterval(() => this.cleanupExpiredCache(), 10 * 60 * 1000);

    // Initialize enhanced agent cache for this agent
    if (this.config.cacheEnabled) {
      initializeAgentCache(this.config.name).catch((error) => {
        console.error(`[${this.config.name}] Failed to initialize enhanced cache:`, error);
      });
    }
  }

  /**
   * Generate cache key for request deduplication
   */
  protected generateCacheKey(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options?: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>
  ): string {
    const keyData = {
      agent: this.config.name,
      model: this.config.model || "gpt-4o",
      temperature: this.config.temperature || 0.7,
      maxTokens: this.config.maxTokens || 2000,
      systemPrompt: this.config.systemPrompt,
      messages,
      options,
    };
    return crypto.createHash("sha256").update(JSON.stringify(keyData)).digest("hex");
  }

  /**
   * Check if cached response is still valid
   */
  protected isCacheValid(cached: CachedResponse): boolean {
    return Date.now() < cached.expiresAt;
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.responseCache.entries()) {
      if (now >= cached.expiresAt) {
        this.responseCache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  public getCacheStats(): { size: number; hitRate?: number } {
    return {
      size: this.responseCache.size,
      // Hit rate would need to be tracked separately if needed
    };
  }

  protected async callOpenAI(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options?: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>
  ): Promise<AgentResponse> {
    const startTime = performance.now();

    // Check enhanced agent cache first if enabled
    if (this.config.cacheEnabled) {
      const input = JSON.stringify(messages);
      const context = { options, agent: this.config.name };

      const enhancedCached = await globalEnhancedAgentCache.getAgentResponse(
        this.config.name,
        input,
        context
      );

      if (enhancedCached) {
        console.log(`[${this.config.name}] Enhanced cache hit for request`);
        return enhancedCached;
      }

      // Track cache miss in enhanced cache when it returns null
      if (this.config.cacheEnabled) {
        // Inform enhanced cache about the miss
        await globalEnhancedAgentCache.trackCacheMiss(this.config.name).catch(() => {
          // Ignore errors in tracking
        });
      }

      // Fallback to local cache
      const cacheKey = this.generateCacheKey(messages, options);
      const cached = this.responseCache.get(cacheKey);

      if (cached && this.isCacheValid(cached)) {
        // Double-check with enhanced cache to ensure it hasn't been invalidated
        const enhancedCheck = await globalEnhancedAgentCache.getAgentResponse(
          this.config.name,
          JSON.stringify(messages),
          { options, agent: this.config.name }
        );

        // If enhanced cache returns null, it means it was invalidated, so clear local cache too
        if (!enhancedCheck) {
          this.responseCache.delete(cacheKey);
          console.log(`[${this.config.name}] Local cache invalidated based on enhanced cache`);
        } else {
          console.log(`[${this.config.name}] Local cache hit for request`);
          return {
            ...cached.response,
            metadata: {
              ...cached.response.metadata,
              fromCache: true,
              cacheTimestamp: new Date(cached.timestamp).toISOString(),
            },
          };
        }
      }
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.model || "gpt-4o",
        messages: [
          {
            role: "system",
            content: this.config.systemPrompt,
          },
          ...messages,
        ],
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 2000,
        ...options,
      });

      const content = "choices" in response ? response.choices[0]?.message?.content || "" : "";

      const executionTime = performance.now() - startTime;

      const agentResponse: AgentResponse = {
        content,
        metadata: {
          agent: this.config.name,
          timestamp: new Date().toISOString(),
          tokensUsed: "usage" in response ? response.usage?.total_tokens : undefined,
          model: "model" in response ? response.model : undefined,
          fromCache: false,
          executionTimeMs: executionTime,
        },
      };

      // Cache the response if caching is enabled
      if (this.config.cacheEnabled) {
        // Cache in enhanced agent cache first
        const input = JSON.stringify(messages);
        const context = { options, agent: this.config.name };

        await globalEnhancedAgentCache.setAgentResponse(
          this.config.name,
          input,
          agentResponse,
          context,
          {
            ttl: this.config.cacheTTL || this.defaultCacheTTL,
            priority: this.determineResponsePriority(agentResponse),
            dependencies: this.extractDependencies(messages, options),
          }
        );

        // Also cache locally for fallback
        const cacheKey = this.generateCacheKey(messages, options);
        const now = Date.now();
        this.responseCache.set(cacheKey, {
          response: agentResponse,
          timestamp: now,
          expiresAt: now + (this.config.cacheTTL || this.defaultCacheTTL),
        });
      }

      return agentResponse;
    } catch (error) {
      const errorLoggingService = ErrorLoggingService.getInstance();
      await errorLoggingService.logError(error as Error, {
        agent: this.config.name,
        operation: "processWithOpenAI",
        messages: messages.length,
      });
      throw new Error(`Agent ${this.config.name} failed: ${error}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async process(_input: string, _context?: Record<string, unknown>): Promise<AgentResponse> {
    throw new Error("Process method must be implemented by subclass");
  }

  /**
   * Determine response priority for caching
   */
  private determineResponsePriority(response: AgentResponse): "low" | "medium" | "high" {
    // High priority for pattern detection and critical trading signals
    if (this.config.name.includes("pattern") || this.config.name.includes("strategy")) {
      return "high";
    }

    // Medium priority for analysis agents
    if (this.config.name.includes("analysis") || this.config.name.includes("calendar")) {
      return "medium";
    }

    // Low priority for other responses
    return "low";
  }

  /**
   * Extract dependencies from messages and options for cache invalidation
   */
  private extractDependencies(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options?: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>
  ): string[] {
    const dependencies: string[] = [];

    // Add agent-specific dependencies
    dependencies.push(this.config.name);

    // Extract dependencies from message content
    const messageContent = messages.map((m) => m.content).join(" ");

    if (messageContent.includes("mexc") || messageContent.includes("symbol")) {
      dependencies.push("mexc/connectivity", "mexc/symbols");
    }

    if (messageContent.includes("calendar") || messageContent.includes("listing")) {
      dependencies.push("mexc/calendar");
    }

    if (messageContent.includes("pattern") || messageContent.includes("ready_state")) {
      dependencies.push("pattern/detection");
    }

    if (messageContent.includes("account") || messageContent.includes("balance")) {
      dependencies.push("mexc/account");
    }

    return dependencies;
  }

  /**
   * Clear local cache (called by enhanced cache during invalidation)
   */
  clearLocalCache(): void {
    this.responseCache.clear();
    console.log(`[${this.config.name}] Local cache cleared`);
  }

  /**
   * Clean up resources and stop background tasks
   * Call this when the agent is no longer needed to prevent memory leaks
   */
  destroy(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = undefined;
    }
    this.responseCache.clear();
  }
}
