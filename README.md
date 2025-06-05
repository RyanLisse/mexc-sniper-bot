# MEXC Sniper Bot 🎯

An intelligent cryptocurrency trading bot that leverages AI agents to discover and execute trades on new token listings on the MEXC exchange. Built with a hybrid Next.js/Python architecture deployed on Vercel.

## 🚀 Key Features

- **AI-Powered Pattern Discovery**: Uses GPT-4 agents to analyze token launch patterns
- **Automated Trading**: Executes trades within milliseconds of token launch
- **Real-time Dashboard**: Monitor active positions and upcoming listings
- **Smart Risk Management**: Configurable stop-loss and take-profit targets
- **Serverless Architecture**: Scales automatically with Vercel Functions

## 🏗️ Architecture

This project uses a modern serverless architecture:

- **Frontend**: Next.js 15 with TypeScript and React 19
- **Backend**: Python FastAPI with OpenAI Agents
- **Workflows**: Inngest for long-running background tasks
- **Database**: SQLModel with async PostgreSQL/SQLite
- **Caching**: Redis for API response optimization
- **Deployment**: Vercel with automatic scaling

## 📋 Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- OpenAI API key
- MEXC API credentials (optional)
- Redis (for caching)
- PostgreSQL (optional, SQLite for development)

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

**Terminal 2 - Python MEXC Agent:**
```bash
npm run mexc-agent-dev
# OR
uvicorn api.agents:app --reload --port 8001
```

**Terminal 3 - Inngest Dev Server:**
```bash
npx inngest-cli@latest dev --no-discovery -u http://localhost:3000/api/inngest
```

### 4. Access the Application

- **Dashboard**: http://localhost:3000/app/dashboard
- **Python API**: http://localhost:8001
- **API Docs**: http://localhost:8001/docs
- **Inngest Dashboard**: http://localhost:8288

## 📡 API Endpoints

### Pattern Discovery
```http
POST /api/agents/mexc/pattern-discovery
{
  "action": "start" | "stop" | "status"
}
```

### Token Analysis
```http
POST /api/agents/mexc/analyze-token
{
  "symbol": "BTCUSDT"
}
```

### Trading Strategy
```http
POST /api/agents/mexc/trading-strategy
{
  "buy_amount_usdt": 100,
  "max_concurrent_snipes": 3
}
```

## 🤖 AI Agents

### MEXC Pattern Discovery Agent
- Monitors new token listings on MEXC calendar
- Detects "ready state" patterns in symbol data
- Correlates calendar and trading data
- Provides advance notice of trading opportunities

### MEXC Trading Strategy Agent
- Generates trading strategies for ready tokens
- Calculates optimal entry timing
- Provides risk management parameters
- Plans execution strategies

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