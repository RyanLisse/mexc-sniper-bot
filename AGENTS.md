# MEXC Sniper Bot - Agentic Setup Guide

🤖 **Quick setup for cloud-based AI agents and automated development tools**

## 🚀 One-Command Setup
```bash
./SETUP.sh
```

## ⚡ Essential Commands
```bash
# Setup & Start
bun install && bun run db:migrate:safe   # Full setup
make dev                                 # Start dev servers (port 3008)

# Quality Checks  
make lint && make type-check && make test  # Complete validation
bun run pre-commit                          # Pre-commit checks

# Common Tasks
bun run test:e2e                         # End-to-end tests
bun run db:studio                        # Database GUI
make build                               # Production build
```

## 📁 Key Directories
- `src/mexc-agents/` - 16+ AI trading agents (TypeScript + OpenAI GPT-4)
- `memory-bank/` - Persistent project knowledge (read first!)
- `app/api/` - 50+ API routes
- `CLAUDE.md` - Complete development guidelines

## 🔧 Environment
Required: **Node.js 20.11+**, **OpenAI API key**, **Supabase credentials**
Optional: **MEXC API keys**, **NeonDB** (defaults to SQLite)

## 🧠 Architecture
Multi-agent TypeScript system with specialized agents for:
- **Calendar/Pattern/Symbol Analysis** - Market discovery & readiness detection  
- **Strategy/Risk/Safety Management** - AI-powered trading with circuit breakers
- **Orchestration/Coordination** - Multi-agent workflow management

**Quality Standards:** 293 tests, 96%+ pass rate, TypeScript strict mode, <500 LOC per file

For detailed documentation see: `docs/architecture/AGENTS.md`