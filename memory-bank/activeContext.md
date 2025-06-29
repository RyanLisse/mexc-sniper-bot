# Active Context (2025-06-29)

## Current Focus
**Memory Bank Assessment and Optimization** - Ensuring comprehensive project knowledge capture for persistent AI agent sessions and seamless developer onboarding.

## Recent Changes
- Completed comprehensive Memory Bank structure assessment
- All core Memory Bank files (`projectbrief.md`, `productContext.md`, `systemPatterns.md`, `techContext.md`, `progress.md`) are implemented and current
- Updated CLAUDE.md with Memory Bank integration policy requiring all agents to read memory bank files at task start
- Authentication migration work in progress (Supabase auth components added alongside existing Kinde auth)

## Next Steps (Short-Term)
1. **Production Issue Resolution** - Investigate and fix auth endpoint 500 errors in production (key blocker)
2. **Authentication Migration** - Finalize Supabase auth integration alongside Kinde (dual-auth support detected in codebase)
3. **Memory Bank Automation** - Implement pre-task hooks to automatically load Memory Bank context
4. **Testing Optimization** - Address Playwright E2E test flakiness under slow networks
5. **Performance Tuning** - Implement OpenAI rate-limit retry/back-off mechanisms

## Important Decisions & Considerations
- **Documentation First** – Memory Bank is single source of truth; must be updated after every significant change.
- **File Size Limit** – All code files limited to <500 LOC; modular design enforced.
- **Security** – No secrets committed; environment variables stored in `.env.*` only.

## Patterns & Preferences
- SPARC workflow, Taskmaster for task management, Bun + Make for scripts.
- Testing stack: Vitest + Playwright + Stagehand.

## Learnings & Insights
- Large docs directory provides rich architectural context; centralising key points in Memory Bank avoids duplication.
- CLAUDE.md enforces Bun/Make workflow which aligns with SPARC philosophy.
