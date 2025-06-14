# MEXC Sniper Bot - Agent System Documentation Index

## Documentation Overview

This comprehensive documentation suite covers the MEXC Sniper Bot's sophisticated 9-agent multi-agent system with Inngest workflow orchestration. The system implements advanced AI-powered cryptocurrency trading strategies with robust safety mechanisms and pattern detection algorithms.

## Documentation Structure

### 🤖 [Agent Configuration Guide](./agent-configuration.md)
**Complete configuration reference for all 9 agents**

- **Core Trading Agents (5)**: MexcApiAgent, PatternDiscoveryAgent, CalendarAgent, SymbolAnalysisAgent, StrategyAgent
- **Safety Agents (4)**: SimulationAgent, RiskManagerAgent, ReconciliationAgent, ErrorRecoveryAgent
- **Configuration Framework**: Base agent setup, caching system, performance optimization
- **Environment Variables**: Required settings for development and production
- **Testing & Debugging**: Health checks, monitoring, troubleshooting guides

### 🔄 [Workflow Orchestration Guide](./workflow-orchestration.md)
**Event-driven workflow architecture with Inngest**

- **Core Workflows**: Calendar discovery, symbol monitoring, pattern analysis, trading strategy creation
- **Event Architecture**: Event mapping, cascading patterns, error handling
- **Agent Coordination**: Sequential, parallel, and pipeline execution patterns
- **Safety Workflows**: Emergency systems, risk monitoring, circuit breakers
- **Performance Optimization**: Batch processing, caching, resource management

### 🎯 [Pattern Detection Algorithms](./pattern-detection-algorithms.md)
**AI-powered pattern recognition and analysis**

- **Ready State Detection**: Primary `sts:2, st:2, tt:4` pattern algorithm
- **Advanced Algorithms**: Status transition, launch timing, volume analysis, risk patterns
- **AI Enhancement**: OpenAI integration for pattern analysis refinement
- **Performance Features**: Caching strategies, batch processing, real-time monitoring
- **Testing Framework**: Pattern validation, performance tracking, accuracy metrics

### 🧠 [Multi-Agent Coordination](./multi-agent-coordination.md)
**Sophisticated agent orchestration and communication**

- **Coordination Patterns**: Sequential, parallel, pipeline, event-driven execution
- **Communication Protocols**: Request-response, publish-subscribe, shared memory
- **Synchronization**: Workflow coordination, resource locking, circuit breakers
- **Performance Optimization**: Agent pooling, batch coordination, caching
- **Error Handling**: Failure isolation, consensus decisions, recovery mechanisms

## Quick Start Guide

### System Architecture Overview

```
MEXC Sniper Bot Multi-Agent System
├── Core Trading Agents (5)
│   ├── MexcApiAgent - MEXC API integration
│   ├── PatternDiscoveryAgent - Pattern detection (sts:2, st:2, tt:4)
│   ├── CalendarAgent - New listing discovery
│   ├── SymbolAnalysisAgent - Real-time analysis
│   └── StrategyAgent - AI strategy creation
├── Safety Agents (4)
│   ├── SimulationAgent - Safe testing
│   ├── RiskManagerAgent - Risk management
│   ├── ReconciliationAgent - Position validation
│   └── ErrorRecoveryAgent - System health
├── Orchestration Layer
│   ├── MexcOrchestrator - Top-level coordination
│   ├── AgentManager - Agent lifecycle
│   ├── WorkflowExecutor - Workflow coordination
│   └── DataFetcher - Shared data services
└── Inngest Workflows
    ├── Calendar Discovery - Multi-agent calendar scanning
    ├── Symbol Monitoring - Real-time pattern detection
    ├── Pattern Analysis - Advanced pattern validation
    └── Strategy Creation - AI-powered trading strategies
```

### Essential Configuration Files

```typescript
// Core agent configuration locations
src/mexc-agents/
├── index.ts                     # Agent exports and presets
├── orchestrator.ts              # Main orchestration logic
├── agent-manager.ts             # Agent lifecycle management
├── base-agent.ts                # Base configuration framework
└── [agent-name].ts              # Individual agent implementations

// Workflow configuration
src/inngest/
├── client.ts                    # Inngest client setup
├── functions.ts                 # Core trading workflows
├── safety-functions.ts          # Safety workflows
└── scheduled-functions.ts       # Automated scheduling

// Environment configuration
.env.local                       # Local development settings
vercel.json                      # Production deployment config
```

### Quick Setup Commands

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Start development server
npm run dev

# Start Inngest workflow server
npx inngest-cli dev -u http://localhost:3008/api/inngest

# Access Inngest dashboard
open http://localhost:8288

# Run health checks
npm run test:health
npm run agents:health
```

## Key Features and Capabilities

### 🎯 Pattern Detection Excellence
- **Primary Pattern**: `sts:2, st:2, tt:4` ready state detection with 95% confidence
- **AI Enhancement**: OpenAI GPT-4 integration for pattern analysis refinement
- **Multi-stage Validation**: Status transitions, timing optimization, risk assessment
- **Real-time Monitoring**: Continuous pattern validation with intelligent retry logic

### 🔄 Sophisticated Orchestration
- **Event-driven Architecture**: Reliable Inngest workflow orchestration
- **Multi-pattern Coordination**: Sequential, parallel, pipeline, and event-driven execution
- **Intelligent Retry Logic**: Exponential backoff with max 10 attempts per symbol
- **Workflow Cascade**: Calendar discovery → Symbol monitoring → Pattern analysis → Strategy creation

### 🛡️ Comprehensive Safety Systems
- **4 Dedicated Safety Agents**: Simulation, risk management, reconciliation, error recovery
- **Circuit Breakers**: Multi-level risk thresholds with automated halts
- **Emergency Coordination**: System-wide emergency response across all agents
- **Comprehensive Testing**: Simulation mode for safe strategy validation

### ⚡ Performance Optimization
- **Intelligent Caching**: 5-minute TTL with automatic cleanup across all agents
- **Batch Processing**: Efficient bulk operations with rate limiting
- **Resource Management**: Agent pooling and shared memory coordination
- **Real-time Monitoring**: Comprehensive metrics and health tracking

## Development Workflows

### Adding New Agents

1. **Create Agent Implementation**
   ```typescript
   // src/mexc-agents/new-agent.ts
   export class NewAgent extends BaseAgent {
     constructor() {
       super({
         name: "new-agent",
         model: "gpt-4o",
         temperature: 0.3,
         systemPrompt: "Your agent's expertise...",
       });
     }
   }
   ```

2. **Register with AgentManager**
   ```typescript
   // src/mexc-agents/agent-manager.ts
   private newAgent: NewAgent;
   
   constructor() {
     this.newAgent = new NewAgent();
   }
   ```

3. **Add to Workflow Coordination**
   ```typescript
   // src/mexc-agents/workflow-executor.ts
   const newAgentResult = await this.agentManager
     .getNewAgent()
     .processRequest(data);
   ```

### Creating New Workflows

1. **Define Inngest Function**
   ```typescript
   // src/inngest/functions.ts
   export const newWorkflow = inngest.createFunction(
     { id: "new-workflow" },
     { event: "custom/workflow.trigger" },
     async ({ event, step }) => {
       // Multi-step workflow implementation
     }
   );
   ```

2. **Add Orchestrator Method**
   ```typescript
   // src/mexc-agents/orchestrator.ts
   async executeNewWorkflow(request): Promise<MexcWorkflowResult> {
     return await this.workflowExecutor.executeNewWorkflow(request);
   }
   ```

3. **Create API Trigger**
   ```typescript
   // app/api/triggers/new-workflow/route.ts
   export async function POST(request: Request) {
     await inngest.send({
       name: "custom/workflow.trigger",
       data: await request.json(),
     });
   }
   ```

### Configuration Testing

```bash
# Test individual agents
npm run test src/mexc-agents/pattern-discovery-agent.test.ts

# Test workflow coordination
npm run test:integration

# Test full system health
npm run test:e2e

# Validate configuration
npm run config:validate
```

## Production Deployment

### Environment Requirements

```bash
# Required for all agents
OPENAI_API_KEY=your-openai-api-key

# Required for workflows
INNGEST_SIGNING_KEY=auto-generated
INNGEST_EVENT_KEY=auto-generated

# Optional for enhanced features
MEXC_API_KEY=your-mexc-api-key
MEXC_SECRET_KEY=your-mexc-secret-key

# Database (SQLite default, TursoDB for production)
DATABASE_URL=sqlite:///./mexc_sniper.db
TURSO_DATABASE_URL=your-turso-url    # Optional
TURSO_AUTH_TOKEN=your-turso-token    # Optional
```

### Vercel Configuration

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

### Health Monitoring

```typescript
// Production health check endpoints
GET /api/health/agents          # Agent health status
GET /api/health/workflows       # Workflow status
GET /api/health/system          # Overall system health

// Metrics endpoints
GET /api/metrics/agents         # Agent performance metrics
GET /api/metrics/patterns       # Pattern detection accuracy
GET /api/metrics/coordination   # Multi-agent coordination stats
```

## Support and Troubleshooting

### Common Issues and Solutions

1. **Agent Initialization Failures**
   - Verify OpenAI API key validity
   - Check environment variable loading
   - Ensure database connectivity

2. **Workflow Execution Problems**
   - Validate Inngest event signatures
   - Check agent health status via dashboard
   - Review error logs in Inngest UI

3. **Pattern Detection Accuracy**
   - Monitor confidence thresholds
   - Validate data quality metrics
   - Check OpenAI API rate limits

4. **Performance Degradation**
   - Monitor cache hit rates
   - Check agent response times
   - Review memory usage patterns

### Debug Commands

```bash
# Comprehensive system check
npm run debug:full

# Agent-specific debugging
npm run debug:agents

# Workflow debugging
npm run debug:workflows

# Pattern detection debugging
npm run debug:patterns
```

### Support Resources

- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Complete guides for each system component
- **Health Dashboard**: Real-time system monitoring at `/dashboard`
- **Inngest UI**: Workflow monitoring at `http://localhost:8288`

## Contributing to Agent System

### Development Standards

1. **TypeScript First**: All new code must be in TypeScript
2. **Agent Pattern**: Follow established BaseAgent architecture
3. **Error Handling**: Implement comprehensive error handling
4. **Testing**: Write tests for all new functionality
5. **Documentation**: Update relevant documentation files

### Code Review Checklist

- [ ] Agent follows BaseAgent configuration pattern
- [ ] Workflow integrates with Inngest orchestration
- [ ] Safety considerations addressed
- [ ] Performance implications considered
- [ ] Tests added/updated
- [ ] Documentation updated

This agent system documentation provides comprehensive coverage enabling developers to effectively understand, configure, and extend the MEXC Sniper Bot's sophisticated multi-agent architecture.