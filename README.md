# MEXC Sniper Bot 🎯

An intelligent cryptocurrency trading bot powered by specialized AI agents that discover and analyze new token listings on the MEXC exchange. Features a cutting-edge TypeScript multi-agent system with OpenAI integration for advanced pattern recognition and automated trading strategies.

## 🚀 Key Features

- **🤖 Multi-Agent AI System**: 5 specialized TypeScript agents working together for comprehensive analysis
- **🔍 Intelligent Pattern Discovery**: AI-powered detection of MEXC ready state patterns (sts:2, st:2, tt:4)
- **⏰ Advanced Timing**: 3.5+ hour advance detection for optimal position entry
- **📊 Real-time Analysis**: Continuous symbol monitoring with dynamic confidence scoring
- **🎯 Smart Strategy Generation**: AI-powered trading strategies with risk assessment
- **⚡ Pure TypeScript Architecture**: Modern stack with Drizzle ORM and TanStack Query
- **🛡️ Robust Error Handling**: Multi-agent fallbacks and graceful degradation
- **📈 Confidence Scoring**: 0-100% reliability metrics for every trading signal
- **⚙️ User Configurable**: Customizable take profit levels and risk management

## 🏗️ Multi-Agent Architecture

Revolutionary TypeScript-based system with specialized AI agents:

```
┌─────────────────────────────────────────────────────────────┐
│                    MexcOrchestrator                         │
│              (Workflow Coordination Hub)                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
    ┌────▼───┐   ┌────▼───┐   ┌────▼───┐
    │Calendar│   │Pattern │   │Symbol  │
    │ Agent  │   │Discovery│   │Analysis│
    │        │   │ Agent  │   │ Agent  │
    └────┬───┘   └────┬───┘   └────┬───┘
         │            │            │
         └────────────┼────────────┘
                      │
                 ┌────▼───┐
                 │MEXC API│
                 │ Agent  │
                 └────────┘
```

### 🎯 **Specialized Agents**

- **📅 CalendarAgent**: New listing discovery and launch timing analysis
- **🔍 PatternDiscoveryAgent**: Ready state detection and pattern validation  
- **📊 SymbolAnalysisAgent**: Real-time readiness assessment and market analysis
- **🌐 MexcApiAgent**: API interactions and trading signal analysis
- **🎭 MexcOrchestrator**: Multi-agent workflow coordination

### 🚀 **Technology Stack**

- **Frontend**: Next.js 15 with TypeScript and React 19
- **Agent System**: Pure TypeScript with OpenAI GPT-4 integration
- **Workflows**: Inngest for reliable background task orchestration
- **Database**: Drizzle ORM with SQLite/TursoDB support
- **Data Management**: TanStack Query for real-time data fetching and caching
- **Deployment**: Vercel with automatic scaling and edge optimization

## 📋 Prerequisites

- Node.js 18+ and bun/npm
- OpenAI API key (required for AI agents)
- MEXC API credentials (optional, for authenticated endpoints)

## 🛠️ Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-username/mexc-sniper-bot.git
cd mexc-sniper-bot

# Install dependencies with bun (recommended)
bun install

# Or with npm
npm install
```

### 2. Environment Setup

Create a `.env.local` file:

```bash
# Required - Core AI Integration
OPENAI_API_KEY=your_openai_api_key

# Optional - MEXC API Access
MEXC_API_KEY=your_mexc_api_key
MEXC_SECRET_KEY=your_mexc_secret_key
MEXC_BASE_URL=https://api.mexc.com

# Optional - Database (defaults to SQLite)
DATABASE_URL=sqlite:///./mexc_sniper.db
# For TursoDB: uncomment and configure
# TURSO_DATABASE_URL=your_turso_database_url
# TURSO_AUTH_TOKEN=your_turso_auth_token

# Optional - Workflow Orchestration (auto-generated if not provided)
# INNGEST_SIGNING_KEY=your_signing_key
# INNGEST_EVENT_KEY=your_event_key
```

### 3. Setup Database

```bash
# Initialize database with migrations
make db-migrate

# Or using bun directly
bun run db:migrate
```

### 4. Run Development Environment

Use the convenient Makefile commands:

```bash
# Start all development servers (Next.js + Inngest)
make dev

# Or start individually:
make dev-next    # Next.js on port 3000
make dev-inngest # Inngest dev server on port 8288
```

### 5. Access the Application

- **Trading Dashboard**: http://localhost:3000/dashboard
- **Configuration**: http://localhost:3000/config  
- **Inngest Dashboard**: http://localhost:8288 (workflow monitoring)

## 🤖 TypeScript Multi-Agent System

### 🚀 Inngest Workflows

The system uses event-driven Inngest workflows for reliable execution:

#### **Calendar Discovery Workflow**
```typescript
// Trigger calendar scanning
await inngest.send({
  name: "mexc/calendar.poll",
  data: { triggeredBy: "manual", timestamp: new Date().toISOString() }
});
```

#### **Symbol Monitoring Workflow**  
```typescript
// Monitor specific symbol for ready state
await inngest.send({
  name: "mexc/symbol.watch", 
  data: {
    vcoinId: "EXAMPLE001",
    symbolName: "EXAMPLECOIN",
    attempt: 1
  }
});
```

#### **Pattern Analysis Workflow**
```typescript
// Analyze patterns across symbols
await inngest.send({
  name: "mexc/pattern.analysis",
  data: {
    symbols: ["BTC", "ETH", "SOL"],
    analysisType: "discovery"
  }
});
```

#### **Trading Strategy Workflow**
```typescript
// Generate AI-powered trading strategy
await inngest.send({
  name: "mexc/trading.strategy",
  data: {
    vcoinId: "EXAMPLE001", 
    symbolData: {...},
    riskLevel: "medium",
    positionSize: 1000
  }
});
```

### 🧠 Agent Capabilities

#### **📅 CalendarAgent**
- **AI-Powered Discovery**: Scans MEXC calendar using GPT-4 analysis
- **Launch Timing**: Predicts actual vs. announced launch times
- **Market Potential**: Assesses project fundamentals and trading appeal
- **Monitoring Plans**: Creates dynamic scheduling for discovered opportunities

#### **🔍 PatternDiscoveryAgent**  
- **Ready State Detection**: Validates sts:2, st:2, tt:4 pattern with 90%+ accuracy
- **Early Opportunity ID**: Identifies pre-ready patterns for 3.5+ hour advance
- **Confidence Scoring**: 0-100% reliability metrics for all patterns
- **False Positive Filtering**: AI-powered validation to reduce noise

#### **📊 SymbolAnalysisAgent**
- **Real-time Assessment**: Continuous READY/NOT READY determination
- **Market Microstructure**: Analyzes liquidity, spreads, and trading conditions  
- **Risk Evaluation**: Comprehensive risk scoring and mitigation strategies
- **Dynamic Monitoring**: AI-driven scheduling based on symbol status

#### **🌐 MexcApiAgent**
- **Intelligent API Integration**: Smart data fetching with fallback mechanisms
- **Trading Signal Analysis**: AI-powered extraction of actionable insights
- **Data Quality Assessment**: Validates completeness and reliability
- **Market Condition Integration**: Contextual analysis of trading environment

#### **🎭 MexcOrchestrator**
- **Workflow Coordination**: Manages complex multi-agent workflows
- **Result Synthesis**: Combines insights from multiple agents
- **Error Recovery**: Robust fallback and retry mechanisms
- **Performance Optimization**: Efficient resource allocation and scheduling

## ⚙️ User Configuration

### Take Profit Levels
Configure your preferred take profit percentages:

- **Level 1**: Conservative (default: 5%)
- **Level 2**: Moderate (default: 10%) 
- **Level 3**: Aggressive (default: 15%)
- **Level 4**: Very Aggressive (default: 25%)
- **Custom**: User-defined percentage

### Trading Preferences
- **Default Buy Amount**: USDT amount per trade
- **Max Concurrent Snipes**: Parallel trade limit
- **Ready State Pattern**: Pattern indicating token readiness (default: 2,2,4)
- **Stop Loss Percent**: Automatic stop-loss trigger
- **Risk Tolerance**: Low, Medium, High
- **Target Advance Hours**: How far ahead to detect opportunities

## 📊 Database Schema

The system uses Drizzle ORM with the following key tables:

- **user_preferences**: Trading configuration and take profit levels
- **api_credentials**: Encrypted API keys and credentials
- **monitored_listings**: Tracked MEXC listings with pattern states
- **snipe_targets**: Active trading targets with execution details
- **execution_history**: Complete trading history and performance metrics

## 🚀 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import project in Vercel Dashboard
3. Add environment variables
4. Deploy

**Important**: The system works entirely on Vercel's serverless infrastructure.

### Manual Deployment

```bash
# Build and deploy
make build
vercel --prod
```

## 📚 Documentation

- [Agent Architecture](docs/agent-architecture.md) - AI agent system design
- [TypeScript Multi-Agent Architecture](docs/typescript-multi-agent-architecture.md) - Technical implementation
- [Sniper System](docs/sniper-system.md) - Trading bot implementation

## 🧪 Testing & Development

### Code Quality

```bash
# Run all linters and formatters
make lint

# TypeScript type checking
make type-check

# Format code
make format

# Run all pre-commit checks
make pre-commit
```

### Database Operations

```bash
# Generate new migrations
make db-generate

# Apply migrations
make db-migrate

# Open database studio
make db-studio

# Reset database (WARNING: destroys data)
make db-reset
```

### Utilities

```bash
# Check project status
make status

# Clean generated files
make clean

# Check for outdated dependencies
make deps-check

# Update dependencies
make deps-update
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass and linting is clean
5. Submit a pull request

### Development Guidelines

- Follow TypeScript best practices
- Use Drizzle ORM for database operations
- Implement proper error handling
- Add comprehensive JSDoc comments
- Write tests for new features

## ⚠️ Disclaimer

This bot is for educational purposes. Cryptocurrency trading carries significant risk. Never invest more than you can afford to lose. The authors are not responsible for any financial losses.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.