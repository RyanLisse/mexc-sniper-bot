# MEXC Sniper Bot - Multi-Agent System Configuration Guide

## Overview

The MEXC Sniper Bot employs a sophisticated 9-agent multi-agent architecture with Inngest workflow orchestration for cryptocurrency trading on the MEXC exchange. This document provides comprehensive configuration guidance for developers working with the agent system.

## Agent Architecture Summary

### Core Trading Agents (5)
1. **MexcApiAgent** - MEXC API interactions and data analysis
2. **PatternDiscoveryAgent** - Ready state pattern detection (`sts:2, st:2, tt:4`)
3. **CalendarAgent** - New listing discovery and monitoring
4. **SymbolAnalysisAgent** - Real-time readiness assessment
5. **StrategyAgent** - AI-powered trading strategy creation

### Safety Agents (4)
6. **SimulationAgent** - Safe testing and validation
7. **RiskManagerAgent** - Risk assessment and circuit breakers
8. **ReconciliationAgent** - Position and balance validation
9. **ErrorRecoveryAgent** - System health and error handling

## Agent Configuration Framework

### Base Agent Configuration

All agents extend the `BaseAgent` class with the following configuration structure:

```typescript
interface AgentConfig {
  name: string;
  model?: string;              // Default: "gpt-4o"
  temperature?: number;        // Default: 0.7
  maxTokens?: number;          // Default: 2000
  systemPrompt: string;        // Agent-specific prompt
  cacheEnabled?: boolean;      // Default: true
  cacheTTL?: number;          // Cache TTL in milliseconds (default: 5 minutes)
}
```

### Caching System

The base agent implements intelligent response caching:

```typescript
// Cache configuration
private readonly defaultCacheTTL = 5 * 60 * 1000; // 5 minutes
private cacheCleanupInterval = 10 * 60 * 1000;   // 10 minutes cleanup

// Cache key generation based on:
// - Agent name and model
// - Temperature and token limits
// - System prompt
// - Message content
// - Additional options
```

## Individual Agent Configurations

### 1. PatternDiscoveryAgent

**Primary Responsibility:** Detection of MEXC ready state patterns

```typescript
const config: AgentConfig = {
  name: "pattern-discovery-agent",
  model: "gpt-4o",
  temperature: 0.2,        // Low temperature for consistent pattern detection
  maxTokens: 3000,
  systemPrompt: `Expert pattern discovery for MEXC exchange...`
}
```

**Key Pattern Detection:**
- **Ready State Pattern**: `sts:2, st:2, tt:4` (immediate trading opportunity)
- **Pre-Ready State**: `sts:1, st:1, tt:1-3` (monitoring phase)
- **Active Trading**: `sts:3, st:3, tt:4` (live market)
- **Suspended**: `sts:4, st:4` (avoid trading)

**Configuration Parameters:**
```typescript
interface PatternAnalysisRequest {
  symbolData?: SymbolData[];
  calendarData?: CalendarEntry[];
  analysisType: "discovery" | "monitoring" | "execution";
  timeframe?: string;
  confidenceThreshold?: number;  // Default: 70
}
```

### 2. MexcApiAgent

**Primary Responsibility:** MEXC API integration and data fetching

```typescript
const config: AgentConfig = {
  name: "mexc-api-agent",
  model: "gpt-4o",
  temperature: 0.3,
  maxTokens: 2500,
  systemPrompt: `MEXC exchange expert for API interactions...`
}
```

**API Integration Points:**
- Calendar data fetching
- Symbol status monitoring
- Market data collection
- Trading pair analysis

### 3. CalendarAgent

**Primary Responsibility:** New listing discovery and launch timing

```typescript
const config: AgentConfig = {
  name: "calendar-agent",
  model: "gpt-4o", 
  temperature: 0.4,
  maxTokens: 2000,
  systemPrompt: `Calendar monitoring specialist...`
}
```

**Monitoring Features:**
- Early opportunity identification (3.5+ hour advance)
- Launch timing optimization
- Market potential assessment
- Project categorization

### 4. SymbolAnalysisAgent

**Primary Responsibility:** Real-time symbol readiness assessment

```typescript
const config: AgentConfig = {
  name: "symbol-analysis-agent",
  model: "gpt-4o",
  temperature: 0.3,
  maxTokens: 2500,
  systemPrompt: `Symbol analysis specialist...`
}
```

**Analysis Capabilities:**
- Market microstructure analysis
- Risk evaluation and confidence scoring
- Data completeness verification
- Timing optimization

### 5. StrategyAgent

**Primary Responsibility:** AI-powered trading strategy creation

```typescript
const config: AgentConfig = {
  name: "strategy-agent",
  model: "gpt-4o",
  temperature: 0.5,
  maxTokens: 3000,
  systemPrompt: `Trading strategy creation expert...`
}
```

## Safety Agent Configurations

### 6. RiskManagerAgent

**Circuit Breaker Configuration:**

```typescript
interface CircuitBreaker {
  id: string;
  name: string;
  type: "loss_limit" | "drawdown" | "position_count" | "volatility" | "exposure";
  threshold: number;
  currentValue: number;
  triggered: boolean;
  severity: "low" | "medium" | "high" | "critical";
  action: "warn" | "halt_new" | "halt_all" | "emergency_exit";
}
```

**Default Risk Thresholds:**
- Max daily loss: $1000 (adjustable for simulation)
- Max position size: $500
- Max open positions: 5
- Max portfolio exposure: 80%
- Volatility threshold: 15%

### 7. SimulationAgent

**Simulation Configuration:**

```typescript
interface SimulationConfig {
  enabled: boolean;
  initialBalance: number;     // Default: $10,000
  maxPositions: number;       // Default: 10
  riskPerTrade: number;       // Default: 2%
  commissionRate: number;     // Default: 0.1%
  slippageRate: number;       // Default: 0.05%
}
```

### 8. ReconciliationAgent

**Position Tracking:**

```typescript
interface BalanceSnapshot {
  timestamp: string;
  totalBalance: number;
  availableBalance: number;
  lockedBalance: number;
  positions: Position[];
  source: "mexc_api" | "internal_tracking";
}
```

### 9. ErrorRecoveryAgent

**System Health Monitoring:**

```typescript
interface SystemHealth {
  overall: "healthy" | "degraded" | "critical";
  components: {
    mexcApi: boolean;
    database: boolean;
    openai: boolean;
    agents: boolean;
  };
  lastCheck: string;
  uptime: number;
}
```

## Workflow Orchestration Configuration

### Inngest Event Mapping

```typescript
export const mexcEvents = {
  calendarPoll: "mexc/calendar.poll.requested",
  symbolWatch: "mexc/symbol.watch.requested", 
  patternAnalysis: "mexc/pattern.analysis.requested",
  tradingStrategy: "mexc/trading.strategy.requested",
} as const;
```

### Workflow Configuration Presets

```typescript
export const mexcWorkflowPresets = {
  calendarDiscovery: {
    trigger: "automated",
    force: false,
  },
  symbolMonitoring: {
    analysisDepth: "standard" as const,
    attempt: 1,
  },
  patternAnalysis: {
    analysisType: "discovery" as const,
    confidenceThreshold: 70,
  },
  tradingStrategy: {
    riskLevel: "medium" as const,
    capital: 1000,
  },
};
```

## Performance Configuration

### Agent Cache Management

```typescript
// Cache statistics monitoring
public getCacheStats(): { size: number; hitRate?: number } {
  return {
    size: this.responseCache.size,
    // Hit rate tracking for performance optimization
  };
}

// Automatic cache cleanup
private cleanupExpiredCache(): void {
  const now = Date.now();
  for (const [key, cached] of this.responseCache.entries()) {
    if (now >= cached.expiresAt) {
      this.responseCache.delete(key);
    }
  }
}
```

### Orchestration Metrics

```typescript
interface AgentOrchestrationMetrics {
  totalExecutions: number;
  successRate: number;
  averageDuration: number;
  errorRate: number;
  lastExecution: string;
}
```

## Agent Communication Patterns

### Multi-Agent Workflow Execution

```typescript
// Sequential workflow execution
async executeCalendarDiscoveryWorkflow(request) {
  // 1. Data fetching (MexcApiAgent)
  // 2. Calendar analysis (CalendarAgent) 
  // 3. Pattern discovery (PatternDiscoveryAgent)
  // 4. Result synthesis (Orchestrator)
}

// Parallel agent coordination
async checkAgentHealth() {
  const [mexcHealth, openAiHealth, dbHealth] = await Promise.allSettled([
    checkMexcApiHealth(),
    checkOpenAiHealth(), 
    checkDatabaseHealth(),
  ]);
}
```

### Error Handling and Recovery

```typescript
// Agent-level error handling
protected async callOpenAI() {
  try {
    // OpenAI API call
  } catch (error) {
    const errorLoggingService = ErrorLoggingService.getInstance();
    await errorLoggingService.logError(error, {
      agent: this.config.name,
      operation: "processWithOpenAI",
    });
    throw new Error(`Agent ${this.config.name} failed: ${error}`);
  }
}

// Workflow-level error recovery
private updateMetrics(result: MexcWorkflowResult, startTime: number): void {
  if (result.success) {
    this.metrics.successRate = (successCount + 1) / totalExecutions;
  } else {
    this.metrics.errorRate = (errorCount + 1) / totalExecutions;
  }
}
```

## Environment Configuration

### Required Environment Variables

```bash
# Core AI Integration
OPENAI_API_KEY=your-openai-api-key  # Required for all agents

# MEXC API Access
MEXC_API_KEY=your-mexc-api-key      # Optional for development
MEXC_SECRET_KEY=your-mexc-secret    # Optional for development
MEXC_BASE_URL=https://api.mexc.com  # Default endpoint

# Workflow Orchestration
INNGEST_SIGNING_KEY=auto-generated   # Workflow security
INNGEST_EVENT_KEY=auto-generated     # Event authentication

# Database Configuration
DATABASE_URL=postgresql://your-username:password@ep-endpoint.neon.tech/dbname  # NeonDB PostgreSQL
```

### Development vs Production Settings

**Development Configuration:**
```typescript
// Lower thresholds for testing
const devConfig = {
  riskManagement: {
    maxDailyLoss: 100,
    maxPositionSize: 50,
    simulationMode: true,
  },
  caching: {
    enabled: true,
    ttl: 60000, // 1 minute for faster development
  }
};
```

**Production Configuration:**
```typescript
// Production-ready settings
const prodConfig = {
  riskManagement: {
    maxDailyLoss: 1000,
    maxPositionSize: 500,
    simulationMode: false,
  },
  caching: {
    enabled: true,
    ttl: 300000, // 5 minutes for stability
  }
};
```

## Testing Configuration

### Agent Health Checks

```typescript
// Individual agent health verification
async checkAgentHealth(): Promise<AgentHealthStatus> {
  const [mexcHealth, openAiHealth, dbHealth] = await Promise.allSettled([
    checkMexcApiHealth(),
    checkOpenAiHealth(),
    checkDatabaseHealth(),
  ]);
  
  return {
    mexcApi: mexcHealth.status === "fulfilled" && mexcHealth.value.status !== "unhealthy",
    patternDiscovery: openAiHealth.status === "fulfilled",
    // ... other agents
  };
}
```

### Integration Testing

```typescript
// Comprehensive safety check across all agents
async performComprehensiveSafetyCheck(): Promise<SafetyCheckResult> {
  const [simulationCheck, riskCheck, reconciliationCheck, errorRecoveryCheck] = 
    await Promise.all([
      this.simulationAgent.performSafetyCheck(null),
      this.riskManagerAgent.performSafetyCheck(null),
      this.reconciliationAgent.performSafetyCheck(null),
      this.errorRecoveryAgent.performSafetyCheck(null),
    ]);

  const overall = criticalIssues.length === 0 ? "pass" : 
                 criticalIssues.length > 2 ? "critical" : "warning";
}
```

## Monitoring and Debugging

### Agent Performance Monitoring

```typescript
// Runtime metrics collection
interface AgentMetrics {
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  cacheHitRate: number;
  errorCount: number;
}

// Health check dashboard data
getAgentSummary(): AgentSummary {
  return {
    totalAgents: 9,
    coreAgents: 5,
    safetyAgents: 4,
    agentTypes: ["mexc-api", "pattern-discovery", "calendar", "symbol-analysis", 
                 "strategy", "simulation", "risk-manager", "reconciliation", "error-recovery"],
    initialized: true,
  };
}
```

### Debugging Tools

```typescript
// Enable debug logging for specific agents
const debugConfig = {
  enableCacheLogging: process.env.NODE_ENV === "development",
  enableAPILogging: process.env.DEBUG_API === "true",
  enableWorkflowTracing: process.env.DEBUG_WORKFLOWS === "true",
};

// Agent destruction for memory management
destroy(): void {
  if (this.cacheCleanupInterval) {
    clearInterval(this.cacheCleanupInterval);
    this.cacheCleanupInterval = undefined;
  }
  this.responseCache.clear();
}
```

## Deployment Configuration

### Vercel Deployment Settings

```json
{
  "functions": {
    "app/api/inngest/route.ts": {
      "maxDuration": 300
    }
  },
  "crons": [
    {
      "path": "/api/triggers/calendar-poll",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

### Resource Optimization

```typescript
// Memory-efficient agent initialization
constructor() {
  // Lazy loading for non-critical agents
  this.simulationAgent = new SimulationAgent();
  
  // Shared OpenAI client across agents
  this.openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}
```

## Security Configuration

### API Key Management

```typescript
// Secure credential handling
const validateApiCredentials = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for agent operations");
  }
  
  // MEXC credentials are optional for development
  if (process.env.NODE_ENV === "production" && !process.env.MEXC_API_KEY) {
    console.warn("MEXC_API_KEY not set - trading will be simulated");
  }
};
```

### Rate Limiting

```typescript
// OpenAI API rate limiting
const rateLimiter = {
  requests: 60,        // Per minute
  tokens: 100000,      // Per minute
  concurrent: 5,       // Simultaneous requests
};
```

## Troubleshooting Guide

### Common Configuration Issues

1. **Agent Initialization Failures**
   - Check OpenAI API key validity
   - Verify environment variable loading
   - Ensure database connectivity

2. **Workflow Execution Problems**
   - Validate Inngest event signatures
   - Check agent health status
   - Review error logs in dashboard

3. **Performance Degradation**
   - Monitor cache hit rates
   - Check agent response times
   - Review memory usage patterns

4. **Safety System Alerts**
   - Verify risk threshold configurations
   - Check circuit breaker settings
   - Review position reconciliation

### Configuration Validation

```bash
# Health check commands
npm run agents:health        # Check all agent health
npm run workflows:test       # Test workflow execution  
npm run safety:check         # Validate safety systems
npm run config:validate      # Verify configuration
```

This configuration guide provides comprehensive coverage of the MEXC Sniper Bot's multi-agent architecture, enabling developers to effectively understand, modify, and optimize the system's performance and reliability.