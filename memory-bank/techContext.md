# Tech Context

## Primary Technologies
| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 15 (React 19, App Router) | UI, SSR/SSG, API routes |
| **Language** | TypeScript 5.5 | Static typing, modern ECMAScript |
| **Package Mgr** | **Bun** 1.x | Fast installs & script runner (see `CLAUDE.md`) |
| **Database** | SQLite (dev) / NeonDB (prod) via **Drizzle ORM** | Flexible local dev & serverless Postgres prod |
| **Auth** | Supabase | Complete auth system with rate limit handling, SMTP bypass |
| **Background Jobs** | Inngest | Durable event-driven workflows |
| **AI Integration** | OpenAI GPT-4 (agents) | Pattern recognition & strategy generation |
| **Testing** | Vitest (unit), Playwright (E2E), Stagehand AI | 95 %+ coverage |
| **Observability** | OpenTelemetry, Grafana/Prometheus | Distributed tracing & metrics |
| **CI/CD** | Vercel (edge), GitHub Actions | Build, test, deploy |

## Development Setup
- **Node 20.11+** required (see `.nvmrc`).
- `bun install` for dependencies; `make dev` boots Next.js (`:3008`) & Inngest (`:8288`).
- Environment variables managed via `.env.*`; never commit secrets.
- Linting/formatting via **Biome.js**; enforced in pre-commit.

## Tooling & Scripts
- **Makefile** exposes canonical commands (`make help`).
- **Taskmaster** manages tasks (`task-master ...`).
- **Stagehand v2** generates AI-assisted E2E tests.
- **OpenTelemetry** instrumentation in `instrumentation.ts` auto-initialised in both server/client.

## Constraints & Guidelines
1. **<500 LOC per file** – enforced by code review & lints.
2. **Strict Type Safety** – `noImplicitAny`, generics preferred, Zod validation on boundaries.
3. **Security** – CSP headers, no secret leakage, production env vars via Vercel dashboard.
4. **Modularity** – Hexagonal structure, isolated adapters.
5. **Observability First** – All new code must emit trace spans/events.

## External Dependencies Snapshot (key ones)
- `next` 15.3.4 (App Router, React 19 support)
- `react` 19.0.0 (latest stable)
- `drizzle-orm` 0.44.2 (schema management and migrations)
- `inngest` 3.38.0 (event-driven workflows)
- `openai` 4.67.3 (AI agent integration)
- `@tanstack/react-query` 5.80.6 (data fetching and caching)
- `vitest` 3.2.4 (unit testing framework)
- `@playwright/test` 1.52.0 (E2E testing)
- `@biomejs/biome` 2.0.6 (linting and formatting)
- `@browserbasehq/stagehand` 2.3.0 (AI-powered E2E testing)
- `@kinde-oss/kinde-auth-nextjs` 2.7.0 (authentication)
- `@supabase/supabase-js` 2.50.2 (dual-auth support)

**Authentication Stack**: Complete Supabase authentication with advanced rate limit handling, SMTP bypass, and production-ready configuration
**AI Testing**: Stagehand v2.3.0 for autonomous browser testing with GPT-4
**Package Manager**: Bun (primary) with npm fallback support

Refer to `package.json` for full list and versions.
