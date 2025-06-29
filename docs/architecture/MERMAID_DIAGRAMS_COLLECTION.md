# Comprehensive Mermaid Diagrams - MEXC Sniper Bot Architecture

## 1. System Architecture Overview

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[Next.js UI Components]
        DL[Dynamic Component Loader]
        QP[Query Provider - TanStack]
        Auth[Kinde Authentication]
    end
    
    subgraph "API Layer"
        API[Next.js API Routes]
        MW[API Middleware]
        RLM[Rate Limiting]
        VAL[Validation Layer]
    end
    
    subgraph "Application Layer"
        UC[Use Cases]
        DTO[DTOs & Mappers]
        APP[Application Services]
    end
    
    subgraph "Domain Layer"
        ENT[Entities]
        VO[Value Objects]
        SPEC[Specifications]
        DOM[Domain Events]
    end
    
    subgraph "Infrastructure Layer"
        DB[(PostgreSQL/Neon)]
        CACHE[(Redis/Upstash)]
        EXT[External APIs]
        MSG[Message Queue]
    end
    
    subgraph "Core Services"
        TS[Trading Service]
        MDS[Market Data Service] 
        RMS[Risk Management Service]
        UMS[User Management Service]
        NS[Notification Service]
    end
    
    subgraph "AI Agent System"
        ORCH[Agent Orchestrator]
        PA[Pattern Analysis Agent]
        TA[Trading Agent]
        RA[Risk Agent]
        MA[Market Agent]
    end
    
    subgraph "External Integrations"
        MEXC[MEXC Exchange API]
        AI_APIS[AI APIs - OpenAI/Anthropic/Perplexity]
        MON[Monitoring - Inngest/OpenTelemetry]
    end
    
    UI --> API
    API --> APP
    APP --> UC
    UC --> DOM
    DOM --> ENT
    
    API --> Core Services
    Core Services --> AI Agent System
    Core Services --> Infrastructure Layer
    
    AI Agent System --> External Integrations
    Infrastructure Layer --> External Integrations
    
    ORCH --> PA
    ORCH --> TA
    ORCH --> RA
    ORCH --> MA
```

## 2. Component Relationships

```mermaid
graph LR
    subgraph "Presentation Layer"
        COMP[React Components]
        HOOKS[Custom Hooks]
        CONTEXT[React Context]
        PAGES[Next.js Pages]
    end
    
    subgraph "Application Services"
        TRADING[Trading Service]
        PATTERN[Pattern Detection]
        RISK[Risk Management]
        USER[User Management]
        NOTIFICATION[Notifications]
    end
    
    subgraph "Domain Core"
        TRADE_ENT[Trade Entity]
        PATTERN_ENT[Pattern Entity]
        USER_ENT[User Entity]
        RISK_ENT[Risk Entity]
        EVENTS[Domain Events]
    end
    
    subgraph "Infrastructure"
        MEXC_CLIENT[MEXC Client]
        DB_REPOS[Database Repositories]
        CACHE_LAYER[Cache Layer]
        AI_CLIENTS[AI Service Clients]
        WS_MANAGER[WebSocket Manager]
    end
    
    subgraph "External Systems"
        MEXC_API[MEXC Exchange]
        OPENAI[OpenAI API]
        ANTHROPIC[Anthropic Claude]
        PERPLEXITY[Perplexity API]
        POSTGRES[PostgreSQL]
        REDIS[Redis Cache]
    end
    
    COMP --> HOOKS
    HOOKS --> CONTEXT
    PAGES --> COMP
    
    HOOKS --> TRADING
    HOOKS --> PATTERN
    HOOKS --> RISK
    HOOKS --> USER
    
    TRADING --> TRADE_ENT
    PATTERN --> PATTERN_ENT
    RISK --> RISK_ENT
    USER --> USER_ENT
    
    TRADING --> MEXC_CLIENT
    PATTERN --> AI_CLIENTS
    RISK --> DB_REPOS
    USER --> CACHE_LAYER
    
    MEXC_CLIENT --> MEXC_API
    AI_CLIENTS --> OPENAI
    AI_CLIENTS --> ANTHROPIC
    AI_CLIENTS --> PERPLEXITY
    DB_REPOS --> POSTGRES
    CACHE_LAYER --> REDIS
    
    WS_MANAGER --> MEXC_API
    EVENTS --> NOTIFICATION
```

## 3. Data Flow Between Services

```mermaid
sequenceDiagram
    participant U as User Interface
    participant API as API Layer
    participant TS as Trading Service
    participant PD as Pattern Detection
    participant RM as Risk Management
    participant MEXC as MEXC Exchange
    participant DB as Database
    participant WS as WebSocket
    participant AI as AI Services
    
    Note over U,AI: Real-time Trading Flow
    
    U->>API: Auto-sniping request
    API->>TS: Initialize trading session
    TS->>DB: Store trading configuration
    TS->>RM: Validate risk parameters
    RM-->>TS: Risk assessment passed
    
    TS->>WS: Subscribe to market data
    WS->>MEXC: WebSocket connection
    MEXC-->>WS: Real-time price data
    WS-->>PD: Market data stream
    
    PD->>AI: Analyze patterns
    AI-->>PD: Pattern confidence scores
    PD->>TS: Trading opportunity detected
    
    TS->>RM: Pre-trade risk check
    RM-->>TS: Risk approved
    TS->>MEXC: Execute trade order
    MEXC-->>TS: Order confirmation
    
    TS->>DB: Record execution
    TS-->>API: Trading result
    API-->>U: Real-time updates
    
    Note over U,AI: Continuous Monitoring
    
    loop Every 1 second
        WS->>PD: Price updates
        PD->>RM: Risk monitoring
        RM->>TS: Safety checks
    end
    
    alt Risk threshold exceeded
        RM->>TS: Emergency stop
        TS->>MEXC: Cancel orders
        TS->>U: Alert notification
    end
```

## 4. Integration Points with External APIs

```mermaid
graph TB
    subgraph "MEXC Exchange Integration"
        MEXC_REST[REST API Client]
        MEXC_WS[WebSocket Client]
        MEXC_AUTH[Authentication Layer]
        MEXC_RATE[Rate Limiter]
    end
    
    subgraph "AI Services Integration"
        OPENAI_CLIENT[OpenAI Client]
        ANTHROPIC_CLIENT[Anthropic Client]
        PERPLEXITY_CLIENT[Perplexity Client]
        COHERE_CLIENT[Cohere Client]
        AI_ROUTER[AI Service Router]
    end
    
    subgraph "Authentication & Security"
        KINDE[Kinde Auth Provider]
        ENCRYPTION[Encryption Service]
        SESSION[Session Management]
        API_KEYS[API Key Management]
    end
    
    subgraph "Data & Caching"
        NEON_DB[Neon PostgreSQL]
        UPSTASH[Upstash Redis]
        DRIZZLE[Drizzle ORM]
        QUERY_CACHE[Query Cache]
    end
    
    subgraph "Monitoring & Observability"
        INNGEST[Inngest Workflows]
        OTEL[OpenTelemetry]
        HONEYCOMB[Honeycomb.io]
        PROMETHEUS[Prometheus Metrics]
    end
    
    subgraph "Application Core"
        TRADING_SERVICE[Trading Service]
        PATTERN_SERVICE[Pattern Detection]
        RISK_SERVICE[Risk Management]
        USER_SERVICE[User Management]
        NOTIFICATION_SERVICE[Notification Service]
    end
    
    TRADING_SERVICE --> MEXC_REST
    TRADING_SERVICE --> MEXC_WS
    MEXC_REST --> MEXC_AUTH
    MEXC_WS --> MEXC_RATE
    
    PATTERN_SERVICE --> AI_ROUTER
    AI_ROUTER --> OPENAI_CLIENT
    AI_ROUTER --> ANTHROPIC_CLIENT
    AI_ROUTER --> PERPLEXITY_CLIENT
    AI_ROUTER --> COHERE_CLIENT
    
    USER_SERVICE --> KINDE
    USER_SERVICE --> SESSION
    TRADING_SERVICE --> API_KEYS
    RISK_SERVICE --> ENCRYPTION
    
    TRADING_SERVICE --> DRIZZLE
    PATTERN_SERVICE --> QUERY_CACHE
    DRIZZLE --> NEON_DB
    QUERY_CACHE --> UPSTASH
    
    TRADING_SERVICE --> INNGEST
    PATTERN_SERVICE --> OTEL
    RISK_SERVICE --> HONEYCOMB
    NOTIFICATION_SERVICE --> PROMETHEUS
    
    style MEXC_REST fill:#ff9999
    style AI_ROUTER fill:#99ff99
    style KINDE fill:#9999ff
    style NEON_DB fill:#ffff99
    style INNGEST fill:#ff99ff
```

## 5. Detailed Service Architecture Map

```mermaid
graph TD
    subgraph "Core Trading Service (25+ files consolidated)"
        AUTO_SNIPE[Auto-Sniping Engine]
        MULTI_PHASE[Multi-Phase Trading]
        ORDER_EXEC[Order Execution]
        STRATEGY_MGR[Strategy Manager]
        PERF_OPT[Performance Optimizer]
    end
    
    subgraph "Market Data Service (12+ files consolidated)"
        PATTERN_DET[Pattern Detection Engine]
        WS_CONN[WebSocket Connections]
        MARKET_DATA[Market Data Processing]
        PRICE_MON[Price Monitoring]
        TECH_ANALYSIS[Technical Analysis]
    end
    
    subgraph "Risk Management Service (10+ files consolidated)"
        SAFETY_COORD[Safety Coordinator]
        CIRCUIT_BREAK[Circuit Breakers]
        RISK_ASSESS[Risk Assessment]
        EMERGENCY_SYS[Emergency Systems]
        REAL_TIME_MON[Real-time Monitoring]
    end
    
    subgraph "User Management Service (8+ files consolidated)"
        CONFIG_MGR[Configuration Manager]
        VALIDATION[Validation Services]
        AUTH_SVC[Authentication Service]
        CRED_MGR[Credential Manager]
        ENV_SETUP[Environment Setup]
    end
    
    subgraph "Notification Service (6+ files consolidated)"
        ALERT_SYS[Alerting System]
        NOTIF_PROVIDERS[Notification Providers]
        ALERT_CORR[Alert Correlation]
        MON_SVC[Monitoring Service]
        EVENT_BROAD[Event Broadcasting]
    end
    
    AUTO_SNIPE --> PATTERN_DET
    MULTI_PHASE --> RISK_ASSESS
    ORDER_EXEC --> SAFETY_COORD
    STRATEGY_MGR --> CONFIG_MGR
    
    PATTERN_DET --> CIRCUIT_BREAK
    WS_CONN --> REAL_TIME_MON
    MARKET_DATA --> ALERT_SYS
    
    SAFETY_COORD --> NOTIF_PROVIDERS
    EMERGENCY_SYS --> ALERT_CORR
    
    CONFIG_MGR --> VALIDATION
    AUTH_SVC --> CRED_MGR
```

## Architecture Summary

The MEXC Sniper Bot represents a sophisticated, enterprise-grade cryptocurrency trading system with:

- **Clean Architecture** with clear domain boundaries and modular design
- **AI-Enhanced Trading** with multi-provider AI services for pattern detection
- **Real-time Capabilities** through WebSocket connections and event-driven architecture
- **Comprehensive Risk Management** with circuit breakers and emergency stop mechanisms
- **Production-Ready Monitoring** with OpenTelemetry and multiple observability providers
- **Secure Configuration Management** with no hardcoded secrets and encrypted storage
- **Scalable Service Architecture** with 50+ microservices consolidated into 5 main domains

This architecture ensures high performance, reliability, and maintainability while providing advanced trading capabilities for cryptocurrency markets.