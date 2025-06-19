Remembering...# MEXC Sniper Bot Optimization - Product Requirements Document & Implementation Guide

## Executive Summary

This PRD outlines the implementation of advanced optimizations for the MEXC Sniper Bot, a cryptocurrency token launch detection system. The optimization focuses on integrating AI-powered intelligence, real-time data streams, and enhanced pattern detection to achieve superior trading performance.

## Project Overview

### Current State
- Multi-agent system with 9 specialized agents
- Pattern detection achieving 3.5+ hour advance notice
- PostgreSQL storage with pattern embeddings
- 85%+ confidence threshold for trading decisions

### Target State
- AI-enhanced confidence scoring with Gemini 2.5 Flash and Perplexity Sonar
- Real-time WebSocket data streams replacing polling
- Activity API integration for promotional signal detection
- 10-15% improvement in prediction accuracy
- <100ms execution latency

## Technology Stack

- **Runtime**: Bun 1.1.38+
- **Language**: TypeScript 5.0+
- **Database**: PostgreSQL 14+ with pgvector
- **Validation**: Zod 3.0+
- **Testing**: Vitest + Playwright
- **Linting**: Biome.js
- **Queue**: Inngest
- **AI Models**: Gemini 2.5 Flash, Perplexity Sonar
- **WebSocket**: MEXC WebSocket API with Protobuf

## Implementation Phases

### Phase 1: Foundation Enhancements (Slices 1-4)
- Activity API Integration
- Data Processing Optimization
- Database Schema Updates
- Configuration Management

### Phase 2: Advanced Pattern Detection (Slices 5-8)
- ML-Enhanced Confidence Scoring
- Real-time WebSocket Integration
- Protobuf Deserialization
- Pattern Similarity Analysis

### Phase 3: AI Intelligence Integration (Slices 9-12)
- Gemini 2.5 Flash Sentiment Analysis
- Perplexity Sonar Contract Intelligence
- Synergistic Confidence Model
- Performance Monitoring

---

# Slice 1: Database Schema and Activity API Types

## What You're Building
Create database schema updates for activity data storage and TypeScript types with Zod validation for the MEXC Activity API.

## Tasks

### 1. Database Migration for Activity Schema
- Complexity: 2
- [ ] Create migration file `001_create_activity_tables.sql`
- [ ] Define `coin_activities` table structure
- [ ] Add indexes for performance
- [ ] Write migration tests
- [ ] Test passes locally

### 2. TypeScript Types and Zod Schemas
- Complexity: 3
- [ ] Create `src/types/activity.types.ts`
- [ ] Define ActivityData interface
- [ ] Create Zod validation schemas
- [ ] Export type guards
- [ ] Write validation tests
- [ ] Test passes locally

### 3. Activity API Client Base
- Complexity: 2
- [ ] Create `src/services/activity/client.ts`
- [ ] Implement base HTTP client with retry logic
- [ ] Add rate limiting (200ms delay)
- [ ] Write unit tests
- [ ] Test passes locally

## Code Example
```typescript
// src/types/activity.types.ts
import { z } from 'zod';

export const ActivityTypeSchema = z.enum([
  'SUN_SHINE',
  'PROMOTION', 
  'LAUNCH_EVENT',
  'TRADING_COMPETITION',
  'AIRDROP'
]);

export const ActivityDataSchema = z.object({
  vcoin_id: z.string(),
  symbol: z.string(),
  activityType: ActivityTypeSchema,
  startTime: z.number(),
  endTime: z.number().optional(),
  description: z.string().optional(),
  priority: z.number().min(0).max(100)
});

export type ActivityData = z.infer<typeof ActivityDataSchema>;
```

## Ready to Merge Checklist
- [ ] All tests pass (`bun test`)
- [ ] Linting passes (`bun run lint`)
- [ ] Build succeeds (`bun run build`)
- [ ] Migration runs successfully
- [ ] Code reviewed by senior dev
- [ ] Feature works as expected

## Quick Research (5-10 minutes)
**Official Docs:** 
- [PostgreSQL JSON Types](https://www.postgresql.org/docs/current/datatype-json.html)
- [Zod Documentation](https://zod.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

## Need to Go Deeper?
**Research Prompt:**
*"I'm building a database schema for storing cryptocurrency promotional activity data with TypeScript and Zod validation. What are the key considerations for schema design, indexing strategies for time-series data, and best practices for type-safe API integration? Please explain like I'm a junior developer."*

## Questions for Senior Dev
- [ ] Should we use JSONB for flexible activity metadata?
- [ ] Do we need composite indexes for vcoin_id + activityType?
- [ ] Should activity scores be pre-calculated or computed on-demand?

---

# Slice 2: Activity API Integration

## What You're Building
Implement the complete Activity API integration with batch fetching, caching, and database persistence.

## Tasks

### 1. Activity API Service Implementation
- Complexity: 4
- [ ] Create `src/services/activity/service.ts`
- [ ] Implement `getActivityData()` method
- [ ] Implement `getBulkActivityData()` with batching
- [ ] Add caching layer
- [ ] Write integration tests
- [ ] Test passes locally

**Subtasks for complexity > 3:**
- **Subtask 1.1:** Implement single activity fetch - Complexity: 2
- **Subtask 1.2:** Add batch processing logic - Complexity: 2
- **Subtask 1.3:** Integrate caching mechanism - Complexity: 2

### 2. Database Repository Layer
- Complexity: 3
- [ ] Create `src/repositories/activity.repository.ts`
- [ ] Implement CRUD operations
- [ ] Add bulk insert/update methods
- [ ] Handle conflicts (upsert)
- [ ] Write repository tests
- [ ] Test passes locally

### 3. Activity Enhancement Logic
- Complexity: 3
- [ ] Create `src/services/activity/enhancer.ts`
- [ ] Calculate confidence boosts per activity type
- [ ] Implement multiple activity bonus logic
- [ ] Add recency scoring
- [ ] Write unit tests
- [ ] Test passes locally

## Code Example
```typescript
// src/services/activity/service.ts
export class ActivityService {
  constructor(
    private client: ActivityAPIClient,
    private repository: ActivityRepository,
    private cache: CacheService
  ) {}

  async getBulkActivityData(
    symbols: string[], 
    options: { batchSize?: number } = {}
  ): Promise<ActivityData[]> {
    const { batchSize = 50 } = options;
    const results: ActivityData[] = [];
    
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const activities = await this.fetchBatchWithCache(batch);
      results.push(...activities);
      
      // Rate limiting
      if (i + batchSize < symbols.length) {
        await sleep(200); // 200ms delay
      }
    }
    
    return results;
  }
}
```

## Ready to Merge Checklist
- [ ] All tests pass (`bun test`)
- [ ] Linting passes (`bun run lint`)
- [ ] Build succeeds (`bun run build`)
- [ ] API integration tested with real endpoint
- [ ] Caching verified working
- [ ] Code reviewed by senior dev

## Quick Research (5-10 minutes)
**Official Docs:**
- [MEXC API Documentation](https://mexcdevelop.github.io/apidocs/spot_v3_en/)
- [Node.js Caching Strategies](https://blog.logrocket.com/caching-strategies-in-node-js/)

## Need to Go Deeper?
**Research Prompt:**
*"I'm implementing a batch API fetching service with rate limiting and caching for a cryptocurrency trading bot. What are the best practices for handling API rate limits, implementing exponential backoff, and designing an efficient caching strategy? Consider both memory and Redis caching options."*

## Questions for Senior Dev
- [ ] Should we use Redis or in-memory caching?
- [ ] What's the optimal batch size for the Activity API?
- [ ] How should we handle API errors in batch processing?

---

# Slice 3: Incremental Data Processor

## What You're Building
Implement an incremental data processing system that only processes changed symbols to optimize performance.

## Tasks

### 1. Change Detection System
- Complexity: 3
- [ ] Create `src/services/processing/change-detector.ts`
- [ ] Implement symbol change detection logic
- [ ] Track last processed timestamps
- [ ] Handle initial sync scenario
- [ ] Write unit tests
- [ ] Test passes locally

### 2. Incremental Processor Implementation
- Complexity: 4
- [ ] Create `src/services/processing/incremental-processor.ts`
- [ ] Process only changed symbols
- [ ] Update pattern embeddings incrementally
- [ ] Maintain processing state
- [ ] Write integration tests
- [ ] Test passes locally

**Subtasks for complexity > 3:**
- **Subtask 2.1:** Build delta calculation logic - Complexity: 2
- **Subtask 2.2:** Implement state persistence - Complexity: 2
- **Subtask 2.3:** Add error recovery mechanism - Complexity: 2

### 3. Database Optimization
- Complexity: 2
- [ ] Add timestamp indexes
- [ ] Create materialized views for common queries
- [ ] Optimize update queries
- [ ] Write performance tests
- [ ] Test passes locally

## Code Example
```typescript
// src/services/processing/incremental-processor.ts
export class IncrementalDataProcessor {
  async processChangedSymbols(
    symbols: SymbolV2Entry[],
    lastProcessedTime: Date
  ): Promise<ProcessingResult> {
    const changeDetector = new ChangeDetector();
    const changedSymbols = await changeDetector.detectChanges(
      symbols,
      lastProcessedTime
    );
    
    if (changedSymbols.length === 0) {
      return { processed: 0, skipped: symbols.length };
    }
    
    const results = await Promise.all(
      changedSymbols.map(symbol => this.processSymbol(symbol))
    );
    
    await this.updateLastProcessedTime(new Date());
    
    return {
      processed: results.length,
      skipped: symbols.length - results.length,
      changes: results
    };
  }
}
```

## Ready to Merge Checklist
- [ ] All tests pass (`bun test`)
- [ ] Performance tests show improvement
- [ ] Database queries optimized
- [ ] Change detection accuracy verified
- [ ] Code reviewed by senior dev
- [ ] Feature works as expected

## Quick Research (5-10 minutes)
**Official Docs:**
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Change Data Capture Patterns](https://debezium.io/documentation/reference/stable/connectors/postgresql.html)

## Need to Go Deeper?
**Research Prompt:**
*"I'm building an incremental data processing system for a trading bot that needs to detect and process only changed cryptocurrency symbols. What are the best practices for change detection, maintaining processing state, and handling edge cases like missed updates or system restarts?"*

## Questions for Senior Dev
- [ ] Should we use database triggers for change tracking?
- [ ] How do we handle symbols that appear/disappear?
- [ ] What's the recovery strategy for processing failures?

---

# Slice 4: Predictive Cache Manager

## What You're Building
Create a predictive caching system that precomputes order parameters for high-confidence trading targets.

## Tasks

### 1. Cache Manager Core
- Complexity: 3
- [ ] Create `src/services/cache/predictive-cache-manager.ts`
- [ ] Implement cache storage interface
- [ ] Add TTL management
- [ ] Create cache invalidation logic
- [ ] Write unit tests
- [ ] Test passes locally

### 2. Order Parameter Precomputation
- Complexity: 4
- [ ] Create `src/services/trading/order-calculator.ts`
- [ ] Calculate optimal position sizes
- [ ] Determine order types (market/limit)
- [ ] Compute slippage protection
- [ ] Write calculation tests
- [ ] Test passes locally

**Subtasks for complexity > 3:**
- **Subtask 2.1:** Position size calculator - Complexity: 2
- **Subtask 2.2:** Slippage estimator - Complexity: 2
- **Subtask 2.3:** Order type selector - Complexity: 1

### 3. Cache Warming Strategy
- Complexity: 3
- [ ] Implement predictive cache warming
- [ ] Prioritize by confidence and time to launch
- [ ] Add background refresh logic
- [ ] Monitor cache hit rates
- [ ] Write integration tests
- [ ] Test passes locally

## Code Example
```typescript
// src/services/cache/predictive-cache-manager.ts
export class PredictiveCacheManager {
  private cache = new Map<string, CachedOrderParams>();
  
  async precomputeOrderParams(
    target: SnipeTarget
  ): Promise<void> {
    if (!this.shouldCache(target)) return;
    
    const params: OrderParams = {
      symbol: target.symbol,
      side: 'BUY',
      type: this.determineOrderType(target),
      quantity: await this.calculateOptimalQuantity(target),
      price: await this.estimateEntryPrice(target),
      slippage: this.calculateSlippageProtection(target),
      timestamp: Date.now(),
      ttl: this.calculateTTL(target)
    };
    
    this.cache.set(target.symbol, params);
  }
  
  private shouldCache(target: SnipeTarget): boolean {
    return target.confidence >= 80 && 
           target.advanceHours <= 1;
  }
}
```

## Ready to Merge Checklist
- [ ] All tests pass (`bun test`)
- [ ] Cache hit rate > 90% in tests
- [ ] Memory usage within limits
- [ ] TTL management working correctly
- [ ] Code reviewed by senior dev
- [ ] Performance benchmarks met

## Quick Research (5-10 minutes)
**Official Docs:**
- [Caching Best Practices](https://aws.amazon.com/caching/best-practices/)
- [Trading Order Types](https://www.investopedia.com/terms/o/order.asp)

## Need to Go Deeper?
**Research Prompt:**
*"I'm building a predictive cache for a cryptocurrency trading bot that needs to precompute order parameters. What are the key considerations for cache warming strategies, TTL calculation based on market volatility, and memory-efficient storage of trading parameters?"*

## Questions for Senior Dev
- [ ] What's the maximum cache size we should maintain?
- [ ] How do we handle cache misses during execution?
- [ ] Should we persist cache to disk for recovery?

---

# Slice 5: WebSocket Integration Foundation

## What You're Building
Implement the WebSocket connection manager with Protobuf support for real-time MEXC data streams.

## Tasks

### 1. Protobuf Setup and Code Generation
- Complexity: 3
- [ ] Download .proto files from MEXC GitHub
- [ ] Set up protoc compiler
- [ ] Generate TypeScript definitions
- [ ] Create type wrappers
- [ ] Write type tests
- [ ] Test passes locally

### 2. WebSocket Connection Manager
- Complexity: 4
- [ ] Create `src/services/websocket/connection-manager.ts`
- [ ] Implement connection with retry logic
- [ ] Handle 30-subscription limit per connection
- [ ] Add heartbeat/ping mechanism
- [ ] Write connection tests
- [ ] Test passes locally

**Subtasks for complexity > 3:**
- **Subtask 2.1:** Basic WebSocket client - Complexity: 2
- **Subtask 2.2:** Reconnection logic - Complexity: 2
- **Subtask 2.3:** Multi-connection management - Complexity: 2

### 3. Protobuf Message Handler
- Complexity: 3
- [ ] Create `src/services/websocket/protobuf-handler.ts`
- [ ] Implement message deserialization
- [ ] Handle PushDataV3ApiWrapper
- [ ] Add error handling for malformed messages
- [ ] Write deserialization tests
- [ ] Test passes locally

## Code Example
```typescript
// src/services/websocket/connection-manager.ts
export class WebSocketConnectionManager {
  private connections: Map<string, WebSocket> = new Map();
  private subscriptionCount: Map<string, number> = new Map();
  
  async subscribe(
    symbol: string, 
    stream: StreamType
  ): Promise<void> {
    const connection = await this.getOrCreateConnection();
    const message = this.buildSubscribeMessage(symbol, stream);
    
    connection.send(message);
    this.incrementSubscriptionCount(connection);
    
    // Handle 30 subscription limit
    if (this.getSubscriptionCount(connection) >= 30) {
      this.connections.delete(connection.url);
    }
  }
  
  private async getOrCreateConnection(): Promise<WebSocket> {
    for (const [url, ws] of this.connections) {
      if (this.getSubscriptionCount(ws) < 30) {
        return ws;
      }
    }
    
    return this.createNewConnection();
  }
}
```

## Ready to Merge Checklist
- [ ] Protobuf generation successful
- [ ] WebSocket connects to MEXC
- [ ] Message deserialization working
- [ ] Reconnection logic tested
- [ ] All tests pass (`bun test`)
- [ ] Code reviewed by senior dev

## Quick Research (5-10 minutes)
**Official Docs:**
- [MEXC WebSocket Documentation](https://mexcdevelop.github.io/apidocs/spot_v3_en/#websocket-market-streams)
- [Protocol Buffers Guide](https://protobuf.dev/programming-guides/proto3/)
- [WebSocket MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

## Need to Go Deeper?
**Research Prompt:**
*"I'm implementing WebSocket connections with Protocol Buffers for a cryptocurrency exchange API. What are the best practices for handling reconnection, managing multiple connections with subscription limits, and efficiently deserializing protobuf messages in TypeScript?"*

## Questions for Senior Dev
- [ ] How should we handle WebSocket rate limits?
- [ ] What's the strategy for connection pooling?
- [ ] Should we implement message queuing for reliability?

---

# Slice 6: Real-Time Pattern Monitor

## What You're Building
Create a real-time pattern monitoring system that processes WebSocket updates and triggers immediate actions.

## Tasks

### 1. Stream Subscription Manager
- Complexity: 3
- [ ] Create `src/services/realtime/stream-manager.ts`
- [ ] Implement Book Ticker stream subscription
- [ ] Add Diff Depth stream handling
- [ ] Manage Trade stream subscriptions
- [ ] Write subscription tests
- [ ] Test passes locally

### 2. Real-Time Pattern Detector
- Complexity: 4
- [ ] Create `src/services/realtime/pattern-monitor.ts`
- [ ] Process real-time price updates
- [ ] Detect ready state transitions
- [ ] Update confidence scores dynamically
- [ ] Write pattern detection tests
- [ ] Test passes locally

**Subtasks for complexity > 3:**
- **Subtask 2.1:** Price change detector - Complexity: 2
- **Subtask 2.2:** Pattern state machine - Complexity: 2
- **Subtask 2.3:** Confidence recalculation - Complexity: 2

### 3. Event-Driven Execution Trigger
- Complexity: 3
- [ ] Create `src/services/realtime/execution-trigger.ts`
- [ ] Replace polling with event-driven model
- [ ] Implement immediate order placement
- [ ] Add execution confirmation
- [ ] Write execution tests
- [ ] Test passes locally

## Code Example
```typescript
// src/services/realtime/pattern-monitor.ts
export class RealTimePatternMonitor {
  private patterns = new Map<string, PatternState>();
  
  async processRealTimeUpdate(
    update: MarketUpdate
  ): Promise<void> {
    const pattern = this.patterns.get(update.symbol);
    if (!pattern) return;
    
    // Update pattern state
    const newState = this.calculateNewState(pattern, update);
    
    // Check for ready state transition
    if (this.isReadyStateTransition(pattern, newState)) {
      await this.triggerExecution(update.symbol, newState);
    }
    
    // Update confidence dynamically
    const confidence = await this.recalculateConfidence(
      newState, 
      update
    );
    
    await this.updateTargetConfidence(update.symbol, confidence);
  }
}
```

## Ready to Merge Checklist
- [ ] All WebSocket streams working
- [ ] Pattern detection < 100ms
- [ ] Event triggers firing correctly
- [ ] No missed state transitions
- [ ] All tests pass (`bun test`)
- [ ] Performance metrics met

## Quick Research (5-10 minutes)
**Official Docs:**
- [Event-Driven Architecture](https://martinfowler.com/articles/201701-event-driven.html)
- [Real-time Data Processing](https://www.confluent.io/learn/real-time-data-processing/)

## Need to Go Deeper?
**Research Prompt:**
*"I'm building a real-time pattern detection system for cryptocurrency trading that processes WebSocket market data streams. What are the best practices for state management, ensuring no missed events, and maintaining sub-100ms latency from data receipt to action?"*

## Questions for Senior Dev
- [ ] How do we handle out-of-order messages?
- [ ] What's the failover strategy for missed events?
- [ ] Should we implement event sourcing?

---

# Slice 7: ML-Enhanced Pattern Detection Base

## What You're Building
Implement the foundation for machine learning enhanced pattern detection with vector similarity search.

## Tasks

### 1. Pattern Embedding Generator
- Complexity: 3
- [ ] Create `src/services/ml/embedding-generator.ts`
- [ ] Convert patterns to vector embeddings
- [ ] Normalize embedding dimensions
- [ ] Store in pgvector
- [ ] Write embedding tests
- [ ] Test passes locally

### 2. Vector Similarity Search
- Complexity: 4
- [ ] Create `src/services/ml/similarity-search.ts`
- [ ] Implement cosine similarity calculation
- [ ] Add k-nearest neighbor search
- [ ] Create similarity threshold logic
- [ ] Write search tests
- [ ] Test passes locally

**Subtasks for complexity > 3:**
- **Subtask 2.1:** Vector database queries - Complexity: 2
- **Subtask 2.2:** Similarity scoring - Complexity: 2
- **Subtask 2.3:** Result ranking - Complexity: 1

### 3. Historical Success Rate Calculator
- Complexity: 2
- [ ] Create `src/services/ml/success-calculator.ts`
- [ ] Query historical pattern outcomes
- [ ] Calculate weighted success rates
- [ ] Handle edge cases (new patterns)
- [ ] Write calculation tests
- [ ] Test passes locally

## Code Example
```typescript
// src/services/ml/similarity-search.ts
export class PatternSimilaritySearch {
  async findSimilarPatterns(
    pattern: PatternEmbedding,
    options: SearchOptions = {}
  ): Promise<SimilarPattern[]> {
    const { limit = 10, threshold = 0.8 } = options;
    
    // Use pgvector for efficient similarity search
    const query = `
      SELECT 
        pattern_id,
        embedding,
        success_rate,
        1 - (embedding <=> $1::vector) as similarity
      FROM pattern_embeddings
      WHERE 1 - (embedding <=> $1::vector) > $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `;
    
    const results = await this.db.query(query, [
      pattern.embedding,
      threshold,
      limit
    ]);
    
    return results.map(this.mapToSimilarPattern);
  }
}
```

## Ready to Merge Checklist
- [ ] Vector embeddings generating correctly
- [ ] Similarity search returning relevant results
- [ ] pgvector queries optimized
- [ ] Success rates calculating accurately
- [ ] All tests pass (`bun test`)
- [ ] Performance benchmarks met

## Quick Research (5-10 minutes)
**Official Docs:**
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Vector Similarity Search](https://www.pinecone.io/learn/vector-similarity/)
- [ML Embeddings Guide](https://developers.google.com/machine-learning/crash-course/embeddings/video-lecture)

## Need to Go Deeper?
**Research Prompt:**
*"I'm implementing vector similarity search for pattern matching in a trading bot using PostgreSQL pgvector. What are the best practices for generating embeddings from trading patterns, choosing embedding dimensions, and optimizing similarity queries for real-time performance?"*

## Questions for Senior Dev
- [ ] What embedding dimension should we use?
- [ ] How often should we retrain embeddings?
- [ ] Should we use approximate nearest neighbor search?

---

# Slice 8: ML Confidence Enhancement

## What You're Building
Integrate ML-based pattern similarity into the confidence scoring system.

## Tasks

### 1. ML-Enhanced Confidence Calculator
- Complexity: 3
- [ ] Create `src/services/ml/enhanced-confidence.ts`
- [ ] Integrate similarity scores
- [ ] Weight historical success rates
- [ ] Combine with base confidence
- [ ] Write calculation tests
- [ ] Test passes locally

### 2. Dynamic Weight Optimization
- Complexity: 4
- [ ] Implement weight learning system
- [ ] Track prediction outcomes
- [ ] Adjust weights based on performance
- [ ] Add A/B testing capability
- [ ] Write optimization tests
- [ ] Test passes locally

**Subtasks for complexity > 3:**
- **Subtask 2.1:** Outcome tracking system - Complexity: 2
- **Subtask 2.2:** Weight adjustment algorithm - Complexity: 2
- **Subtask 2.3:** A/B test framework - Complexity: 2

### 3. Confidence Score Monitoring
- Complexity: 2
- [ ] Create confidence metrics dashboard
- [ ] Track score distributions
- [ ] Monitor prediction accuracy
- [ ] Add alerting for anomalies
- [ ] Write monitoring tests
- [ ] Test passes locally

## Code Example
```typescript
// src/services/ml/enhanced-confidence.ts
export class MLEnhancedConfidenceCalculator {
  calculateEnhancedConfidence(
    baseConfidence: number,
    pattern: Pattern,
    similarPatterns: SimilarPattern[]
  ): EnhancedConfidence {
    // Calculate pattern similarity component
    const similarityScore = this.calculateSimilarityScore(
      similarPatterns
    );
    
    // Weight historical success rates
    const historicalScore = this.weightHistoricalSuccess(
      similarPatterns
    );
    
    // Dynamic weight application
    const weights = this.getOptimizedWeights();
    
    const mlConfidence = 
      weights.base * baseConfidence +
      weights.similarity * similarityScore +
      weights.historical * historicalScore;
    
    return {
      score: Math.min(mlConfidence, 95),
      components: {
        base: baseConfidence,
        similarity: similarityScore,
        historical: historicalScore
      },
      weights
    };
  }
}
```

## Ready to Merge Checklist
- [ ] ML confidence calculating correctly
- [ ] Weight optimization working
- [ ] A/B testing framework functional
- [ ] Monitoring dashboard operational
- [ ] All tests pass (`bun test`)
- [ ] Accuracy improvements verified

## Quick Research (5-10 minutes)
**Official Docs:**
- [A/B Testing Best Practices](https://www.optimizely.com/optimization-glossary/ab-testing/)
- [ML Model Monitoring](https://www.evidentlyai.com/ml-model-monitoring)

## Need to Go Deeper?
**Research Prompt:**
*"I'm enhancing a confidence scoring system with machine learning components for a trading bot. What are the best practices for combining rule-based and ML scores, implementing online learning for weight optimization, and monitoring model drift in production?"*

## Questions for Senior Dev
- [ ] Should we implement online or batch weight updates?
- [ ] What's our strategy for handling model drift?
- [ ] How do we validate ML improvements?

---

# Slice 9: Gemini 2.5 Flash Integration

## What You're Building
Integrate Gemini 2.5 Flash for real-time sentiment analysis and news filtering.

## Tasks

### 1. Gemini API Client Setup
- Complexity: 2
- [ ] Create `src/services/ai/gemini-client.ts`
- [ ] Configure API authentication
- [ ] Implement rate limiting
- [ ] Add error handling
- [ ] Write client tests
- [ ] Test passes locally

### 2. News and Social Media Aggregator
- Complexity: 4
- [ ] Create `src/services/sentiment/data-aggregator.ts`
- [ ] Integrate news APIs
- [ ] Connect social media sources
- [ ] Implement data filtering
- [ ] Write aggregation tests
- [ ] Test passes locally

**Subtasks for complexity > 3:**
- **Subtask 2.1:** News API integration - Complexity: 2
- **Subtask 2.2:** Twitter/Reddit connectors - Complexity: 2
- **Subtask 2.3:** Data deduplication - Complexity: 1

### 3. Sentiment Analysis Pipeline
- Complexity: 3
- [ ] Create `src/services/sentiment/analyzer.ts`
- [ ] Implement prompt engineering
- [ ] Process with Gemini 2.5 Flash
- [ ] Extract sentiment scores
- [ ] Write analysis tests
- [ ] Test passes locally

## Code Example
```typescript
// src/services/sentiment/analyzer.ts
export class GeminiSentimentAnalyzer {
  async analyzeSentiment(
    symbol: string,
    sources: DataSource[]
  ): Promise<SentimentScore> {
    const prompt = this.buildAnalysisPrompt(symbol, sources);
    
    const response = await this.geminiClient.generate({
      model: 'gemini-2.5-flash',
      prompt,
      maxTokens: 500,
      temperature: 0.3,
      systemPrompt: SENTIMENT_ANALYSIS_SYSTEM_PROMPT
    });
    
    const sentiment = this.parseSentimentResponse(response);
    
    return {
      symbol,
      score: sentiment.score,
      confidence: sentiment.confidence,
      signals: sentiment.signals,
      sources: sources.length,
      timestamp: Date.now()
    };
  }
}
```

## Ready to Merge Checklist
- [ ] Gemini API connected successfully
- [ ] Data aggregation working
- [ ] Sentiment scores generating
- [ ] Response time < 2 seconds
- [ ] All tests pass (`bun test`)
- [ ] API costs within budget

## Quick Research (5-10 minutes)
**Official Docs:**
- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Prompt Engineering Guide](https://developers.google.com/machine-learning/resources/prompt-eng)
- [News API Documentation](https://newsapi.org/docs)

## Need to Go Deeper?
**Research Prompt:**
*"I'm integrating Gemini 2.5 Flash for real-time sentiment analysis of cryptocurrency news and social media. What are the best practices for prompt engineering for financial sentiment, handling API rate limits, and aggregating data from multiple sources efficiently?"*

## Questions for Senior Dev
- [ ] What's our budget for Gemini API calls?
- [ ] Which news/social sources should we prioritize?
- [ ] How do we handle API downtime?

---

# Slice 10: Perplexity Sonar Contract Intelligence

## What You're Building
Implement Perplexity Sonar integration for deep contract analysis and cross-chain intelligence.

## Tasks

### 1. Perplexity API Client
- Complexity: 2
- [ ] Create `src/services/ai/perplexity-client.ts`
- [ ] Set up authentication
- [ ] Implement query builder
- [ ] Add response parser
- [ ] Write client tests
- [ ] Test passes locally

### 2. Contract Intelligence Service
- Complexity: 4
- [ ] Create `src/services/intelligence/contract-analyzer.ts`
- [ ] Query audit databases
- [ ] Check cross-chain presence
- [ ] Analyze liquidity history
- [ ] Write analysis tests
- [ ] Test passes locally

**Subtasks for complexity > 3:**
- **Subtask 2.1:** Audit verification queries - Complexity: 2
- **Subtask 2.2:** Cross-chain detection - Complexity: 2
- **Subtask 2.3:** Liquidity analysis - Complexity: 2

### 3. Risk Assessment Engine
- Complexity: 3
- [ ] Create `src/services/intelligence/risk-assessor.ts`
- [ ] Calculate risk scores
- [ ] Identify red flags
- [ ] Generate risk reports
- [ ] Write assessment tests
- [ ] Test passes locally

## Code Example
```typescript
// src/services/intelligence/contract-analyzer.ts
export class ContractIntelligenceAnalyzer {
  async analyzeContract(
    address: string,
    chain: string = 'BSC'
  ): Promise<ContractIntelligence> {
    // Query for audit status
    const auditQuery = `
      Contract ${address} on ${chain} 
      audit status CertiK PeckShield SlowMist
      vulnerabilities exploits
    `;
    
    const auditData = await this.perplexity.search({
      query: auditQuery,
      searchDepth: 'deep',
      includeAnswer: true,
      includeSources: true
    });
    
    // Check cross-chain presence
    const crossChainData = await this.checkCrossChainPresence(
      address
    );
    
    // Analyze liquidity
    const liquidityData = await this.analyzeLiquidity(
      address, 
      chain
    );
    
    return {
      address,
      chain,
      audit: this.parseAuditData(auditData),
      crossChain: crossChainData,
      liquidity: liquidityData,
      riskScore: this.calculateRiskScore(
        auditData, 
        crossChainData, 
        liquidityData
      )
    };
  }
}
```

## Ready to Merge Checklist
- [ ] Perplexity API integrated
- [ ] Contract analysis working
- [ ] Risk scores calculating
- [ ] Cross-chain detection accurate
- [ ] All tests pass (`bun test`)
- [ ] Intelligence data quality verified

## Quick Research (5-10 minutes)
**Official Docs:**
- [Perplexity API Documentation](https://docs.perplexity.ai/)
- [DeFiLlama API](https://defillama.com/docs/api)
- [Blockchain Explorer APIs](https://docs.etherscan.io/)

## Need to Go Deeper?
**Research Prompt:**
*"I'm building a contract intelligence system using Perplexity Sonar for a crypto trading bot. What are the key indicators of contract legitimacy, best practices for cross-chain verification, and methods for assessing liquidity depth across decentralized exchanges?"*

## Questions for Senior Dev
- [ ] Which audit firms should we prioritize?
- [ ] What risk score threshold should trigger alerts?
- [ ] How do we handle new chains?

---

# Slice 11: Synergistic AI Confidence Model

## What You're Building
Combine Gemini sentiment and Perplexity intelligence into a unified confidence scoring system.

## Tasks

### 1. AI Score Aggregator
- Complexity: 3
- [ ] Create `src/services/ai/score-aggregator.ts`
- [ ] Combine sentiment scores
- [ ] Integrate contract intelligence
- [ ] Normalize score ranges
- [ ] Write aggregation tests
- [ ] Test passes locally

### 2. Weighted Confidence Calculator
- Complexity: 4
- [ ] Create `src/services/confidence/ai-enhanced-calculator.ts`
- [ ] Implement dynamic weighting
- [ ] Add confidence components
- [ ] Create explanation system
- [ ] Write calculation tests
- [ ] Test passes locally

**Subtasks for complexity > 3:**
- **Subtask 2.1:** Weight optimization logic - Complexity: 2
- **Subtask 2.2:** Component breakdown - Complexity: 1
- **Subtask 2.3:** Explanation generator - Complexity: 2

### 3. Confidence Monitoring Dashboard
- Complexity: 3
- [ ] Create monitoring endpoints
- [ ] Track AI contribution impact
- [ ] Visualize score distributions
- [ ] Add performance metrics
- [ ] Write dashboard tests
- [ ] Test passes locally

## Code Example
```typescript
// src/services/confidence/ai-enhanced-calculator.ts
export class AIEnhancedConfidenceCalculator {
  calculateSynergisticConfidence(
    inputs: ConfidenceInputs
  ): SynergisticConfidence {
    const components = {
      base: inputs.basePattern.confidence,
      patternSimilarity: inputs.mlScore,
      sentiment: inputs.geminiSentiment,
      contractIntelligence: inputs.perplexityScore,
      activityBoost: inputs.activityScore,
      marketTiming: inputs.marketConditions
    };
    
    // Dynamic weights based on historical performance
    const weights = this.optimizer.getCurrentWeights();
    
    const weightedScore = Object.entries(components).reduce(
      (sum, [key, value]) => sum + weights[key] * value,
      0
    );
    
    const explanation = this.generateExplanation(
      components,
      weights
    );
    
    return {
      score: Math.min(weightedScore, 95),
      components,
      weights,
      explanation,
      confidence_level: this.getConfidenceLevel(weightedScore)
    };
  }
}
```

## Ready to Merge Checklist
- [ ] All AI scores integrating correctly
- [ ] Weighted calculations accurate
- [ ] Explanation system clear
- [ ] Dashboard displaying metrics
- [ ] All tests pass (`bun test`)
- [ ] Performance improvements verified

## Quick Research (5-10 minutes)
**Official Docs:**
- [Ensemble Methods in ML](https://scikit-learn.org/stable/modules/ensemble.html)
- [Multi-Criteria Decision Making](https://en.wikipedia.org/wiki/Multi-criteria_decision_analysis)

## Need to Go Deeper?
**Research Prompt:**
*"I'm building a synergistic confidence scoring system that combines multiple AI models (sentiment analysis, contract intelligence, pattern matching). What are the best practices for weight optimization, handling missing components, and providing explainable scores for trading decisions?"*

## Questions for Senior Dev
- [ ] How do we handle partial AI failures?
- [ ] What's the minimum component threshold?
- [ ] Should we implement fallback strategies?

---

# Slice 12: Performance Monitoring and Optimization

## What You're Building
Implement comprehensive performance monitoring and system optimization tools.

## Tasks

### 1. Metrics Collection System
- Complexity: 3
- [ ] Create `src/monitoring/metrics-collector.ts`
- [ ] Track latency metrics
- [ ] Monitor API usage
- [ ] Collect success rates
- [ ] Write collection tests
- [ ] Test passes locally

### 2. Performance Dashboard
- Complexity: 3
- [ ] Create `src/monitoring/dashboard.ts`
- [ ] Visualize key metrics
- [ ] Add real-time updates
- [ ] Implement alerting
- [ ] Write dashboard tests
- [ ] Test passes locally

### 3. Cost Optimization Engine
- Complexity: 4
- [ ] Create `src/monitoring/cost-optimizer.ts`
- [ ] Track AI API costs
- [ ] Implement usage throttling
- [ ] Optimize batch sizes
- [ ] Write optimization tests
- [ ] Test passes locally

**Subtasks for complexity > 3:**
- **Subtask 3.1:** Cost tracking system - Complexity: 2
- **Subtask 3.2:** Throttling algorithms - Complexity: 2
- **Subtask 3.3:** Batch optimization - Complexity: 2

## Code Example
```typescript
// src/monitoring/metrics-collector.ts
export class MetricsCollector {
  private metrics: MetricsStore;
  
  async trackExecution(
    execution: ExecutionMetrics
  ): Promise<void> {
    // Track end-to-end latency
    const latency = {
      patternDetection: execution.patternDetectionMs,
      confidenceCalculation: execution.confidenceMs,
      orderPreparation: execution.orderPrepMs,
      execution: execution.executionMs,
      total: execution.totalMs
    };
    
    // Track API usage
    const apiUsage = {
      gemini: execution.geminiCalls,
      perplexity: execution.perplexityCalls,
      mexcRest: execution.mexcRestCalls,
      mexcWebSocket: execution.wsMessages
    };
    
    // Calculate costs
    const costs = this.calculateCosts(apiUsage);
    
    await this.metrics.record({
      timestamp: Date.now(),
      symbol: execution.symbol,
      success: execution.success,
      latency,
      apiUsage,
      costs,
      profitLoss: execution.pnl
    });
  }
}
```

## Ready to Merge Checklist
- [ ] All metrics collecting properly
- [ ] Dashboard showing real-time data
- [ ] Cost tracking accurate
- [ ] Alerts configured
- [ ] All tests pass (`bun test`)
- [ ] System ready for production

## Quick Research (5-10 minutes)
**Official Docs:**
- [Prometheus Metrics](https://prometheus.io/docs/concepts/metric_types/)
- [Grafana Dashboards](https://grafana.com/docs/grafana/latest/dashboards/)
- [Cost Optimization Strategies](https://aws.amazon.com/architecture/cost-optimization/)

## Need to Go Deeper?
**Research Prompt:**
*"I'm building a performance monitoring system for a high-frequency trading bot that uses multiple AI APIs. What are the best practices for tracking microsecond-level latencies, optimizing API costs, and creating actionable alerts for performance degradation?"*

## Questions for Senior Dev
- [ ] What metrics are most critical?
- [ ] What's our latency SLA?
- [ ] How do we handle metric storage at scale?

---

## Implementation Timeline

### Week 1-2: Foundation (Slices 1-4)
- Database schema and Activity API integration
- Incremental processing and predictive caching
- Goal: 50% reduction in processing time

### Week 3-4: Real-time Infrastructure (Slices 5-8)
- WebSocket integration with Protobuf
- ML-enhanced pattern detection
- Goal: <100ms execution latency

### Week 5-6: AI Integration (Slices 9-12)
- Gemini and Perplexity integration
- Synergistic confidence model
- Performance monitoring
- Goal: 10-15% accuracy improvement

## Success Metrics

1. **Pattern Detection Accuracy**: 10-15% improvement
2. **Execution Latency**: <100ms from signal to order
3. **API Cost Efficiency**: <$0.01 per trade analyzed
4. **System Uptime**: 99.9% availability
5. **Profit Improvement**: 20%+ increase in successful trades

## Development Guidelines

### Git Workflow
```bash
# Feature branch naming
git checkout -b feature/slice-1-activity-schema

# Conventional commits
git commit -m "feat(db): add coin_activities table with indexes"
git commit -m "test(activity): add validation tests for ActivitySchema"
git commit -m "docs(api): update Activity API integration guide"

# PR merge
git checkout main
git merge --no-ff feature/slice-1-activity-schema
git push origin main
```

### TDD Flow
1. Write test first (red)
2. Run test - verify failure
3. Implement minimal code to pass
4. Run test - verify success (green)
5. Refactor if needed
6. Commit with conventional message

### Code Quality Standards
- TypeScript strict mode enabled
- 100% type coverage
- Zod validation for all external data
- File size limit: 500 lines
- Test coverage: >80%
- Biome.js formatting on save

Remember: Each slice should be a complete, working feature that adds value to the system!