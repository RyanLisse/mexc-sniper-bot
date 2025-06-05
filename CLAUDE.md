# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🛠️ Development Tools

### Code Quality & Formatting

This project uses modern tools for code quality and formatting:

**Python:**
- **Ruff** - Fast Python linter and formatter (configured in `pyproject.toml`)
- **ty** - Experimental Rust-based Python type checker from Astral
- **pyright** - Production-ready type checker
- **Always use bun and uv for python**

**TypeScript/JavaScript:**
- **Biome.js** - Fast formatter and linter (configured in `biome.json`)
- **TypeScript** - Built-in type checking with `tsc`

### Database

The project supports two database backends:
- **PostgreSQL/SQLite** (default) - Traditional setup
- **TursoDB** - Edge-hosted distributed database with SQLite compatibility

To switch to TursoDB:
1. Run `bun run setup:turso` to configure TursoDB
2. Set `USE_TURSO_DB=true` in your `.env.local` file

## Project Overview

This is a modern Next.js project featuring a sophisticated TypeScript multi-agent system for MEXC cryptocurrency trading. It combines:
- **Frontend**: Next.js 15 with TypeScript and React 19
- **Multi-Agent System**: 5 specialized TypeScript agents with OpenAI GPT-4 integration
- **Workflows**: Inngest for reliable event-driven task orchestration
- **Legacy Backend**: Python FastAPI (maintained for compatibility)
- **Architecture**: Serverless deployment on Vercel with edge optimization

## Common Development Commands

### Code Quality

```bash
# Run all linting and formatting (Python + TypeScript)
bun run lint:all

# Run linting individually
bun run lint          # TypeScript/JavaScript with Biome
uv run ruff check     # Python linting
uv run ruff format    # Python formatting

# Type checking
bun run type-check    # TypeScript
uvx ty check          # Python (experimental)

# Pre-commit checks (runs all checks)
bun run pre-commit
```

### Development

```bash
# Run Next.js frontend with TypeScript agents (port 3000)
npm run dev

# Run Inngest dev server for TypeScript multi-agent workflows
npx inngest-cli dev -u http://localhost:3000/api/inngest

# Run Python API for legacy support (port 8001)
npm run mexc-agent-dev
# OR
uvicorn api.agents:app --reload --port 8001

# Test TypeScript agents via Inngest workflows
# Access Inngest dashboard at http://localhost:8288
```

### Testing

```bash
# Run Python tests
pytest

# Run specific test file
pytest tests/test_mexc_api.py

# Run with coverage
pytest --cov=src

# Lint TypeScript/JavaScript
npm run lint
```

### Build & Deployment

```bash
# Build Next.js app
npm run build

# Deploy to Vercel (after git push)
vercel --prod
```

## Architecture Overview

### TypeScript Multi-Agent System

The core system now runs on specialized TypeScript agents:

#### **🎯 Core Agents** (`src/mexc-agents/`)

1. **MexcApiAgent** (`mexc-api-agent.ts`)
   - MEXC API interactions and data analysis
   - Trading signal extraction with AI
   - Data quality assessment and validation

2. **PatternDiscoveryAgent** (`pattern-discovery-agent.ts`)
   - Ready state pattern detection: `sts:2, st:2, tt:4`
   - Early opportunity identification (3.5+ hour advance)
   - Confidence scoring and pattern validation

3. **CalendarAgent** (`calendar-agent.ts`)
   - New listing discovery and monitoring
   - Launch timing analysis and predictions
   - Market potential assessment

4. **SymbolAnalysisAgent** (`symbol-analysis-agent.ts`)
   - Real-time readiness assessment
   - Market microstructure analysis
   - Risk evaluation and confidence scoring

5. **MexcOrchestrator** (`orchestrator.ts`)
   - Multi-agent workflow coordination
   - Result synthesis and error handling
   - Performance optimization

#### **🚀 Inngest Workflows** (`src/inngest/functions.ts`)

1. **pollMexcCalendar** - Multi-agent calendar discovery
2. **watchMexcSymbol** - Symbol monitoring with AI analysis
3. **analyzeMexcPatterns** - Pattern discovery and validation
4. **createMexcTradingStrategy** - AI-powered strategy creation

### API Routes

- `/api/inngest` → TypeScript multi-agent workflows
- `/api/agents/*` → Python FastAPI agents (legacy support)

### Legacy Python Components (Maintained)

- **MEXC Pattern Discovery Agent** (`api/agents.py`) - Legacy rule-based system
- **Python Inngest Handler** (`api/inngest.py`) - Python workflow support

### Database & Caching

- **Database**: SQLModel with AsyncPG/AioSQLite (`src/database.py`)
- **Models**: Defined in `src/models.py`
- **Caching**: Valkey integration in `src/services/cache_service.py` (Redis-compatible)

## Environment Variables

Required for TypeScript multi-agent system:
```bash
# Core AI Integration
OPENAI_API_KEY=your-openai-api-key  # Required for all agents

# MEXC API Access
MEXC_API_KEY=your-mexc-api-key      # Optional
MEXC_SECRET_KEY=your-mexc-secret    # Optional
MEXC_BASE_URL=https://api.mexc.com  # Default

# Workflow Orchestration
# INNGEST_SIGNING_KEY=auto-generated  # Optional, auto-generated if not provided
# INNGEST_EVENT_KEY=auto-generated    # Optional, auto-generated if not provided

# Database & Caching
DATABASE_URL=sqlite:///./mexc_sniper.db  # Default SQLite
VALKEY_URL=redis://localhost:6379/0      # Optional Redis/Valkey caching
```

## Project Structure

```
├── src/                         # TypeScript source code
│   ├── mexc-agents/            # 🤖 Multi-agent system
│   │   ├── mexc-api-agent.ts   # MEXC API integration
│   │   ├── pattern-discovery-agent.ts  # Pattern detection
│   │   ├── calendar-agent.ts   # Calendar monitoring
│   │   ├── symbol-analysis-agent.ts    # Symbol analysis
│   │   ├── orchestrator.ts     # Workflow coordination
│   │   └── index.ts           # Agent exports
│   ├── agents/                 # 🧠 General AI agents
│   │   ├── base-agent.ts       # Base agent class
│   │   ├── research-agent.ts   # Research capabilities
│   │   ├── analysis-agent.ts   # Market analysis
│   │   ├── strategy-agent.ts   # Trading strategies
│   │   └── index.ts           # Agent exports
│   ├── inngest/               # 🚀 Workflow definitions
│   │   ├── client.ts          # Inngest client
│   │   └── functions.ts       # MEXC workflows
│   ├── services/              # 🐍 Python services (legacy)
│   ├── models.py              # Database models
│   └── database.py            # Database configuration
├── app/                       # 🌐 Next.js app directory
│   ├── api/inngest/route.ts   # TypeScript workflow endpoint
│   └── dashboard/             # Trading dashboard
├── api/                       # 🐍 Python API endpoints (legacy)
│   ├── agents.py             # Legacy MEXC agents
│   └── inngest.py            # Python workflow handler
├── tests/                     # 🧪 Test suite
└── vercel.json               # ⚙️ Vercel deployment config
```

## Critical Deployment Configuration

The `vercel.json` file ensures proper routing:
1. Next.js builds first
2. Python API builds second
3. Routes explicitly map `/api/agents/*` to Python

This order and routing configuration is essential for the hybrid architecture to work correctly on Vercel.