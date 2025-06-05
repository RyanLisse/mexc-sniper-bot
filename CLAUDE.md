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

This is a hybrid Next.js/Python project for a MEXC cryptocurrency trading bot with AI agents. It combines:
- **Frontend**: Next.js 15 with TypeScript and React 19
- **Backend**: Python FastAPI with OpenAI Agents framework
- **Architecture**: Serverless deployment on Vercel with Inngest workflows

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
# Run Next.js frontend (port 3000)
npm run dev

# Run Python MEXC agent API (port 8001)
npm run mexc-agent-dev
# OR
uvicorn api.agents:app --reload --port 8001

# Run Inngest dev server
npx inngest-cli dev --no-discovery -u http://localhost:3000/api/inngest

# Test MEXC agent functionality
npm run mexc-test
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

### API Routes

- `/api/agents/*` → Python FastAPI agents (handled by `api/agents.py`)
- `/api/inngest` → Inngest webhook endpoint
- `/api/newsletter/*` → Newsletter generation endpoints

### Key Python Components

1. **MEXC Pattern Discovery Agent** (`api/agents.py`)
   - Discovers token launch patterns using AI
   - Tools: MEXCCalendarTool, MEXCSymbolsV2Tool, MEXCPatternAnalysisTool
   - Ready pattern detection: `sts:2, st:2, tt:4`

2. **MEXC Trading Strategy Agent** (`api/agents.py`)
   - Generates trading strategies for ready tokens
   - Provides entry timing and risk management

### Key TypeScript Components

1. **Inngest Functions** (`src/inngest/functions.ts`)
   - Orchestrates long-running workflows
   - Handles newsletter generation pipeline

2. **Next.js App** (`src/app/`)
   - Dashboard UI at `/app/dashboard/page.tsx`
   - API route handlers in `/app/api/`

### Database & Caching

- **Database**: SQLModel with AsyncPG/AioSQLite (`src/database.py`)
- **Models**: Defined in `src/models.py`
- **Caching**: Redis integration in `src/services/cache_service.py`

## Environment Variables

Required for development:
```bash
OPENAI_API_KEY=your-openai-api-key
MEXC_API_KEY=your-mexc-api-key      # Optional
MEXC_SECRET_KEY=your-mexc-secret    # Optional
NEWSLETTER_READ_WRITE_TOKEN=your-vercel-blob-token
INNGEST_SIGNING_KEY=your-inngest-key
```

## Project Structure

```
├── api/                    # Python API endpoints
│   ├── agents.py          # MEXC AI agents
│   └── inngest.py         # Inngest Python handler
├── src/                   # Python source code
│   ├── services/          # MEXC API, pattern discovery
│   ├── models.py          # Database models
│   └── database.py        # Database configuration
├── app/                   # Next.js app directory
├── tests/                 # Python tests
└── vercel.json           # Vercel deployment config
```

## Critical Deployment Configuration

The `vercel.json` file ensures proper routing:
1. Next.js builds first
2. Python API builds second
3. Routes explicitly map `/api/agents/*` to Python

This order and routing configuration is essential for the hybrid architecture to work correctly on Vercel.