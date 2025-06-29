import { beforeEach, describe, expect, it } from 'vitest';
import { type AgentConfig, BaseAgent } from '@/src/mexc-agents/base-agent';

class TestAgent extends BaseAgent {
  private mockCallCount = 0;
  private mockResponse = 'Test response';

  constructor(config: AgentConfig) {
    super(config);
  }

  // Override callOpenAI to avoid actual OpenAI calls
  protected async callOpenAI(messages: any[], options?: any): Promise<any> {
    // Check cache first if enabled (same logic as parent)
    if (this.config.cacheEnabled) {
      const cacheKey = this.generateCacheKey(messages, options);
      const cached = this.responseCache.get(cacheKey);

      if (cached && this.isCacheValid(cached)) {
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

    // Only increment call count if we're actually making a "new" call
    this.mockCallCount++;

    const response = {
      content: `${this.mockResponse} ${this.mockCallCount}`,
      metadata: {
        agent: this.config.name,
        timestamp: new Date().toISOString(),
        tokensUsed: 100,
        model: 'gpt-4o',
        fromCache: false,
      },
    };

    // Cache the response if caching is enabled
    if (this.config.cacheEnabled) {
      const cacheKey = this.generateCacheKey(messages, options);
      const now = Date.now();
      this.responseCache.set(cacheKey, {
        response,
        timestamp: now,
        expiresAt: now + (this.config.cacheTTL || 5 * 60 * 1000),
      });
    }

    return response;
  }

  // Expose protected methods for testing
  public generateCacheKey(messages: any[], options?: any): string {
    return super.generateCacheKey(messages, options);
  }

  public isCacheValid(cached: any): boolean {
    return super.isCacheValid(cached);
  }

  public getResponseCache() {
    return this.responseCache;
  }

  public getCallCount(): number {
    return this.mockCallCount;
  }

  async process(input: string): Promise<any> {
    return this.callOpenAI([{ role: 'user', content: input }]);
  }
}

describe('BaseAgent Caching', () => {
  let agent: TestAgent;

  beforeEach(() => {
    agent = new TestAgent({
      name: 'test-agent',
      systemPrompt: 'You are a test agent',
      cacheEnabled: true,
      cacheTTL: 1000, // 1 second for testing
    });
  });

  it('should cache responses and return cached results', async () => {
    const messages = [{ role: 'user', content: 'Test message' }];

    // First call should create new response
    const response1 = await agent.process('Test message');
    expect(agent.getCallCount()).toBe(1);
    expect(response1.metadata.fromCache).toBe(false);

    // Second call should return cached result
    const response2 = await agent.process('Test message');
    expect(agent.getCallCount()).toBe(1); // Still only 1 call
    expect(response2.metadata.fromCache).toBe(true);
    expect(response2.content).toBe(response1.content);
  });

  it('should respect cache TTL and refresh expired entries', async () => {
    // First call
    await agent.process('Test message');
    expect(agent.getCallCount()).toBe(1);

    // Wait for cache to expire
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Second call should create new response
    await agent.process('Test message');
    expect(agent.getCallCount()).toBe(2);
  });

  it('should allow disabling cache', async () => {
    const agentNoCache = new TestAgent({
      name: 'test-agent-no-cache',
      systemPrompt: 'You are a test agent',
      cacheEnabled: false,
    });

    // Both calls should create new responses
    await agentNoCache.process('Test message');
    await agentNoCache.process('Test message');
    expect(agentNoCache.getCallCount()).toBe(2);
  });

  it('should provide cache statistics', () => {
    const stats = agent.getCacheStats();
    expect(stats).toHaveProperty('size');
    expect(typeof stats.size).toBe('number');
  });

  it('should generate different cache keys for different inputs', async () => {
    // Both calls should create new responses since they have different inputs
    await agent.process('Message 1');
    await agent.process('Message 2');
    expect(agent.getCallCount()).toBe(2);

    // Repeat calls should use cache
    await agent.process('Message 1');
    await agent.process('Message 2');
    expect(agent.getCallCount()).toBe(2); // Still only 2 calls
  });

  it('should generate consistent cache keys for identical inputs', () => {
    const messages = [{ role: 'user', content: 'Test message' }];
    const key1 = agent.generateCacheKey(messages);
    const key2 = agent.generateCacheKey(messages);
    expect(key1).toBe(key2);
  });

  it('should generate different cache keys for different inputs', () => {
    const messages1 = [{ role: 'user', content: 'Message 1' }];
    const messages2 = [{ role: 'user', content: 'Message 2' }];
    const key1 = agent.generateCacheKey(messages1);
    const key2 = agent.generateCacheKey(messages2);
    expect(key1).not.toBe(key2);
  });
});
