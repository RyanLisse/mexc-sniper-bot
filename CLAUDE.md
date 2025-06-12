# Claude Code Configuration - SPARC Development Environment

## Project Overview
This project uses the SPARC (Specification, Pseudocode, Architecture, Refinement, Completion) methodology for systematic Test-Driven Development with AI assistance through Claude-Flow orchestration.

## SPARC Development Commands

### Core SPARC Commands
- `npx claude-flow sparc modes`: List all available SPARC development modes
- `npx claude-flow sparc run <mode> "<task>"`: Execute specific SPARC mode for a task
- `npx claude-flow sparc tdd "<feature>"`: Run complete TDD workflow using SPARC methodology
- `npx claude-flow sparc info <mode>`: Get detailed information about a specific mode

### Standard Build Commands
- `npm run build`: Build the project
- `npm run test`: Run the test suite
- `npm run lint`: Run linter and format checks
- `npm run typecheck`: Run TypeScript type checking

## SPARC Methodology Workflow

### 1. Specification Phase
```bash
# Create detailed specifications and requirements
npx claude-flow sparc run spec-pseudocode "Define user authentication requirements"
```
- Define clear functional requirements
- Document edge cases and constraints
- Create user stories and acceptance criteria
- Establish non-functional requirements

### 2. Pseudocode Phase
```bash
# Develop algorithmic logic and data flows
npx claude-flow sparc run spec-pseudocode "Create authentication flow pseudocode"
```
- Break down complex logic into steps
- Define data structures and interfaces
- Plan error handling and edge cases
- Create modular, testable components

### 3. Architecture Phase
```bash
# Design system architecture and component structure
npx claude-flow sparc run architect "Design authentication service architecture"
```
- Create system diagrams and component relationships
- Define API contracts and interfaces
- Plan database schemas and data flows
- Establish security and scalability patterns

### 4. Refinement Phase (TDD Implementation)
```bash
# Execute Test-Driven Development cycle
npx claude-flow sparc tdd "implement user authentication system"
```

**TDD Cycle:**
1. **Red**: Write failing tests first
2. **Green**: Implement minimal code to pass tests
3. **Refactor**: Optimize and clean up code
4. **Repeat**: Continue until feature is complete

### 5. Completion Phase
```bash
# Integration, documentation, and validation
npx claude-flow sparc run integration "integrate authentication with user management"
```
- Integrate all components
- Perform end-to-end testing
- Create comprehensive documentation
- Validate against original requirements

## SPARC Mode Reference

### Development Modes
- **`architect`**: System design and architecture planning
- **`code`**: Clean, modular code implementation
- **`tdd`**: Test-driven development and testing
- **`spec-pseudocode`**: Requirements and algorithmic planning
- **`integration`**: System integration and coordination

### Quality Assurance Modes
- **`debug`**: Troubleshooting and bug resolution
- **`security-review`**: Security analysis and vulnerability assessment
- **`refinement-optimization-mode`**: Performance optimization and refactoring

### Support Modes
- **`docs-writer`**: Documentation creation and maintenance
- **`devops`**: Deployment and infrastructure management
- **`mcp`**: External service integration

## Code Style and Best Practices

### SPARC Development Principles
- **Modular Design**: Keep files under 500 lines, break into logical components
- **Environment Safety**: Never hardcode secrets or environment-specific values
- **Test-First**: Always write tests before implementation (Red-Green-Refactor)
- **Clean Architecture**: Separate concerns, use dependency injection
- **Documentation**: Maintain clear, up-to-date documentation

### Coding Standards
- Use TypeScript for type safety and better tooling
- Follow consistent naming conventions (camelCase for variables, PascalCase for classes)
- Implement proper error handling and logging
- Use async/await for asynchronous operations
- Prefer composition over inheritance

### Memory and State Management
- Use claude-flow memory system for persistent state across sessions
- Store progress and findings using namespaced keys
- Query previous work before starting new tasks
- Export/import memory for backup and sharing

## SPARC Memory Integration

### Memory Commands for SPARC Development
```bash
# Store project specifications
npx claude-flow memory store spec_auth "User authentication requirements and constraints"

# Store architectural decisions
npx claude-flow memory store arch_decisions "Database schema and API design choices"

# Store test results and coverage
npx claude-flow memory store test_coverage "Authentication module: 95% coverage, all tests passing"

# Query previous work
npx claude-flow memory query auth_implementation

# Export project memory
npx claude-flow memory export project_backup.json
```

### Memory Namespaces
- **`spec`**: Requirements and specifications
- **`arch`**: Architecture and design decisions
- **`impl`**: Implementation notes and code patterns
- **`test`**: Test results and coverage reports
- **`debug`**: Bug reports and resolution notes

## Workflow Examples

### Feature Development Workflow
```bash
# 1. Start with specification
npx claude-flow sparc run spec-pseudocode "User profile management feature"

# 2. Design architecture
npx claude-flow sparc run architect "Profile service architecture with data validation"

# 3. Implement with TDD
npx claude-flow sparc tdd "user profile CRUD operations"

# 4. Security review
npx claude-flow sparc run security-review "profile data access and validation"

# 5. Integration testing
npx claude-flow sparc run integration "profile service with authentication system"

# 6. Documentation
npx claude-flow sparc run docs-writer "profile service API documentation"
```

### Bug Fix Workflow
```bash
# 1. Debug and analyze
npx claude-flow sparc run debug "authentication token expiration issue"

# 2. Write regression tests
npx claude-flow sparc run tdd "token refresh mechanism tests"

# 3. Implement fix
npx claude-flow sparc run code "fix token refresh in authentication service"

# 4. Security review
npx claude-flow sparc run security-review "token handling security implications"
```

## Configuration Files

### SPARC Configuration
- **`.roomodes`**: SPARC mode definitions and configurations
- **`.roo/`**: Templates, workflows, and mode-specific rules

### Claude-Flow Configuration
- **`memory/`**: Persistent memory and session data
- **`coordination/`**: Multi-agent coordination settings

## Git Workflow Integration

### Commit Strategy with SPARC
- **Specification commits**: After completing requirements analysis
- **Architecture commits**: After design phase completion
- **TDD commits**: After each Red-Green-Refactor cycle
- **Integration commits**: After successful component integration
- **Documentation commits**: After completing documentation updates

### Branch Strategy
- **`feature/sparc-<feature-name>`**: Feature development with SPARC methodology
- **`hotfix/sparc-<issue>`**: Bug fixes using SPARC debugging workflow
- **`refactor/sparc-<component>`**: Refactoring using optimization mode

## Troubleshooting

### Common SPARC Issues
- **Mode not found**: Check `.roomodes` file exists and is valid JSON
- **Memory persistence**: Ensure `memory/` directory has write permissions
- **Tool access**: Verify required tools are available for the selected mode
- **Namespace conflicts**: Use unique memory namespaces for different features

### Debug Commands
```bash
# Check SPARC configuration
npx claude-flow sparc modes

# Verify memory system
npx claude-flow memory stats

# Check system status
npx claude-flow status

# View detailed mode information
npx claude-flow sparc info <mode-name>
```

## Project Architecture

This SPARC-enabled project follows a systematic development approach:
- **Clear separation of concerns** through modular design
- **Test-driven development** ensuring reliability and maintainability
- **Iterative refinement** for continuous improvement
- **Comprehensive documentation** for team collaboration
- **AI-assisted development** through specialized SPARC modes

## Important Notes

- Always run tests before committing (`npm run test`)
- Use SPARC memory system to maintain context across sessions
- Follow the Red-Green-Refactor cycle during TDD phases
- Document architectural decisions in memory for future reference
- Regular security reviews for any authentication or data handling code

For more information about SPARC methodology, see: https://github.com/ruvnet/claude-code-flow/docs/sparc.md
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

# Apply migrations (standard)
bun run db:migrate

# Apply migrations (safe - handles existing tables)
bun run db:migrate:safe

# Check database connection and status
bun run db:check

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

## Code Quality Standards

### Recent Improvements (Latest)

The codebase has been significantly improved with:

**TypeScript Compliance:**
- ✅ Zero TypeScript compilation errors
- ✅ Proper type assertions for library compatibility
- ✅ Removed all `any` usage with proper type guards
- ✅ Fixed useEffect dependency arrays

**Accessibility (a11y):**
- ✅ Proper semantic HTML elements (button vs div)
- ✅ Label associations with htmlFor attributes
- ✅ Keyboard navigation support
- ✅ ARIA attributes for screen readers

**React Best Practices:**
- ✅ Meaningful keys for mapped elements
- ✅ useCallback for stable function references
- ✅ Proper button types to prevent form submission

**Code Quality:**
- ✅ All 96 tests passing
- ✅ Eliminated unused variables
- ✅ Safe optional chaining over non-null assertions
- ✅ Consistent code formatting with Biome

### Quality Checks

```bash
# Run complete quality check
make test && make lint && bun run type-check

# Individual checks
bun run type-check    # Must pass with 0 errors
make test            # All 96 tests must pass
make lint            # Check for issues (some warnings acceptable)
bun run build        # Must complete successfully
```

## Troubleshooting

### Database Issues

#### Migration Errors: "table already exists"
This is common when working with persistent databases like TursoDB:

```bash
# Solution 1: Use safe migration
bun run db:migrate:safe

# Solution 2: Check database status first
bun run db:check

# Solution 3: For development, reset and migrate
bun run db:reset && bun run db:migrate
```

#### TursoDB Connection Issues
```bash
# Check environment variables
echo $TURSO_DATABASE_URL
echo $TURSO_AUTH_TOKEN

# Test database connection
bun run db:check

# Verify TursoDB configuration in drizzle.config.ts
```

#### SQLite Permission Issues
```bash
# Fix permissions (development)
chmod 664 mexc_sniper.db

# Reset database if corrupted
bun run db:reset
```

### Deployment Issues

#### Vercel Environment Variables
Ensure these are set in Vercel Dashboard:
```bash
AUTH_SECRET=your-production-secret
TURSO_DATABASE_URL=your-turso-url
TURSO_AUTH_TOKEN=your-turso-token
OPENAI_API_KEY=your-openai-key
```

#### Build Failures
```bash
# Check TypeScript errors
bun run type-check

# Check linting issues
bun run lint:check

# Test build locally
bun run build
```

#### TypeScript Hanging in Containers/CI
If TypeScript checking hangs in containerized or CI environments:

```bash
# Priority fix: Clear build cache first
rm -rf .next .tsbuildinfo node_modules/.cache && bun run type-check

# Alternative methods if still hanging:
npx tsc --noEmit --skipLibCheck                           # Skip lib checking
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit # Increase memory
bun run build                                             # Use build (includes type check)

# Kill hanging processes
pkill -f tsc || pkill -f "node.*tsc" || true

# Debug: Check what's in the log
cat /tmp/setup_typecheck.log
```

**Root causes:** Stale incremental build cache, memory constraints, file system differences between local and container environments.

### Authentication Issues

#### 500 Errors on Auth Endpoints
Usually missing environment variables in production:
```bash
# Check if AUTH_SECRET is set
# Check if database is accessible
# Verify Better Auth configuration
```

#### Local vs Production Differences
```bash
# Test locally first
curl http://localhost:3008/api/auth/get-session

# Compare with production
curl https://your-app.vercel.app/api/auth/get-session
```

### Agent System Issues

#### Agent Health Check
```bash
# Run agent health check
bun run agents:health

# Test individual agents
bun run agents:test
```

### Performance Issues

#### Query Performance
```bash
# Monitor queries in development
bun run db:studio

# Check slow queries
bun run test:performance
```

## Important Notes

- **No Python Dependencies**: The system is purely TypeScript/JavaScript
- **Serverless Architecture**: Designed for Vercel deployment
- **Real-time Data**: Uses TanStack Query for live data updates
- **AI Integration**: All agents use OpenAI GPT-4 for intelligence
- **Error Recovery**: Multi-agent fallbacks for robust operation
- **User Configurable**: Extensive customization options
