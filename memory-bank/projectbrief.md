# Project Brief: MEXC Sniper Bot

## Vision
Build an intelligent, automated cryptocurrency trading platform that detects new token listings on the MEXC exchange well before launch, evaluates readiness, and executes profitable, low-risk trades on behalf of users.

## Objectives
1. Deliver a multi-agent TypeScript system capable of:
   - Discovering and analysing upcoming listings 3.5+ hours before launch.
   - Generating confidence-scored trading signals and strategies.
   - Executing trades with safety guards, risk management, and circuit breakers.
2. Provide a modern Next.js-based front-end dashboard for configuration, monitoring, and insights.
3. Achieve production-grade quality: >95 % automated test coverage, observability, and secure authentication.
4. Maintain modular, extensible, file-size-limited (<500 LOC) code that follows SPARC workflow, Taskmaster task tracking, and Memory-Bank documentation.

## Success Criteria
- Stable end-to-end pipeline from discovery to trade execution in production (Vercel + NeonDB).
- <300 ms average API latency and <5 s end-to-end strategy cycle.
- 0 critical errors during a 7-day continuous paper-trading run.
- Documentation and Memory-Bank kept fully up-to-date so new engineers can contribute within 1 hour of onboarding.
