# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🛠️ Development Tools

### Code Quality & Formatting

This project uses modern TypeScript development tools:

**TypeScript/JavaScript:**
- **Biome.js** - Fast formatter and linter (configured in `biome.json`)
- **TypeScript** - Built-in type checking with `tsc`

### Database

The project supports two database backends:
- **SQLite** (default) - Local development database
- **TursoDB** - Edge-hosted distributed database with SQLite compatibility

To switch to TursoDB:
1. Run `bun run setup:turso` to configure TursoDB
2. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in your `.env.local` file

## Project Overview

This is a modern Next.js project featuring a sophisticated TypeScript multi-agent system for MEXC cryptocurrency trading. The architecture is purely TypeScript-based with:

- **Frontend**: Next.js 15 with TypeScript and React 19
- **Multi-Agent System**: 5 specialized TypeScript agents with OpenAI GPT-4 integration
- **Workflows**: Inngest for reliable event-driven task orchestration
- **Database**: Drizzle ORM with SQLite/TursoDB support
- **Data Management**: TanStack Query for real-time data fetching and caching
- **Architecture**: Serverless deployment on Vercel with edge optimization

## Common Development Commands

### Code Quality

```bash
# Run all linting and formatting (TypeScript only)
bun run lint:all

# Run linting individually
bun run lint          # TypeScript/JavaScript with Biome
bun run format        # Format code with Biome

# Type checking
bun run type-check    # TypeScript

# Pre-commit checks (runs all checks)
bun run pre-commit
```

### Development

```bash
# Run Next.js frontend with TypeScript agents (port 3008)
npm run dev

# Run Inngest dev server for TypeScript multi-agent workflows
npx inngest-cli dev -u http://localhost:3008/api/inngest

# Access Inngest dashboard at http://localhost:8288
```

### Database Operations

```bash
# Generate new migrations
bun run db:generate

# Apply migrations
bun run db:migrate

# Open database studio
bun run db:studio

# Reset database (WARNING: destroys all data)
bun run db:reset
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

The system is built entirely in TypeScript with specialized agents:

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
- `/api/triggers/*` → Manual workflow trigger endpoints
- `/api/schedule/control` → Workflow scheduling control

### Database & Data Management

- **Database**: Drizzle ORM with SQLite/TursoDB (`src/db/schema.ts`)
- **Data Fetching**: TanStack Query for real-time data management (`src/hooks/`)
- **TypeScript API Client**: Direct MEXC integration (`src/services/mexc-api-client.ts`)

## Environment Variables

Required for TypeScript multi-agent system:
```bash
# Core AI Integration
OPENAI_API_KEY=your-openai-api-key  # Required for all agents

# MEXC API Access
MEXC_API_KEY=your-mexc-api-key      # Optional
MEXC_SECRET_KEY=your-mexc-secret    # Optional
MEXC_BASE_URL=https://api.mexc.com  # Default

# Database
DATABASE_URL=sqlite:///./mexc_sniper.db  # Default SQLite
# TursoDB (optional)
TURSO_DATABASE_URL=your-turso-url
TURSO_AUTH_TOKEN=your-turso-token

# Workflow Orchestration (auto-generated if not provided)
INNGEST_SIGNING_KEY=auto-generated
INNGEST_EVENT_KEY=auto-generated
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
│   │   ├── functions.ts       # MEXC workflows
│   │   └── scheduled-functions.ts # Automated scheduling
│   ├── db/                    # 🗄️ Database layer
│   │   ├── schema.ts          # Drizzle schema
│   │   ├── index.ts           # Database client
│   │   └── migrations/        # Database migrations
│   ├── hooks/                 # 🪝 TanStack Query hooks
│   │   ├── use-mexc-data.ts   # MEXC data fetching
│   │   └── use-user-preferences.ts # User settings
│   ├── services/              # 🌐 External services
│   │   └── mexc-api-client.ts # TypeScript MEXC client
│   └── components/            # ⚛️ React components
│       ├── coin-calendar.tsx  # Calendar display
│       ├── user-preferences.tsx # Settings management
│       ├── query-provider.tsx # TanStack provider
│       └── ui/               # UI components
├── app/                       # 🌐 Next.js app directory
│   ├── api/inngest/route.ts   # TypeScript workflow endpoint
│   ├── api/triggers/         # Manual workflow triggers
│   ├── api/schedule/         # Scheduling control
│   └── dashboard/            # Trading dashboard
└── vercel.json               # ⚙️ Vercel deployment config
```

## User Configuration System

The system includes a comprehensive user preference system:

### Take Profit Levels
- **Level 1**: Conservative (default: 5%)
- **Level 2**: Moderate (default: 10%)
- **Level 3**: Aggressive (default: 15%)
- **Level 4**: Very Aggressive (default: 25%)
- **Custom**: User-defined percentage

### Trading Preferences
- Default buy amount in USDT
- Maximum concurrent trading positions
- Risk tolerance (low/medium/high)
- Ready state pattern configuration
- Stop loss percentages
- Target advance detection hours

## Data Flow Architecture

```
User Dashboard ←→ TanStack Query ←→ TypeScript MEXC Client ←→ MEXC API
       ↓                ↓                      ↓
   User Actions → Inngest Workflows → Multi-Agent System
       ↓                ↓                      ↓
   Configuration → Database (Drizzle) ← Agent Results
```

## Development Guidelines

1. **Pure TypeScript**: All new code should be in TypeScript
2. **Drizzle ORM**: Use Drizzle for all database operations
3. **TanStack Query**: Use for all data fetching and caching
4. **Agent Pattern**: Follow the established agent architecture
5. **Error Handling**: Implement comprehensive error handling
6. **Type Safety**: Maintain strict TypeScript typing
7. **Testing**: Write tests for new functionality
8. **Documentation**: Add JSDoc comments for complex functions

## Common Workflows

### Adding a New Agent
1. Create agent file in `src/mexc-agents/`
2. Extend base agent class
3. Implement required methods
4. Add to orchestrator
5. Create corresponding Inngest workflow
6. Add tests

### Adding New Database Tables
1. Define schema in `src/db/schema.ts`
2. Generate migration: `bun run db:generate`
3. Apply migration: `bun run db:migrate`
4. Create TypeScript types
5. Add TanStack Query hooks

### Adding User Configuration
1. Update user preferences schema
2. Create migration for new fields
3. Add UI components for configuration
4. Update hooks for data management
5. Test configuration persistence

## Debugging & Monitoring

- **Inngest Dashboard**: http://localhost:8288 (development)
- **Database Studio**: `bun run db:studio`
- **Network Monitoring**: TanStack Query DevTools
- **Console Logs**: Browser DevTools for frontend debugging

## Important Notes

- **No Python Dependencies**: The system is purely TypeScript/JavaScript
- **Serverless Architecture**: Designed for Vercel deployment
- **Real-time Data**: Uses TanStack Query for live data updates
- **AI Integration**: All agents use OpenAI GPT-4 for intelligence
- **Error Recovery**: Multi-agent fallbacks for robust operation
- **User Configurable**: Extensive customization options