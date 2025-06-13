import crypto from "crypto";
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
  };
}

export class BaseAgent {
  protected openai: OpenAI;
  protected config: AgentConfig;
  protected responseCache: Map<string, CachedResponse>;
  private readonly defaultCacheTTL = 5 * 60 * 1000; // 5 minutes default

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
    setInterval(() => this.cleanupExpiredCache(), 10 * 60 * 1000);
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
    // Check cache first if enabled
    if (this.config.cacheEnabled) {
      const cacheKey = this.generateCacheKey(messages, options);
      const cached = this.responseCache.get(cacheKey);

      if (cached && this.isCacheValid(cached)) {
        console.log(`[${this.config.name}] Cache hit for request`);
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

      const agentResponse: AgentResponse = {
        content,
        metadata: {
          agent: this.config.name,
          timestamp: new Date().toISOString(),
          tokensUsed: "usage" in response ? response.usage?.total_tokens : undefined,
          model: "model" in response ? response.model : undefined,
          fromCache: false,
        },
      };

      // Cache the response if caching is enabled
      if (this.config.cacheEnabled) {
        const cacheKey = this.generateCacheKey(messages, options);
        const now = Date.now();
        this.responseCache.set(cacheKey, {
          response: agentResponse,
          timestamp: now,
          expiresAt: now + (this.config.cacheTTL || this.defaultCacheTTL),
        });
        console.log(
          `[${this.config.name}] Response cached for ${this.config.cacheTTL || this.defaultCacheTTL}ms`
        );
      }

      return agentResponse;
    } catch (error) {
      console.error(`[${this.config.name}] OpenAI API error:`, error);
      throw new Error(`Agent ${this.config.name} failed: ${error}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async process(_input: string, _context?: Record<string, unknown>): Promise<AgentResponse> {
    throw new Error("Process method must be implemented by subclass");
  }
}
