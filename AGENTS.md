# AGENTS.md

Quick setup guide for AI agents working with this MEXC sniper bot codebase.

## 🚀 Quick Setup
```bash
# Run automated setup script
./SETUP.sh

# Or manual setup:
bun install && bun run db:migrate
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
5 specialized TypeScript agents with OpenAI GPT-4 integration for MEXC trading automation.

## ⚡ Testing
Unit tests in `__tests__/unit/`, E2E tests in `all-tests/e2e-tests/`. Always run tests before pushing.

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
