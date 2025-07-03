# MEXC Sniper Bot - Quick Start Guide 🚀

## ⚡ Quick Setup (2 minutes)

### 1. Install Dependencies
```bash
bun install && bun run db:migrate:safe
```

### 2. Configure Environment
Create a `.env.local` file:
```bash
# Required for TypeScript Multi-Agent System
OPENAI_API_KEY=your-openai-api-key

# Optional MEXC API credentials
MEXC_API_KEY=your-mexc-api-key
MEXC_SECRET_KEY=your-mexc-secret-key

# Database (optional - defaults to SQLite)
DATABASE_URL=sqlite:///./mexc_sniper.db

# Caching (optional - for performance boost)
VALKEY_URL=redis://localhost:6379/0
```

### 3. Start Development Servers

**Terminal 1 - Next.js + TypeScript Agents:**
```bash
bun run dev
# Frontend: http://localhost:3000
# TypeScript agents integrated
```

**Terminal 2 - Inngest Multi-Agent Workflows:**
```bash
npx inngest-cli dev -u http://localhost:3000/api/inngest
# Dashboard: http://localhost:8288
# 🤖 4 specialized MEXC workflows available
```


## 🎯 What the Multi-Agent System Does

### 🤖 **Specialized AI Agents Working Together:**

1. **📅 CalendarAgent** - Discovers new MEXC listings with 3.5+ hour advance
2. **🔍 PatternDiscoveryAgent** - Detects ready state patterns (sts:2, st:2, tt:4)
3. **📊 SymbolAnalysisAgent** - Real-time readiness assessment with confidence scoring
4. **🌐 MexcApiAgent** - Smart API integration with fallback mechanisms
5. **🎭 MexcOrchestrator** - Coordinates all agents for optimal performance

### 🚀 **Intelligent Workflows:**
- **Calendar Discovery**: Auto-scans for new opportunities
- **Symbol Monitoring**: Tracks readiness with dynamic intervals
- **Pattern Analysis**: AI-powered validation with confidence scores
- **Strategy Generation**: Creates risk-adjusted trading plans

## 📊 Key Features

- **🧠 Multi-Agent AI System**: 5 specialized TypeScript agents
- **⚡ Real-time Analysis**: Continuous pattern monitoring
- **📈 Confidence Scoring**: 0-100% reliability metrics
- **🎯 Smart Timing**: 3.5+ hour advance detection
- **🛡️ Risk Management**: AI-powered risk assessment

## 🔍 Quick Commands

### TypeScript Multi-Agent Workflows (Primary System)

Trigger calendar discovery:
```bash
# Via Inngest Dashboard (http://localhost:8288)
# Or programmatically:
curl -X POST http://localhost:3000/api/inngest \
  -H "Content-Type: application/json" \
  -d '{
    "name": "mexc/calendar.poll.requested",
    "data": { "trigger": "manual", "force": false }
  }'
```

Monitor specific symbol:
```bash
curl -X POST http://localhost:3000/api/inngest \
  -H "Content-Type: application/json" \
  -d '{
    "name": "mexc/symbol.watch.requested",
    "data": {
      "vcoinId": "EXAMPLE001",
      "symbolName": "EXAMPLECOIN",
      "attempt": 1
    }
  }'
```


## ⚠️ Important Notes

1. **API Keys**: Ensure your OpenAI API key is valid
2. **MEXC Credentials**: Optional but recommended for full functionality
3. **Development**: Use small amounts when testing
4. **Production**: Deploy to Vercel for best performance

## 📈 Next Steps

1. Explore the dashboard at http://localhost:3000/app/dashboard
2. Read the [full documentation](README.md)
3. Configure your trading parameters
4. Deploy to production when ready

- Be aware that a CI/CD workflow runs on GitHub Actions for pushes/PRs to `main` to ensure code quality.

Happy trading! 🎯💰