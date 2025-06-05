# MEXC Sniper Bot 🎯

An intelligent cryptocurrency trading bot powered by specialized AI agents that discover and analyze new token listings on the MEXC exchange. Features a cutting-edge TypeScript multi-agent system with OpenAI integration for advanced pattern recognition and trading strategy generation.

## 🚀 Key Features

- **🤖 Multi-Agent AI System**: 5 specialized TypeScript agents working together for comprehensive analysis
- **🔍 Intelligent Pattern Discovery**: AI-powered detection of MEXC ready state patterns (sts:2, st:2, tt:4)
- **⏰ Advanced Timing**: 3.5+ hour advance detection for optimal position entry
- **📊 Real-time Analysis**: Continuous symbol monitoring with dynamic confidence scoring
- **🎯 Smart Strategy Generation**: AI-powered trading strategies with risk assessment
- **⚡ High-Performance Architecture**: Pure TypeScript with Inngest workflow orchestration
- **🛡️ Robust Error Handling**: Multi-agent fallbacks and graceful degradation
- **📈 Confidence Scoring**: 0-100% reliability metrics for every trading signal

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
- **Database**: SQLModel with async PostgreSQL/SQLite support
- **Caching**: Valkey (Redis-compatible) for high-performance data caching
- **Deployment**: Vercel with automatic scaling and edge optimization

## 📋 Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- OpenAI API key
- MEXC API credentials (optional)
- Redis (for caching)
- PostgreSQL (optional, SQLite for development)

### OpenAI Codex Setup (Optional)

If you plan to use or develop features leveraging OpenAI Codex, you'll need to set up your API key.
A script is provided to help with this:

```bash
python scripts/setup_openai.py
```
This script will guide you through saving your API key in a `.openai_config.json` file (which is gitignored) and setting it as an environment variable.

## 🛠️ Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-username/mexc-sniper-bot.git
cd mexc-sniper-bot

# Install dependencies
npm install
pip install -r requirements.txt
```

### 2. Environment Setup

Create a `.env.local` file:

```bash
# Required
OPENAI_API_KEY=your_openai_api_key

# Optional MEXC API (for authenticated endpoints)
MEXC_API_KEY=your_mexc_api_key
MEXC_SECRET_KEY=your_mexc_secret_key

# Database (optional, defaults to SQLite)
DATABASE_URL=postgresql://user:pass@localhost/mexc_sniper
REDIS_URL=redis://localhost:6379

# Inngest (auto-generated if not provided)
INNGEST_SIGNING_KEY=your_signing_key
INNGEST_EVENT_KEY=your_event_key
```

### 3. Run Development Servers

You'll need three terminals:

**Terminal 1 - Next.js Development:**
```bash
npm run dev
```

**Terminal 2 - Python API (Legacy):**
```bash
npm run mexc-agent-dev
# OR
uvicorn api.agents:app --reload --port 8001
```

**Terminal 3 - Inngest Dev Server:**
```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

### 4. Access the Application

- **Dashboard**: http://localhost:3000/app/dashboard
- **Inngest Dashboard**: http://localhost:8288 (TypeScript agents)
- **Python API**: http://localhost:8001 (Legacy support)
- **API Docs**: http://localhost:8001/docs

## 🤖 TypeScript Multi-Agent System

### 🚀 Inngest Workflows

The new system uses event-driven Inngest workflows for reliable execution:

#### **Calendar Discovery Workflow**
```typescript
// Trigger calendar scanning
await inngest.send({
  name: "mexc/calendar.poll.requested",
  data: { trigger: "manual", force: false }
});
```

#### **Symbol Monitoring Workflow**  
```typescript
// Monitor specific symbol for ready state
await inngest.send({
  name: "mexc/symbol.watch.requested", 
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
  name: "mexc/pattern.analysis.requested",
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
  name: "mexc/trading.strategy.requested",
  data: {
    vcoinId: "EXAMPLE001", 
    symbolData: {...},
    riskLevel: "medium",
    capital: 1000
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

## 📡 Legacy API Endpoints (Python)

### Health Checks
```http
GET /api/agents/health              # Basic health check  
GET /api/agents/health/detailed     # Comprehensive health with dependencies
GET /api/agents/health/ready        # Kubernetes-style readiness probe
GET /api/agents/health/live         # Kubernetes-style liveness probe
```

## ⚙️ Configuration

Key settings in `src/config.py`:
- `DEFAULT_BUY_AMOUNT`: USDT amount per trade
- `MAX_CONCURRENT_SNIPES`: Parallel trade limit
- `READY_STATE_PATTERN`: Pattern that indicates token readiness
- `STOP_LOSS_PERCENT`: Automatic stop-loss trigger

## 🚀 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import project in Vercel Dashboard
3. Add environment variables
4. Deploy

**Important**: After deployment, install the Inngest integration from Vercel's integration marketplace.

### Manual Deployment

```bash
vercel --prod
```

## 📚 Documentation

- [Agent Architecture](docs/agent-architecture.md) - AI agent system design
- [Sniper System](docs/sniper-system.md) - Trading bot implementation
- [API Reference](https://localhost:8001/docs) - Interactive API documentation

## 🧪 Testing

Run the test suite:

```bash
# Python tests
pytest

# Run with coverage
pytest --cov=src

# TypeScript linting
npm run lint
```

## 🔄 CI/CD Workflow

This project uses GitHub Actions for CI/CD, defined in `.github/workflows/cicd.yml`. The workflow is triggered on pushes and pull requests to the `main` branch and performs the following:

- Checks out the code.
- Sets up Python and Node.js (with Bun).
- Installs Python and Node.js dependencies.
- Runs linters and formatters for both Python and TypeScript/JavaScript.
- Executes Python tests (using `pytest`).
- Executes TypeScript/JavaScript tests.

This helps ensure code quality and that tests pass before merging changes.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## ⚠️ Disclaimer

This bot is for educational purposes. Cryptocurrency trading carries significant risk. Never invest more than you can afford to lose. The authors are not responsible for any financial losses.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.