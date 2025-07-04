# MEXC Sniper Bot 🎯

An intelligent cryptocurrency trading bot powered by specialized AI agents that discover and analyze new token listings on the MEXC exchange. Features a cutting-edge TypeScript multi-agent system with OpenAI GPT-4 integration for advanced pattern recognition and automated trading strategies.

## 🚀 Key Features

- **🤖 Multi-Agent AI System**: 16+ specialized TypeScript agents working together for comprehensive analysis
- **🔍 Intelligent Pattern Discovery**: AI-powered detection of MEXC ready state patterns (sts:2, st:2, tt:4)
- **⏰ Advanced Timing**: 3.5+ hour advance detection for optimal position entry
- **📊 Real-time Analysis**: Continuous symbol monitoring with dynamic confidence scoring
- **🎯 Smart Strategy Generation**: AI-powered trading strategies with risk assessment
- **⚡ Pure TypeScript Architecture**: Modern stack with Next.js 15, Drizzle ORM, and TanStack Query
- **🛡️ Robust Error Handling**: Multi-agent fallbacks and graceful degradation
- **📈 Confidence Scoring**: 0-100% reliability metrics for every trading signal
- **⚙️ User Configurable**: Customizable take profit levels and risk management
- **🔐 Secure Authentication**: Supabase Auth with email bypass and rate limit handling
- **🧪 Comprehensive Testing**: 293 tests with 96%+ pass rate (Vitest, Playwright, Stagehand AI-powered testing)

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

### 🎯 **Specialized Agents (16+ Active)**

**Core Trading Agents:**
- **📅 CalendarAgent**: New listing discovery and launch timing analysis
- **🔍 PatternDiscoveryAgent**: Ready state detection and pattern validation (`sts:2, st:2, tt:4`)
- **📊 SymbolAnalysisAgent**: Real-time readiness assessment and market analysis
- **🌐 MexcApiAgent**: API interactions and trading signal analysis
- **🎯 StrategyAgent**: AI-powered trading strategy creation and optimization

**Risk Management & Safety Agents:**
- **🛡️ SafetyBaseAgent**: Core safety monitoring and circuit breaker controls
- **📊 SafetyMonitorAgent**: Real-time safety monitoring and alerts
- **⚖️ RiskManagerAgent**: Position sizing, risk metrics, and circuit breakers
- **🔄 ReconciliationAgent**: Balance verification and position tracking
- **🧪 SimulationAgent**: Strategy backtesting and paper trading validation
- **🔧 ErrorRecoveryAgent**: System health monitoring and automatic recovery

**Orchestration & Coordination:**
- **🎭 MultiAgentOrchestrator**: Workflow coordination and result synthesis
- **🎪 MexcOrchestrator**: Specialized MEXC workflow execution
- **👨‍💼 AgentManager**: Agent lifecycle and health management
- **🌐 WebSocketAgentBridge**: Real-time data integration bridge
- **📋 Additional specialized agents** for pattern embedding, data fetching, and analysis

### 🚀 **Technology Stack**

- **Frontend**: Next.js 15 with TypeScript and React 19
- **Agent System**: Pure TypeScript with OpenAI GPT-4 integration
- **Authentication**: Kinde Auth with secure session management
- **Workflows**: Inngest for reliable background task orchestration
- **Database**: Drizzle ORM with NeonDB (serverless PostgreSQL) for global edge performance
- **Data Management**: TanStack Query v5.80.6 for real-time data fetching and caching
- **Observability**: OpenTelemetry with distributed tracing for critical operations
- **Logging**: Simplified console-based logging (recently cleaned up from complex structured logging)
- **Testing**: Vitest (unit), Playwright (E2E), Stagehand v2.3.0 (AI-powered E2E)
- **Code Quality**: Biome.js for formatting and linting, TypeScript for type safety
- **Deployment**: Vercel with automatic scaling and edge optimization

## 📋 Prerequisites

- **Node.js 20.11.0+** and bun/npm (see package.json engines)
- **OpenAI API key** (required for AI agents and Stagehand testing)
- **Kinde Auth account** (required for authentication)
- **MEXC API credentials** (optional, for authenticated endpoints)
- **NeonDB account** (optional, for production database)

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

# Required - Supabase Authentication
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional - Custom SMTP (recommended for production)
SUPABASE_SMTP_HOST=smtp.resend.com
SUPABASE_SMTP_PORT=587
SUPABASE_SMTP_USER=resend
SUPABASE_SMTP_PASS=re_your-api-key

# Optional - MEXC API Access
MEXC_API_KEY=your_mexc_api_key
MEXC_SECRET_KEY=your_mexc_secret_key
MEXC_BASE_URL=https://api.mexc.com

# Database Configuration
# Option 1: Local SQLite (default for development)
DATABASE_URL=sqlite:///./mexc_sniper.db

# Option 2: NeonDB (recommended for production)
# DATABASE_URL=postgresql://username:password@hostname/database?sslmode=require

# Optional - Workflow Orchestration (auto-generated if not provided)
# INNGEST_SIGNING_KEY=your_signing_key
# INNGEST_EVENT_KEY=your_event_key
# Optional credentials for automated E2E tests
TEST_USER_EMAIL=your_test_email@example.com
TEST_USER_PASSWORD=your_test_password
```

### 2.1. Supabase Authentication Setup

1. **Create a Supabase account** at [https://supabase.com](https://supabase.com)
2. **Create a new project** in your Supabase dashboard
3. **Configure authentication settings**:
   - Site URL: `http://localhost:3008`
   - Redirect URLs: `http://localhost:3008/auth/callback`
   - Email confirmation: Can be bypassed in development
4. **Copy credentials** from Settings → API to your `.env.local` file
5. **Optional**: Configure custom SMTP for production (see SMTP Configuration Guide)

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
make dev-next    # Next.js on port 3008
make dev-inngest # Inngest dev server on port 8288
```

### 5. Access the Application

- **Homepage**: http://localhost:3008 (public landing page)
- **Authentication**: http://localhost:3008/auth (Kinde Auth login)
- **Trading Dashboard**: http://localhost:3008/dashboard (authenticated users)
- **Configuration**: http://localhost:3008/config (user settings)
- **Safety Monitor**: http://localhost:3008/safety (risk management)
- **Strategies**: http://localhost:3008/strategies (trading strategies)
- **Workflows**: http://localhost:3008/workflows (agent workflows)
- **Inngest Dashboard**: http://localhost:8288 (development workflow monitoring)

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

### Primary: Deploy to Vercel

1. Push your code to GitHub
2. Import project in Vercel Dashboard
3. Add environment variables (including NeonDB credentials)
4. Deploy

**Important**: The system is optimized for Vercel's edge infrastructure with NeonDB for global low-latency data access.

### Alternative: Deploy to Railway

Railway offers persistent containers and built-in monitoring:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway init
railway up
```

### Database Setup with NeonDB

1. Visit [Neon.tech](https://neon.tech) and create an account
2. Create a new project and database
3. Get your connection string from the project dashboard
4. Add the connection string to your environment variables:
   ```bash
   DATABASE_URL=postgresql://username:password@hostname/database?sslmode=require
   ```

### Manual Deployment

```bash
# Build and deploy to Vercel
make build
vercel --prod

# Or deploy to Railway
railway up
```

For detailed deployment instructions, see [docs/deployment/DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md)

## 📚 Documentation

### Authentication System
- [Developer Onboarding Guide](docs/DEVELOPER_AUTH_ONBOARDING_GUIDE.md) - Complete setup for new developers
- [Supabase Migration Guide](docs/NEXTAUTH_TO_SUPABASE_MIGRATION_GUIDE.md) - Migration from NextAuth to Supabase
- [SMTP Configuration Guide](docs/SMTP_CONFIGURATION_GUIDE.md) - Custom email setup for production
- [Rate Limit Handling](docs/RATE_LIMIT_HANDLING_SYSTEM.md) - Rate limit management and UX
- [Authentication Troubleshooting](docs/AUTH_TROUBLESHOOTING_GUIDE.md) - Common issues and solutions
- [Supabase Rate Limit Fix](docs/SUPABASE_AUTH_RATE_LIMIT_FIX.md) - Email bypass and workarounds

### Core Documentation
- [Agent Architecture](docs/architecture/AGENTS.md) - Quick setup guide for AI agents
- [Architecture Review](docs/architecture/ARCHITECTURE_REVIEW.md) - Codebase analysis and refactoring plan
- [Stagehand E2E Testing](docs/testing/STAGEHAND_E2E_TESTING.md) - AI-powered testing framework

### Deployment & Operations
- [Deployment Guide](docs/deployment/DEPLOYMENT.md) - Production deployment
- [NeonDB Best Practices](docs/deployment/neon-best-practices.md) - Database optimization

### Development
- [Contributing Guide](docs/development/CONTRIBUTING.md) - Development guidelines
- [Quick Start Guide](docs/guides/QUICKSTART.md) - Getting started
- [Secure Encryption Guide](docs/guides/SECURE_ENCRYPTION_QUICKSTART.md) - Security setup

## 🧪 Testing & Development

### Testing Framework

The project includes comprehensive testing with **293 tests achieving 96%+ pass rate** across multiple frameworks:

#### **Unit Tests (Vitest)**
```bash
# Run unit tests
bun run test
npm run test:unit

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# UI mode
npm run test:ui
```

#### **End-to-End Tests (Playwright)**
```bash
# Run E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run in headed mode
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug

# View reports
npm run test:e2e:report
```

#### **AI-Powered E2E Tests (Stagehand)**
```bash
# Run all Stagehand tests
npm run test:stagehand

# Run specific test suites
npm run test:stagehand:auth        # Authentication flows
npm run test:stagehand:dashboard   # Dashboard functionality
npm run test:stagehand:patterns    # Pattern discovery
npm run test:stagehand:api         # API integration
npm run test:stagehand:integration # Complete user journeys

# Run with UI (debugging)
npm run test:stagehand:ui

# Run in headed mode
npm run test:stagehand:headed
```

#### **Complete Test Suite**
```bash
# Run all tests (unit + E2E + Stagehand)
npm run test:all

# CI test pipeline
npm run ci:test
```

### Code Quality

```bash
# Run all linters and formatters (Biome.js)
bun run lint:all

# Individual checks
bun run lint          # Lint with Biome
bun run format        # Format with Biome
bun run type-check    # TypeScript validation

# Pre-commit checks
bun run pre-commit
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

- **TypeScript First**: All new code must be in TypeScript with strict type checking
- **Testing Required**: Write unit tests (Vitest), E2E tests (Playwright), and Stagehand tests for new features
- **Code Quality**: Use Biome.js for formatting and linting, maintain 100% test pass rate
- **Database**: Use Drizzle ORM for all database operations with safe migrations
- **Authentication**: All protected routes must use Supabase Auth integration
- **Error Handling**: Implement comprehensive error handling with proper logging
- **Documentation**: Add JSDoc comments and update relevant documentation
- **Performance**: Optimize for Vercel serverless deployment and global edge performance

## ⚠️ Disclaimer

This bot is for educational purposes. Cryptocurrency trading carries significant risk. Never invest more than you can afford to lose. The authors are not responsible for any financial losses.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.