# Claude Code Configuration - MEXC Sniper Bot AI System

## Project Overview
This is a sophisticated TypeScript-based cryptocurrency trading bot featuring an advanced **Multi-Agent AI Architecture** designed for MEXC exchange. The system employs **12 specialized AI agents** orchestrated through **Inngest workflows** for automated pattern discovery, risk management, and trading strategy execution.

## AI Agent Architecture Overview

### 🤖 **Multi-Agent System** (`src/mexc-agents/`)

The system features **12 specialized AI agents** powered by **OpenAI GPT-4** with intelligent caching, error recovery, and coordinated workflows:

#### **Core Trading Agents**
1. **BaseAgent** (`base-agent.ts`) - Foundation class with OpenAI integration, caching, and error handling
2. **MexcApiAgent** (`mexc-api-agent.ts`) - MEXC API interactions and data analysis
3. **PatternDiscoveryAgent** (`pattern-discovery-agent.ts`) - **Ready state pattern detection** (`sts:2, st:2, tt:4`)
4. **CalendarAgent** (`calendar-agent.ts`) - New listing discovery and launch timing analysis
5. **SymbolAnalysisAgent** (`symbol-analysis-agent.ts`) - Real-time readiness assessment and market analysis
6. **StrategyAgent** (`strategy-agent.ts`) - AI-powered trading strategy creation

#### **Risk Management & Safety Agents**  
7. **SafetyBaseAgent** (`safety-base-agent.ts`) - Core safety monitoring and circuit breaker controls
8. **SafetyMonitorAgent** (`safety-monitor-agent.ts`) - Real-time safety monitoring and alerts
9. **RiskManagerAgent** (`risk-manager-agent.ts`) - Position sizing, risk metrics, and circuit breakers
10. **SimulationAgent** (`simulation-agent.ts`) - Strategy backtesting and paper trading validation
11. **ReconciliationAgent** (`reconciliation-agent.ts`) - Balance verification and position tracking
12. **ErrorRecoveryAgent** (`error-recovery-agent.ts`) - System health monitoring and automatic recovery

#### **Orchestration & Coordination**
- **MultiAgentOrchestrator** (`multi-agent-orchestrator.ts`) - Workflow coordination and result synthesis
- **MexcOrchestrator** (`orchestrator.ts`) - Specialized MEXC workflow execution
- **AgentManager** (`agent-manager.ts`) - Agent lifecycle and health management

### Standard Build Commands
- `npm run build`: Build the project
- `npm run test`: Run the test suite (280+ tests with high pass rate)
- `npm run lint`: Run linter and format checks
- `npm run typecheck`: Run TypeScript type checking

## 🚀 **Inngest Workflow Orchestration** (`src/inngest/functions.ts`)

### AI-Powered Trading Workflows

The system uses **Inngest** for reliable, event-driven execution of multi-agent workflows:

#### **Core Trading Workflows**
1. **`pollMexcCalendar`** - Multi-agent calendar discovery and new listing detection
2. **`watchMexcSymbol`** - Symbol monitoring with AI pattern analysis and readiness assessment
3. **`analyzeMexcPatterns`** - Pattern discovery and validation across multiple symbols
4. **`createMexcTradingStrategy`** - AI-powered strategy creation with risk management

#### **Safety & Monitoring Workflows** (`src/inngest/safety-functions.ts`)
- **Circuit Breaker Controls** - Automatic trading halts on risk threshold breaches
- **Balance Reconciliation** - Real-time position and balance verification
- **Error Recovery** - Automatic system health monitoring and recovery procedures
- **Risk Assessment** - Continuous risk evaluation and position management

### Pattern Detection Algorithm: **`sts:2, st:2, tt:4`**

The core trading logic centers on detecting the **MEXC Ready State Pattern**:

```typescript
// Ready State Pattern Detection
interface ReadyStatePattern {
  sts: 2,      // Symbol Trading Status: Ready
  st: 2,       // Status: Active  
  tt: 4        // Trading Time: Live
}
```

#### **Pattern Analysis Framework**
- **3.5+ Hour Advance Detection** - Early opportunity identification
- **Confidence Scoring (0-100%)** - AI-calculated reliability metrics
- **Multi-Symbol Cross-Analysis** - Correlated pattern detection
- **Risk Pattern Recognition** - False positive filtering and risk assessment

### Agent Communication & Coordination

```typescript
// Agent Workflow Request Interface
interface AgentWorkflowRequest {
  type: "calendar_discovery" | "pattern_analysis" | "symbol_analysis" | "strategy_creation";
  input: string;
  context?: Record<string, unknown>;
  maxHandoffs?: number;
  timeout?: number;
}

// Multi-Agent Result Synthesis
interface AgentWorkflowResult {
  success: boolean;
  finalResult?: AgentResponse;
  executionPath: string[];
  totalExecutionTime: number;
  agentResults: Map<string, AgentResponse>;
  error?: string;
}
```

## 🌐 **API Endpoints & Triggers** (`app/api/`)

### Agent Management & Monitoring
- **`/api/inngest`** - Main Inngest webhook endpoint for workflow execution
- **`/api/multi-agent`** - Direct multi-agent orchestrator access
- **`/api/workflow-status`** - Real-time workflow status and activity monitoring

### Manual Workflow Triggers (`app/api/triggers/`)
- **`/api/triggers/calendar-poll`** - Manually trigger calendar discovery workflow
- **`/api/triggers/symbol-watch`** - Start symbol monitoring for specific tokens  
- **`/api/triggers/pattern-analysis`** - Run pattern analysis on demand
- **`/api/triggers/trading-strategy`** - Create trading strategy for specific symbol
- **`/api/triggers/safety`** - Trigger safety system checks and circuit breakers
- **`/api/triggers/emergency`** - Emergency stop and system halt procedures

### MEXC Integration (`app/api/mexc/`)
- **`/api/mexc/calendar`** - MEXC calendar data with AI analysis
- **`/api/mexc/symbols`** - Symbol data with pattern detection
- **`/api/mexc/account`** - Account balance and trading status
- **`/api/mexc/connectivity`** - Exchange connectivity and health checks
- **`/api/mexc/trade`** - Trade execution and order management

### System Management
- **`/api/health/db`** - Database connectivity and performance monitoring
- **`/api/schedule/control`** - Workflow scheduling control and automation
- **`/api/query-performance`** - Database query performance metrics
- **`/api/transaction-locks`** - Transaction locking system status
- **`/api/user-preferences`** - User configuration and trading preferences

## 🧪 **Testing & Quality Assurance**

### Testing Strategy
- **280+ tests with high pass rate** - Comprehensive test coverage across all systems
- **Unit Tests** (`tests/unit/`) - Individual agent and service testing
- **Integration Tests** (`tests/integration/`) - Multi-agent workflow testing
- **E2E Tests** (`tests/e2e/`) - Full system and UI testing with Playwright
- **Stagehand E2E Tests** - Advanced browser automation and AI-driven testing

### E2E Testing with Stagehand (`tests/e2e/stagehand-dashboard.spec.ts`)
```typescript
// AI-powered browser testing
const dashboardTitle = await page.extract({
  instruction: "Extract the main dashboard title",
  schema: z.object({ title: z.string() }),
  useTextExtract: false,
});

// Intelligent UI interaction
const tabResults = await page.observe({
  instruction: "Find the Overview tab",
  onlyVisible: true,
  returnAction: true,
});
```

### Agent System Testing
```bash
# Test individual agents
npm run test:unit

# Test multi-agent workflows  
npm run test:integration

# Test full system with browser automation
npm run test:e2e

# Test with Stagehand AI browser automation
npm run test:stagehand
```

### Code Quality Standards
- **TypeScript Strict Mode** - Zero compilation errors required
- **Biome.js** - Fast formatting and linting
- **ESLint** - Additional TypeScript-specific rules
- **Accessibility (a11y)** - Full WCAG compliance in UI components
- **Error Handling** - Comprehensive error recovery in all agents

### Memory and State Management
- **Agent Caching** - 5-minute intelligent response caching with SHA-256 keys
- **Database State** - Drizzle ORM with SQLite/TursoDB persistence
- **Workflow State** - Inngest-managed stateful workflows with recovery
- **User Preferences** - Persistent trading configuration and risk settings

## 🔧 **Agent Development & Configuration**

### Adding New AI Agents

1. **Create Agent Class** (`src/mexc-agents/`)
```typescript
import { BaseAgent, type AgentConfig, type AgentResponse } from "./base-agent";

export class CustomAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: "custom-agent",
      model: "gpt-4o",
      temperature: 0.2,
      systemPrompt: `You are a specialized agent for...`,
    };
    super(config);
  }

  async process(input: string, context?: Record<string, unknown>): Promise<AgentResponse> {
    return await this.callOpenAI([
      { role: "user", content: input }
    ]);
  }
}
```

2. **Add to Orchestrator** (`src/mexc-agents/orchestrator.ts`)
3. **Create Inngest Workflow** (`src/inngest/functions.ts`)
4. **Add API Trigger** (`app/api/triggers/custom-agent/route.ts`)
5. **Write Tests** (`tests/unit/custom-agent.test.ts`)

### Agent Configuration
```typescript
interface AgentConfig {
  name: string;
  model?: string;           // Default: "gpt-4o"
  temperature?: number;     // Default: 0.7
  maxTokens?: number;       // Default: 2000
  systemPrompt: string;
  cacheEnabled?: boolean;   // Default: true
  cacheTTL?: number;        // Default: 5 minutes
}
```

### Agent Communication Patterns
- **Workflow Handoffs** - Sequential agent execution in Inngest workflows
- **Result Synthesis** - Multi-agent response aggregation and analysis
- **Error Recovery** - Automatic fallback to alternative agents
- **Performance Monitoring** - Cache hit rates, execution times, success rates

## 💼 **Workflow Examples & Usage Patterns**

### Multi-Agent Trading Workflow
```bash
# 1. Trigger Calendar Discovery  
curl -X POST http://localhost:3008/api/triggers/calendar-poll

# 2. Monitor Symbol Status (triggered automatically)
# Agents: CalendarAgent → PatternDiscoveryAgent → SymbolAnalysisAgent

# 3. Pattern Analysis (when symbols become active)
curl -X POST http://localhost:3008/api/triggers/pattern-analysis \
  -H "Content-Type: application/json" \
  -d '{"vcoinId": "TOKEN123", "symbols": ["TOKENUSDT"]}'

# 4. Strategy Creation (when ready state detected)  
curl -X POST http://localhost:3008/api/triggers/trading-strategy \
  -H "Content-Type: application/json" \
  -d '{"vcoinId": "TOKEN123", "riskLevel": "medium"}'
```

### Safety System Activation
```bash
# Emergency Stop All Trading
curl -X POST http://localhost:3008/api/triggers/emergency \
  -H "Content-Type: application/json" \
  -d '{"action": "halt_all_trading", "reason": "market_volatility"}'

# Risk Assessment
curl -X POST http://localhost:3008/api/triggers/safety \
  -H "Content-Type: application/json" \
  -d '{"action": "risk_assessment", "symbols": ["BTCUSDT", "ETHUSDT"]}'
```

### Development Workflow
```bash
# 1. Run tests before changes
npm run test

# 2. Test individual agents  
npm run test:unit -- pattern-discovery-agent

# 3. Test multi-agent workflows
npm run test:integration -- agent-system.test.ts

# 4. Verify TypeScript compliance
npm run type-check

# 5. Test E2E with AI browser automation
npm run test:stagehand
```

## ⚙️ **System Configuration & Environment**

### Required Environment Variables
```bash
# AI Integration (Required)
OPENAI_API_KEY=your-openai-api-key

# Authentication (Kinde)
KINDE_CLIENT_ID=your-kinde-client-id
KINDE_CLIENT_SECRET=your-kinde-client-secret
KINDE_ISSUER_URL=https://your-domain.kinde.com
KINDE_SITE_URL=http://localhost:3008
KINDE_POST_LOGOUT_REDIRECT_URL=http://localhost:3008
KINDE_POST_LOGIN_REDIRECT_URL=http://localhost:3008/dashboard

# Database (SQLite default, TursoDB optional)
DATABASE_URL=sqlite:///./mexc_sniper.db
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-token

# MEXC API (Optional)
MEXC_API_KEY=your-mexc-api-key
MEXC_SECRET_KEY=your-mexc-secret
MEXC_BASE_URL=https://api.mexc.com

# Workflow Orchestration (Auto-generated)
INNGEST_SIGNING_KEY=auto-generated
INNGEST_EVENT_KEY=auto-generated
```

### Key Configuration Files
- **`drizzle.config.ts`** - Database ORM configuration
- **`next.config.ts`** - Next.js and deployment settings
- **`vercel.json`** - Vercel deployment configuration  
- **`playwright.config.ts`** - E2E testing configuration
- **`biome.json`** - Code formatting and linting rules
- **`tsconfig.json`** - TypeScript compilation settings

## 🚀 **Development & Debugging Commands**

### Agent System Management
```bash
# Start development server with agents
npm run dev

# Start Inngest dev server for workflows  
npx inngest-cli dev -u http://localhost:3008/api/inngest

# Access Inngest dashboard
open http://localhost:8288

# Test agent health
curl http://localhost:3008/api/health/agents

# Monitor workflow status
curl http://localhost:3008/api/workflow-status
```

### Database Operations
```bash
# Generate new migrations
bun run db:generate

# Apply migrations safely
bun run db:migrate:safe

# Open database studio
bun run db:studio

# Check database health
bun run db:check

# Reset database (dev only)
bun run db:reset
```

### Development Monitoring
- **Inngest Dashboard** - `http://localhost:8288` (workflow monitoring)
- **Database Studio** - `bun run db:studio` (data management)
- **TanStack Query DevTools** - Browser-based state inspection
- **Agent Cache Statistics** - Available via API endpoints
- **Performance Metrics** - Query performance and agent execution times

## 🔧 **Troubleshooting & Error Recovery**

### Agent System Issues

#### Agent Communication Failures
```bash
# Check OpenAI API connectivity
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# Test individual agent health
curl http://localhost:3008/api/triggers/pattern-analysis \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Monitor agent cache performance
curl http://localhost:3008/api/health/agents
```

#### Workflow Execution Problems
```bash
# Check Inngest workflow status
curl http://localhost:3008/api/inngest/status

# View failed workflow runs
open http://localhost:8288

# Test workflow triggers manually
curl -X POST http://localhost:3008/api/triggers/calendar-poll

# Emergency workflow halt
curl -X POST http://localhost:3008/api/triggers/emergency \
  -d '{"action": "halt_all_workflows"}'
```

#### Performance Issues
```bash
# Clear agent caches
curl -X POST http://localhost:3008/api/agents/clear-cache

# Monitor database performance
bun run db:check

# Check query performance metrics
curl http://localhost:3008/api/query-performance
```

## 🏗️ **Multi-Agent Architecture Summary**

### System Architecture Principles
- **AI-First Design** - All core functionality powered by OpenAI GPT-4 agents
- **Event-Driven Workflows** - Inngest orchestration for reliable multi-agent coordination
- **Fault Tolerance** - Comprehensive error recovery and circuit breaker patterns
- **Real-time Processing** - TanStack Query for live data synchronization
- **Type Safety** - Strict TypeScript with zero compilation errors
- **Comprehensive Testing** - 280+ tests covering all agent interactions and workflows

### Agent Communication Flow
```
User Dashboard → API Triggers → Inngest Workflows → Multi-Agent Orchestrator
                                       ↓
Calendar Agent → Pattern Discovery Agent → Symbol Analysis Agent
                                       ↓
Risk Manager Agent ← Strategy Agent ← Trading Strategy Workflow
                                       ↓
Safety Monitoring ← Reconciliation Agent ← Error Recovery Agent
```

### Key Features
- **12 Specialized AI Agents** with distinct roles and expertise
- **Pattern Detection Algorithm** - `sts:2, st:2, tt:4` ready state recognition
- **3.5+ Hour Advance Detection** - Early opportunity identification
- **Multi-Layer Safety System** - Risk management and circuit breakers
- **Intelligent Caching** - 5-minute SHA-256 cached responses
- **Comprehensive Monitoring** - Real-time workflow and agent health tracking

## 📋 **Important Development Notes**

### Before Making Changes
- **Run all tests** (`npm run test`) - 280+ tests must pass
- **Check TypeScript** (`npm run type-check`) - Zero errors required
- **Verify agent health** - Ensure OpenAI API access and agent caches
- **Test workflows** - Validate Inngest integration and multi-agent coordination

### Agent Development Guidelines
- **Extend BaseAgent** - Use the provided caching and error handling
- **Clear System Prompts** - Define agent expertise and responsibilities
- **Type Safety** - Maintain strict TypeScript interfaces
- **Error Recovery** - Implement comprehensive error handling
- **Testing** - Write unit tests for agent logic and integration tests for workflows

### Production Deployment
- **Environment Variables** - Ensure all required keys are set in Vercel
- **Database Migration** - Use `db:migrate:safe` for zero-downtime updates
- **Agent Monitoring** - Monitor workflow execution via Inngest dashboard
- **Performance Tracking** - Review query performance and agent response times

This system represents a sophisticated AI trading architecture with enterprise-grade reliability, comprehensive testing, and advanced multi-agent coordination capabilities.
