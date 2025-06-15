# AGENTS.md

Quick setup guide for AI agents working with this MEXC sniper bot codebase.

## 🚀 Quick Setup
```bash
# Run automated setup script
./SETUP.sh

# Or manual setup:
bun install && bun run db:migrate:safe
```

## 🛠️ Essential Commands
```bash
# Development
npm run dev                    # Start development server (port 3008)
bun run pre-commit            # Run all quality checks
bun run test                  # Run unit tests
bun run test:e2e              # Run E2E tests

# Database
bun run db:migrate:safe       # Safe migration (handles existing tables)
bun run db:migrate            # Standard migration
bun run db:check              # Check database status
bun run db:studio             # Open database GUI

# Code Quality
bun run lint:all              # Format and lint everything
bun run type-check            # TypeScript validation
```

## 📁 Key Files
- `src/mexc-agents/` - Multi-agent trading system
- `src/inngest/functions.ts` - Workflow orchestration
- `app/api/` - Next.js API routes
- `CLAUDE.md` - Detailed development guidelines
- `.env.example` - Environment variable template

## 🧠 Agent Architecture
16+ specialized TypeScript agents with OpenAI GPT-4 integration for MEXC trading automation.

### Core Trading Agents
- **BaseAgent**: Foundation class with OpenAI integration and caching
- **MexcApiAgent**: Intelligent API integration and data analysis
- **PatternDiscoveryAgent**: Ready state pattern detection (sts:2, st:2, tt:4)
- **CalendarAgent**: New listing discovery and launch timing
- **SymbolAnalysisAgent**: Real-time readiness assessment
- **StrategyAgent**: AI-powered trading strategy creation

### Risk Management & Safety Agents
- **SafetyBaseAgent**: Core safety monitoring and circuit breaker controls
- **SafetyMonitorAgent**: Real-time safety monitoring and alerts
- **RiskManagerAgent**: Position sizing, risk metrics, and circuit breakers
- **ErrorRecoveryAgent**: System health monitoring and automatic recovery
- **ReconciliationAgent**: Balance verification and position tracking
- **SimulationAgent**: Strategy backtesting and paper trading validation

### Orchestration & Coordination
- **MultiAgentOrchestrator**: Workflow coordination and result synthesis
- **MexcOrchestrator**: Specialized MEXC workflow execution
- **AgentManager**: Agent lifecycle and health management
- **WebSocketAgentBridge**: Real-time data integration bridge

## ⚡ Testing & Quality
Comprehensive testing framework with multiple approaches:
- **Unit Tests**: `tests/unit/` (Vitest)
- **E2E Tests**: `tests/e2e/` (Playwright)
- **Stagehand Tests**: `tests/stagehand/` (AI-powered E2E)
- **Integration Tests**: `tests/integration/` (Agent system testing)

**Quality Standards:**
- ✅ 293 tests with 96%+ pass rate
- ✅ TypeScript compiles with 0 errors
- ✅ Build completes successfully
- ✅ Linting passes (some warnings OK)

```bash
# Complete quality check
make test && make lint && bun run type-check && bun run build
```

## 🔧 Troubleshooting

### Database Issues
```bash
# "table already exists" error
bun run db:migrate:safe        # Use safe migration

# Connection issues
bun run db:check              # Check database status

# Reset database (development only)
bun run db:reset && bun run db:migrate
```

### Build Issues
```bash
# TypeScript errors
bun run type-check            # Check types

# Linting issues
bun run lint:all              # Fix formatting

# Missing dependencies
bun install                   # Reinstall packages
```

### TypeScript Hanging Issues (Containers/CI)
If `bun run type-check` or `tsc --noEmit` hangs in containerized environments:

```bash
# Method 1: Clear build cache first
rm -rf .next .tsbuildinfo node_modules/.cache
bun run type-check

# Method 2: Use skipLibCheck for faster checking
npx tsc --noEmit --skipLibCheck

# Method 3: Increase memory limit (containers)
NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit

# Method 4: Check specific files only
npx tsc --noEmit src/components/auth/kinde-auth-provider.tsx

# Method 5: Use build command (includes type checking)
bun run build

# Method 6: Kill hanging processes
pkill -f tsc || true
pkill -f "node.*tsc" || true

# Check log file if using setup script
cat /tmp/setup_typecheck.log
```

**Common causes:**
- Stale incremental build cache (`.next`, `.tsbuildinfo`)
- Memory constraints in containers
- File system differences between environments
- Different Node.js/TypeScript versions

**Resolution priority:** Try methods 1-3 first, then fall back to method 5 (build) as it includes comprehensive checking.

### Agent System
```bash
# Check agent health
bun run agents:health         # Run health check

# Test agents
bun run agents:test           # Run agent tests
```

### Environment Setup
- Copy `.env.example` to `.env.local`
- Set required environment variables
- Check `CLAUDE.md` for detailed troubleshooting
