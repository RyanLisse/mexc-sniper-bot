# Coin Discovery and Monitoring Flow

## Overview

The MEXC Sniper Bot uses a sophisticated multi-agent system with pattern detection and real-time monitoring to discover new coin listings and execute trades at optimal times. The system leverages AI-powered agents, vector embeddings for pattern matching, and WebSocket connections for real-time data.

## Architecture Components

### 1. **Multi-Agent System**

#### Calendar Agent (`src/mexc-agents/calendar-agent.ts`)
- **Purpose**: Discovers new cryptocurrency listings from MEXC calendar
- **Key Features**:
  - Monitors MEXC calendar for new token announcements
  - Calculates advance notice timing (target: 3.5+ hours)
  - Prioritizes listings based on market potential
  - Analyzes launch timing patterns

#### Pattern Discovery Agent (`src/mexc-agents/pattern-discovery-agent.ts`)
- **Purpose**: Detects trading patterns and ready states
- **Key Features**:
  - Primary pattern detection: `sts:2, st:2, tt:4` (symbol ready for trading)
  - Early opportunity identification
  - Pattern validation and confidence scoring
  - Risk assessment integration

#### Symbol Analysis Agent (`src/mexc-agents/symbol-analysis-agent.ts`)
- **Purpose**: Analyzes individual symbols for trading readiness
- **Key Features**:
  - Real-time readiness assessment
  - Market microstructure analysis
  - Risk evaluation and confidence scoring

#### MexcOrchestrator (`src/mexc-agents/orchestrator.ts`)
- **Purpose**: Coordinates multi-agent workflows
- **Key Features**:
  - Workflow management and orchestration
  - Result synthesis from multiple agents
  - Error handling and recovery

### 2. **Database Storage**

#### Monitored Listings Table (`monitored_listings`)
```sql
- vcoinId: Unique coin identifier
- symbolName: Trading symbol
- status: "monitoring", "ready", "launched", "completed", "failed"
- patternSts/St/Tt: Pattern detection values
- hasReadyPattern: Boolean flag for ready state
- confidence: 0-100 confidence score
```

#### Snipe Targets Table (`snipe_targets`)
```sql
- userId: User reference
- vcoinId: Coin identifier
- status: "pending", "ready", "executing", "completed", "failed"
- takeProfitLevel: Exit strategy configuration
- confidenceScore: Pattern confidence
```

#### Pattern Embeddings Table (`pattern_embeddings`)
```sql
- patternId: Unique pattern identifier
- embedding: Vector representation (1536 dimensions)
- patternType: "ready_state", "launch_pattern", etc.
- successRate: Historical performance metric
```

### 3. **Real-Time Monitoring**

#### WebSocket Price Service (`src/services/websocket-price-service.ts`)
- Real-time price feeds from MEXC WebSocket
- Memory-optimized with LRU cache
- Automatic reconnection and heartbeat
- Subscription management for multiple symbols

#### Pattern Sniper Hook (`src/hooks/use-pattern-sniper.ts`)
- React hook for UI integration
- Manages monitoring state and execution
- Auto-execution capabilities
- Integration with user preferences

## Coin Discovery Flow

### Phase 1: Calendar Discovery

1. **Inngest Workflow Trigger** (`pollMexcCalendar`)
   - Scheduled every 5 minutes or manual trigger
   - Executes calendar discovery workflow

2. **Calendar Agent Processing**
   ```typescript
   // Fetches latest calendar data
   const calendarData = await fetchLatestCalendarData();
   
   // Processes and identifies new listings
   const processedListings = preprocessCalendarData(calendarData);
   
   // AI analysis for opportunity assessment
   const aiResponse = await scanForNewListings(processedListings);
   ```

3. **Pattern Discovery Analysis**
   - Extracts pattern indicators from calendar data
   - Classifies project types (DeFi, AI, GameFi, etc.)
   - Assesses market timing and advance notice quality
   - Calculates pattern confidence scores

4. **Database Storage**
   - New listings stored in `monitored_listings` table
   - Initial status: "monitoring"
   - Pattern embeddings generated for similarity matching

### Phase 2: Symbol Monitoring

1. **Symbol Watch Workflow** (`watchMexcSymbol`)
   - Triggered for each new listing discovered
   - Monitors symbol status changes

2. **Ready State Detection**
   ```typescript
   // Target pattern for ready state
   const READY_PATTERN = {
     sts: 2,  // Symbol trading status
     st: 2,   // Symbol state
     tt: 4    // Trading time status
   };
   
   // Validation
   if (symbol.sts === 2 && symbol.st === 2 && symbol.tt === 4) {
     // Symbol is ready for trading
   }
   ```

3. **Pattern Validation**
   - Data quality assessment
   - Infrastructure readiness check
   - Confidence scoring (minimum 85% for READY status)
   - Risk level assessment

### Phase 3: Trading Execution

1. **Ready State Confirmation**
   - Pattern detected and validated
   - Snipe target created in database
   - User preferences loaded (take profit, position size)

2. **Auto-Execution Logic**
   ```typescript
   // Monitors ready targets every second
   const timeUntilLaunch = target.launchTime - Date.now();
   
   // Execute within 5 seconds of launch
   if (timeUntilLaunch <= 0 && timeUntilLaunch > -5000) {
     executeSnipe(target);
   }
   ```

3. **Trade Execution**
   - Market order via MEXC API
   - Position tracking in execution history
   - Auto exit manager activation

### Phase 4: Pattern Learning

1. **Vector Embeddings**
   - Each pattern converted to text description
   - OpenAI embeddings generated (1536 dimensions)
   - Stored for similarity matching

2. **Pattern Performance Tracking**
   ```typescript
   // Update pattern metrics based on results
   await updatePatternPerformance(patternId, {
     success: true,
     profit: 15.5
   });
   ```

3. **Similarity Matching**
   - Find similar historical patterns
   - Predict success probability
   - Adjust confidence scores

## WebSocket Real-Time Updates

1. **Price Monitoring**
   ```typescript
   // Subscribe to symbol price updates
   webSocketService.subscribe(symbol, (priceUpdate) => {
     console.log(`${symbol}: $${priceUpdate.price}`);
   });
   ```

2. **Memory Management**
   - LRU cache limits to 1000 symbols
   - Automatic cleanup of inactive subscriptions
   - Memory monitoring and alerts

## UI Integration

### Coin Listings Board (`src/components/dashboard/coin-listings-board.tsx`)

1. **Status Categories**
   - **Upcoming**: Calendar listings not yet launched
   - **Monitoring**: Checking for ready state pattern
   - **Ready**: Pattern detected, ready to snipe
   - **Executed**: Trades completed

2. **Visual Indicators**
   - Color coding by status
   - Countdown timers to launch
   - Confidence scores
   - Advance notice hours

3. **Actions**
   - Start/Stop monitoring
   - Manual execution
   - Remove targets
   - Force refresh

## Configuration

### User Preferences
- **Default Buy Amount**: USDT position size
- **Take Profit Levels**: 4 configurable levels + custom
- **Auto-Snipe Enabled**: Automatic execution toggle
- **Risk Tolerance**: Low/Medium/High
- **Ready State Pattern**: Configurable pattern values

### Monitoring Intervals
- **Calendar Poll**: 5 minutes (default)
- **Symbol Check**: 30 seconds for active targets
- **WebSocket Heartbeat**: 30 seconds
- **Auto-Execution Check**: 1 second

## Success Metrics

1. **Pattern Detection**
   - Ready state pattern accuracy
   - Advance notice hours achieved
   - False positive rate

2. **Execution Performance**
   - Success rate percentage
   - Average profit per trade
   - Execution latency

3. **System Health**
   - Memory usage and growth rate
   - WebSocket connection stability
   - Agent response times

## Error Handling

1. **Agent Failures**
   - Automatic retry with exponential backoff
   - Fallback to cached data
   - Error logging and alerting

2. **WebSocket Disconnections**
   - Automatic reconnection (max 5 attempts)
   - Resubscription to all symbols
   - Cached price fallback

3. **Pattern Mismatches**
   - Confidence threshold validation
   - Multiple confirmation checks
   - Manual override options

## Best Practices

1. **Optimal Configuration**
   - Enable auto-snipe for best results
   - Set appropriate position sizes
   - Configure multiple take profit levels
   - Monitor system health metrics

2. **Risk Management**
   - Start with small position sizes
   - Use stop loss protection
   - Monitor false positive patterns
   - Review execution history regularly

3. **Performance Optimization**
   - Limit concurrent monitoring targets
   - Clear old executed trades
   - Monitor memory usage
   - Use appropriate polling intervals