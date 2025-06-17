# Claude AI Assistant Instructions

This file contains instructions and context for Claude AI assistant when working on the MEXC Sniper Bot project.

## Project Overview

This is a TypeScript-based multi-agent trading bot system for the MEXC cryptocurrency exchange. The system features:

- 🤖 5 specialized TypeScript AI agents with GPT-4 integration
- ⚡ Inngest workflow orchestration for reliable event-driven tasks
- 🗄️ Drizzle ORM with PostgreSQL/TursoDB support for data persistence
- 🔄 TanStack Query for real-time data fetching and caching
- 🔐 Kinde Auth for secure user authentication
- 🏢 Serverless deployment optimized for Vercel with edge functions
- 📊 Real-time MEXC exchange integration for trading signals
- 🎯 Pattern discovery for ready state detection
- 💼 User-configurable take profit levels and risk management

## Architecture

The system operates entirely in TypeScript with no Python dependencies, designed for modern serverless deployment with global edge optimization.

### Key Components

1. **Multi-Agent System** (`src/mexc-agents/`)
   - MexcApiAgent: MEXC API analysis and signal extraction
   - PatternDiscoveryAgent: Ready state pattern detection
   - CalendarAgent: New listing discovery and monitoring
   - SymbolAnalysisAgent: Real-time readiness assessment
   - MexcOrchestrator: Multi-agent workflow coordination

2. **Database Layer** (`src/db/`)
   - Drizzle ORM for type-safe database operations
   - PostgreSQL/TursoDB for production
   - Comprehensive migration system

3. **API Routes** (`app/api/`)
   - RESTful API endpoints for all system operations
   - Authentication-protected routes
   - Real-time webhook integrations

4. **Frontend** (`app/` and `src/components/`)
   - Next.js 14 with App Router
   - Real-time dashboard with TanStack Query
   - Comprehensive monitoring and configuration interfaces

## Development Guidelines

### Testing
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- E2E tests: `tests/e2e/`
- Run tests: `make test` or `npm test`

### Database Operations
- Always use transactions for critical operations
- Implement proper error handling and rollback
- Use the connection pool for optimal performance

### Code Style
- Follow existing TypeScript patterns
- Use Drizzle ORM for all database operations
- Implement proper error boundaries
- Add comprehensive logging

### Security
- Never expose API keys or secrets
- Use proper input validation
- Implement rate limiting for all endpoints
- Follow authentication best practices

## Common Tasks

### Adding New API Endpoints
1. Create route in `app/api/[endpoint]/route.ts`
2. Implement proper authentication if needed
3. Add input validation using Zod schemas
4. Write comprehensive tests

### Database Changes
1. Create new migration: `npm run db:generate`
2. Review generated SQL carefully
3. Test migration on development database
4. Update schema types if needed

### Agent Development
1. Extend `BaseAgent` class
2. Implement required methods
3. Add proper error handling
4. Register with orchestrator
5. Write comprehensive tests

## Environment Setup

Key environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: Required for AI agents
- `MEXC_API_KEY` / `MEXC_SECRET_KEY`: MEXC exchange API
- `KINDE_*`: Authentication configuration
- `ENCRYPTION_MASTER_KEY`: For secure credential storage

See `.env.example` for complete configuration.

## Troubleshooting

### Common Issues
1. Database connection issues: Check `DATABASE_URL` and network connectivity
2. AI agent failures: Verify `OPENAI_API_KEY` and API limits
3. MEXC API errors: Check IP allowlisting and credential validity
4. Authentication issues: Verify Kinde configuration

### Debugging
- Enable debug logging: `DEBUG=mexc-api:*`
- Check health endpoints: `/api/health/*`
- Monitor database performance: `/api/query-performance`
- Review agent logs in browser console

## Best Practices

1. **Error Handling**: Always implement comprehensive error handling
2. **Logging**: Use structured logging for debugging
3. **Testing**: Write tests for all new functionality
4. **Security**: Never commit sensitive data
5. **Performance**: Monitor query performance and optimize as needed
6. **Documentation**: Keep documentation up to date

## Support

For issues and feature requests, refer to the comprehensive documentation in the `docs/` directory.