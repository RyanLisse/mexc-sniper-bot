# Integration Architecture Diagrams - MEXC Sniper Bot

## Overview
This document provides detailed visual representations of the integration architecture for the MEXC Sniper Bot platform, including all external API integrations, service communication patterns, and data flow diagrams.

## 1. Complete System Integration Overview

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Browser]
        MOBILE[Mobile App]
    end
    
    subgraph "MEXC Sniper Bot Platform"
        subgraph "API Gateway"
            NEXTJS[Next.js API Routes]
            AUTH_MW[Auth Middleware]
            RATE_LMT[Rate Limiter]
        end
        
        subgraph "Service Layer"
            MEXC_SVC[MEXC Service Layer]
            AGENT_ORCH[Agent Orchestrator]
            PATTERN_SVC[Pattern Detection]
            RISK_SVC[Risk Management]
            TRADE_SVC[Trading Service]
        end
        
        subgraph "Data Layer"
            CACHE[Redis Cache]
            DB[PostgreSQL DB]
            WS_MGR[WebSocket Manager]
        end
        
        subgraph "Multi-Agent System"
            CAL_AGENT[Calendar Agent]
            PAT_AGENT[Pattern Agent]
            RISK_AGENT[Risk Agent]
            STRAT_AGENT[Strategy Agent]
            SIM_AGENT[Simulation Agent]
        end
    end
    
    subgraph "External Services"
        subgraph "Trading Exchange"
            MEXC_API[MEXC REST API]
            MEXC_WS[MEXC WebSocket]
        end
        
        subgraph "Authentication"
            KINDE[Kinde Auth Service]
        end
        
        subgraph "Database Services"
            NEON[Neon PostgreSQL]
            UPSTASH[Upstash Redis]
        end
        
        subgraph "AI Services"
            OPENAI[OpenAI API]
            ANTHROPIC[Anthropic Claude]
            PERPLEXITY[Perplexity API]
            COHERE[Cohere API]
        end
        
        subgraph "Workflow & Monitoring"
            INNGEST[Inngest Workflows]
            HONEYCOMB[Honeycomb Observability]
        end
    end
    
    %% Client Connections
    WEB --> NEXTJS
    MOBILE --> NEXTJS
    
    %% API Gateway Flow
    NEXTJS --> AUTH_MW
    AUTH_MW --> RATE_LMT
    RATE_LMT --> MEXC_SVC
    RATE_LMT --> AGENT_ORCH
    
    %% Service Layer Connections
    MEXC_SVC --> PATTERN_SVC
    MEXC_SVC --> RISK_SVC
    MEXC_SVC --> TRADE_SVC
    AGENT_ORCH --> CAL_AGENT
    AGENT_ORCH --> PAT_AGENT
    AGENT_ORCH --> RISK_AGENT
    AGENT_ORCH --> STRAT_AGENT
    AGENT_ORCH --> SIM_AGENT
    
    %% Data Layer Connections
    MEXC_SVC --> CACHE
    MEXC_SVC --> DB
    MEXC_SVC --> WS_MGR
    AGENT_ORCH --> CACHE
    AGENT_ORCH --> DB
    
    %% External Service Connections
    MEXC_SVC --> MEXC_API
    WS_MGR --> MEXC_WS
    AUTH_MW --> KINDE
    DB --> NEON
    CACHE --> UPSTASH
    PAT_AGENT --> OPENAI
    PAT_AGENT --> ANTHROPIC
    CAL_AGENT --> PERPLEXITY
    PATTERN_SVC --> COHERE
    AGENT_ORCH --> INNGEST
    MEXC_SVC --> HONEYCOMB
    
    %% Styling
    classDef external fill:#e1f5fe
    classDef internal fill:#f3e5f5
    classDef agent fill:#e8f5e8
    
    class MEXC_API,MEXC_WS,KINDE,NEON,UPSTASH,OPENAI,ANTHROPIC,PERPLEXITY,COHERE,INNGEST,HONEYCOMB external
    class NEXTJS,AUTH_MW,RATE_LMT,MEXC_SVC,PATTERN_SVC,RISK_SVC,TRADE_SVC,CACHE,DB,WS_MGR internal
    class CAL_AGENT,PAT_AGENT,RISK_AGENT,STRAT_AGENT,SIM_AGENT,AGENT_ORCH agent
```

## 2. API Integration Flow Diagram

```mermaid
sequenceDiagram
    participant Client as Web Client
    participant API as Next.js API
    participant Auth as Kinde Auth
    participant Cache as Redis Cache
    participant DB as PostgreSQL
    participant MEXC as MEXC Exchange
    participant Agents as Multi-Agent System
    participant WS as WebSocket Manager
    
    Note over Client,WS: Trading Request Flow
    
    Client->>API: POST /api/mexc/trade
    API->>Auth: Validate session token
    Auth-->>API: Session valid + user info
    
    API->>Cache: Check rate limit
    Cache-->>API: Rate limit OK
    
    API->>Cache: Check cached market data
    alt Cache Hit
        Cache-->>API: Return cached data
    else Cache Miss
        API->>MEXC: GET /api/v3/ticker/24hr
        MEXC-->>API: Market data response
        API->>Cache: Store market data (TTL: 5s)
    end
    
    API->>DB: Validate user trading settings
    DB-->>API: Trading settings valid
    
    API->>MEXC: POST /api/v3/order (Execute trade)
    MEXC-->>API: Trade execution result
    
    API->>DB: Persist trade record
    API->>Agents: Notify agents of trade execution
    Agents->>DB: Update performance metrics
    
    API->>WS: Broadcast trade update
    WS-->>Client: Real-time trade notification
    
    API-->>Client: Trade confirmation response
```

## 3. WebSocket Real-Time Communication

```mermaid
graph LR
    subgraph "MEXC Exchange"
        MEXC_WS_STREAM[WebSocket Stream]
    end
    
    subgraph "Connection Management"
        CONN_MGR[Connection Manager]
        HEARTBEAT[Heartbeat Monitor]
        CIRCUIT_BREAKER[Circuit Breaker]
    end
    
    subgraph "Data Processing"
        STREAM_PROC[Stream Processor]
        MSG_ROUTER[Message Router]
        DATA_VALIDATOR[Data Validator]
    end
    
    subgraph "Distribution Layer"
        MARKET_MGR[Market Data Manager]
        PATTERN_ENGINE[Pattern Detection Engine]
        AGENT_COORD[Agent Coordinator]
        CLIENT_WS[Client WebSocket]
    end
    
    subgraph "Storage & Cache"
        REDIS_CACHE[(Redis Cache)]
        POSTGRES_DB[(PostgreSQL)]
    end
    
    %% Connection Flow
    MEXC_WS_STREAM -->|Raw Market Data| CONN_MGR
    CONN_MGR --> HEARTBEAT
    CONN_MGR --> CIRCUIT_BREAKER
    CONN_MGR -->|Validated Connection| STREAM_PROC
    
    %% Data Processing Flow
    STREAM_PROC --> MSG_ROUTER
    MSG_ROUTER --> DATA_VALIDATOR
    DATA_VALIDATOR -->|Clean Data| MARKET_MGR
    
    %% Distribution Flow
    MARKET_MGR --> PATTERN_ENGINE
    MARKET_MGR --> AGENT_COORD
    MARKET_MGR --> CLIENT_WS
    
    %% Storage Flow
    MARKET_MGR --> REDIS_CACHE
    PATTERN_ENGINE --> POSTGRES_DB
    AGENT_COORD --> POSTGRES_DB
    
    %% Error Handling
    CIRCUIT_BREAKER -.->|Connection Failed| CONN_MGR
    DATA_VALIDATOR -.->|Invalid Data| MSG_ROUTER
```

## 4. Multi-Agent Communication Architecture

```mermaid
graph TD
    subgraph "Agent Orchestration Layer"
        ORCHESTRATOR[Multi-Agent Orchestrator]
        WORKFLOW_ENGINE[Workflow Engine]
        COORDINATION_MGR[Coordination Manager]
    end
    
    subgraph "Core Trading Agents"
        CAL_AGENT[Calendar Agent<br/>• Coin listing monitoring<br/>• Market calendar events<br/>• Time-based triggers]
        
        PAT_AGENT[Pattern Discovery Agent<br/>• Technical analysis<br/>• Pattern recognition<br/>• Trend detection]
        
        RISK_AGENT[Risk Manager Agent<br/>• Portfolio monitoring<br/>• Risk assessment<br/>• Safety controls]
        
        STRAT_AGENT[Strategy Agent<br/>• Trading strategies<br/>• Entry/exit logic<br/>• Order management]
        
        SIM_AGENT[Simulation Agent<br/>• Backtesting<br/>• Strategy validation<br/>• Performance analysis]
    end
    
    subgraph "Specialized Agents"
        SAFETY_AGENT[Safety Monitor Agent<br/>• Emergency stops<br/>• System health<br/>• Anomaly detection]
        
        RECON_AGENT[Reconciliation Agent<br/>• Data verification<br/>• Trade validation<br/>• Error correction]
    end
    
    subgraph "Communication Infrastructure"
        REDIS_COORD[(Redis Coordination)]
        EVENT_BUS[Event Bus]
        SHARED_MEMORY[Shared Memory Store]
        AGENT_REGISTRY[Agent Registry]
    end
    
    subgraph "External Integrations"
        MEXC_INTEGRATION[MEXC Integration]
        AI_SERVICES[AI Services]
        DATABASE[PostgreSQL]
        INNGEST_WF[Inngest Workflows]
    end
    
    %% Orchestration Connections
    ORCHESTRATOR --> WORKFLOW_ENGINE
    ORCHESTRATOR --> COORDINATION_MGR
    ORCHESTRATOR --> AGENT_REGISTRY
    
    %% Agent Connections
    ORCHESTRATOR --> CAL_AGENT
    ORCHESTRATOR --> PAT_AGENT
    ORCHESTRATOR --> RISK_AGENT
    ORCHESTRATOR --> STRAT_AGENT
    ORCHESTRATOR --> SIM_AGENT
    ORCHESTRATOR --> SAFETY_AGENT
    ORCHESTRATOR --> RECON_AGENT
    
    %% Inter-Agent Communication
    CAL_AGENT -.-> PAT_AGENT
    PAT_AGENT -.-> STRAT_AGENT
    STRAT_AGENT -.-> RISK_AGENT
    RISK_AGENT -.-> SAFETY_AGENT
    SIM_AGENT -.-> STRAT_AGENT
    
    %% Communication Infrastructure
    CAL_AGENT --> REDIS_COORD
    PAT_AGENT --> REDIS_COORD
    RISK_AGENT --> EVENT_BUS
    STRAT_AGENT --> SHARED_MEMORY
    SIM_AGENT --> SHARED_MEMORY
    SAFETY_AGENT --> EVENT_BUS
    RECON_AGENT --> AGENT_REGISTRY
    
    %% External Connections
    CAL_AGENT --> MEXC_INTEGRATION
    PAT_AGENT --> AI_SERVICES
    RISK_AGENT --> DATABASE
    STRAT_AGENT --> MEXC_INTEGRATION
    SIM_AGENT --> DATABASE
    WORKFLOW_ENGINE --> INNGEST_WF
```

## 5. Data Flow and Pattern Detection Pipeline

```mermaid
flowchart TD
    subgraph "Data Ingestion"
        MEXC_WS[MEXC WebSocket Stream]
        REST_API[MEXC REST API]
        HISTORICAL[Historical Data]
    end
    
    subgraph "Stream Processing"
        VALIDATOR[Data Validator]
        NORMALIZER[Data Normalizer]
        ENRICHER[Data Enricher]
    end
    
    subgraph "Pattern Detection Engine"
        PATTERN_ANALYZER[Pattern Analyzer]
        CONFIDENCE_CALC[Confidence Calculator]
        SIMILARITY_ENGINE[Similarity Engine]
        EMBEDDING_SVC[Embedding Service]
    end
    
    subgraph "AI Enhancement"
        OPENAI_ANALYSIS[OpenAI Analysis]
        COHERE_EMBEDDINGS[Cohere Embeddings]
        PATTERN_CLASSIFIER[Pattern Classifier]
    end
    
    subgraph "Decision Engine"
        STRATEGY_MATCHER[Strategy Matcher]
        RISK_ASSESSOR[Risk Assessor]
        EXECUTION_PLANNER[Execution Planner]
    end
    
    subgraph "Storage & Caching"
        PATTERN_CACHE[(Pattern Cache)]
        EMBEDDING_CACHE[(Embedding Cache)]
        HISTORICAL_DB[(Historical Database)]
        SIMILARITY_CACHE[(Similarity Cache)]
    end
    
    subgraph "Output & Actions"
        TRADING_SIGNALS[Trading Signals]
        PATTERN_ALERTS[Pattern Alerts]
        STRATEGY_UPDATES[Strategy Updates]
    end
    
    %% Data Flow
    MEXC_WS --> VALIDATOR
    REST_API --> VALIDATOR
    HISTORICAL --> NORMALIZER
    
    VALIDATOR --> NORMALIZER
    NORMALIZER --> ENRICHER
    ENRICHER --> PATTERN_ANALYZER
    
    PATTERN_ANALYZER --> CONFIDENCE_CALC
    PATTERN_ANALYZER --> SIMILARITY_ENGINE
    SIMILARITY_ENGINE --> EMBEDDING_SVC
    
    %% AI Enhancement Flow
    PATTERN_ANALYZER --> OPENAI_ANALYSIS
    EMBEDDING_SVC --> COHERE_EMBEDDINGS
    CONFIDENCE_CALC --> PATTERN_CLASSIFIER
    
    %% Decision Flow
    PATTERN_CLASSIFIER --> STRATEGY_MATCHER
    STRATEGY_MATCHER --> RISK_ASSESSOR
    RISK_ASSESSOR --> EXECUTION_PLANNER
    
    %% Storage Flow
    PATTERN_ANALYZER --> PATTERN_CACHE
    EMBEDDING_SVC --> EMBEDDING_CACHE
    ENRICHER --> HISTORICAL_DB
    SIMILARITY_ENGINE --> SIMILARITY_CACHE
    
    %% Output Flow
    EXECUTION_PLANNER --> TRADING_SIGNALS
    PATTERN_CLASSIFIER --> PATTERN_ALERTS
    STRATEGY_MATCHER --> STRATEGY_UPDATES
    
    %% Cache Lookups
    PATTERN_CACHE -.-> PATTERN_ANALYZER
    EMBEDDING_CACHE -.-> SIMILARITY_ENGINE
    SIMILARITY_CACHE -.-> SIMILARITY_ENGINE
    HISTORICAL_DB -.-> PATTERN_ANALYZER
```

## 6. Security and Authentication Flow

```mermaid
sequenceDiagram
    participant User as User
    participant Browser as Browser
    participant NextJS as Next.js App
    participant Kinde as Kinde Auth
    participant API as API Layer
    participant Encrypt as Encryption Service
    participant DB as Database
    participant MEXC as MEXC API
    
    Note over User,MEXC: Authentication & API Key Management Flow
    
    User->>Browser: Access Application
    Browser->>NextJS: GET /dashboard
    NextJS->>Kinde: Check authentication
    
    alt Not Authenticated
        Kinde-->>NextJS: Redirect to login
        NextJS-->>Browser: Redirect to /auth
        Browser->>Kinde: OAuth login flow
        Kinde-->>Browser: Auth callback with token
        Browser->>NextJS: Return with session token
    end
    
    NextJS->>Kinde: Validate session token
    Kinde-->>NextJS: User profile + permissions
    NextJS-->>Browser: Render authenticated dashboard
    
    Note over User,MEXC: API Credentials Setup
    
    User->>Browser: Configure MEXC API keys
    Browser->>API: POST /api/api-credentials
    API->>Kinde: Validate user session
    Kinde-->>API: Session valid
    
    API->>Encrypt: Encrypt API credentials
    Encrypt-->>API: Encrypted credentials
    API->>DB: Store encrypted credentials
    DB-->>API: Credentials stored
    
    Note over User,MEXC: Trading Request with Secured Credentials
    
    User->>Browser: Execute trade
    Browser->>API: POST /api/mexc/trade
    API->>Kinde: Validate session
    Kinde-->>API: User validated
    
    API->>DB: Retrieve user credentials
    DB-->>API: Encrypted credentials
    API->>Encrypt: Decrypt credentials
    Encrypt-->>API: Decrypted API keys
    
    API->>MEXC: Execute trade with user credentials
    MEXC-->>API: Trade result
    API->>DB: Log trade (encrypted)
    API-->>Browser: Trade confirmation
```

## 7. Error Handling and Circuit Breaker Pattern

```mermaid
stateDiagram-v2
    [*] --> Closed: System Start
    
    state "Circuit Breaker States" as CB {
        Closed --> Open: Failure Threshold Reached
        Open --> HalfOpen: Timeout Elapsed
        HalfOpen --> Closed: Success
        HalfOpen --> Open: Failure
        
        state Closed {
            [*] --> MonitoringRequests
            MonitoringRequests --> CountingFailures: Request Failed
            CountingFailures --> MonitoringRequests: Request Success
            CountingFailures --> [*]: Threshold Reached
        }
        
        state Open {
            [*] --> RejectingRequests
            RejectingRequests --> WaitingForTimeout
            WaitingForTimeout --> [*]: Timeout Complete
        }
        
        state HalfOpen {
            [*] --> AllowLimitedRequests
            AllowLimitedRequests --> TestingRecovery
            TestingRecovery --> [*]: Test Complete
        }
    }
    
    CB --> [*]: System Shutdown
    
    note right of Closed
        Normal operation
        Requests flow through
        Failures are counted
    end note
    
    note right of Open
        Fast-fail mode
        Requests immediately rejected
        Prevents cascade failures
    end note
    
    note right of HalfOpen
        Recovery testing
        Limited requests allowed
        Determines if service recovered
    end note
```

## 8. Monitoring and Observability Architecture

```mermaid
graph TB
    subgraph "Application Layer"
        NEXTJS_APP[Next.js Application]
        API_ROUTES[API Routes]
        AGENTS[Multi-Agent System]
        WEBSOCKETS[WebSocket Services]
    end
    
    subgraph "Instrumentation Layer"
        OTEL_SDK[OpenTelemetry SDK]
        CUSTOM_METRICS[Custom Metrics]
        LOG_COLLECTOR[Log Collector]
        TRACE_EXPORTER[Trace Exporter]
    end
    
    subgraph "Local Monitoring"
        PERF_MONITOR[Performance Monitor]
        HEALTH_CHECKS[Health Checks]
        CIRCUIT_MONITORS[Circuit Breaker Monitors]
        CACHE_METRICS[Cache Metrics]
    end
    
    subgraph "External Observability"
        HONEYCOMB[Honeycomb Observability]
        JAEGER[Jaeger Tracing]
        PROMETHEUS[Prometheus Metrics]
        GRAFANA[Grafana Dashboards]
    end
    
    subgraph "Alerting & Notifications"
        ALERT_MANAGER[Alert Manager]
        SLACK_ALERTS[Slack Notifications]
        EMAIL_ALERTS[Email Alerts]
        WEBHOOK_ALERTS[Webhook Alerts]
    end
    
    %% Application to Instrumentation
    NEXTJS_APP --> OTEL_SDK
    API_ROUTES --> CUSTOM_METRICS
    AGENTS --> LOG_COLLECTOR
    WEBSOCKETS --> TRACE_EXPORTER
    
    %% Instrumentation to Local Monitoring
    OTEL_SDK --> PERF_MONITOR
    CUSTOM_METRICS --> HEALTH_CHECKS
    LOG_COLLECTOR --> CIRCUIT_MONITORS
    TRACE_EXPORTER --> CACHE_METRICS
    
    %% Local to External Observability
    PERF_MONITOR --> HONEYCOMB
    HEALTH_CHECKS --> JAEGER
    CIRCUIT_MONITORS --> PROMETHEUS
    CACHE_METRICS --> GRAFANA
    
    %% External to Alerting
    HONEYCOMB --> ALERT_MANAGER
    PROMETHEUS --> ALERT_MANAGER
    ALERT_MANAGER --> SLACK_ALERTS
    ALERT_MANAGER --> EMAIL_ALERTS
    ALERT_MANAGER --> WEBHOOK_ALERTS
    
    %% Feedback Loops
    ALERT_MANAGER -.-> CIRCUIT_MONITORS
    HEALTH_CHECKS -.-> AGENTS
    PERF_MONITOR -.-> API_ROUTES
```

## 9. Deployment and Infrastructure Integration

```mermaid
graph TB
    subgraph "Development Environment"
        DEV_LOCAL[Local Development]
        DEV_DB[(Local PostgreSQL)]
        DEV_REDIS[(Local Redis)]
        DEV_MOCK[Mock Services]
    end
    
    subgraph "CI/CD Pipeline"
        GITHUB[GitHub Repository]
        ACTIONS[GitHub Actions]
        TESTS[Automated Tests]
        BUILD[Build Process]
        DEPLOY[Deployment]
    end
    
    subgraph "Staging Environment"
        VERCEL_STAGING[Vercel Staging]
        NEON_STAGING[(Neon Staging DB)]
        UPSTASH_STAGING[(Upstash Staging)]
        MEXC_TESTNET[MEXC Testnet]
    end
    
    subgraph "Production Environment"
        VERCEL_PROD[Vercel Production]
        NEON_PROD[(Neon Production DB)]
        UPSTASH_PROD[(Upstash Production)]
        MEXC_MAINNET[MEXC Mainnet]
        CDN[Vercel Edge CDN]
    end
    
    subgraph "External Services"
        KINDE_AUTH[Kinde Authentication]
        INNGEST_PROD[Inngest Production]
        HONEYCOMB_PROD[Honeycomb Observability]
        AI_SERVICES_PROD[AI Services]
    end
    
    %% Development Flow
    DEV_LOCAL --> DEV_DB
    DEV_LOCAL --> DEV_REDIS
    DEV_LOCAL --> DEV_MOCK
    
    %% CI/CD Flow
    DEV_LOCAL --> GITHUB
    GITHUB --> ACTIONS
    ACTIONS --> TESTS
    TESTS --> BUILD
    BUILD --> DEPLOY
    
    %% Staging Deployment
    DEPLOY --> VERCEL_STAGING
    VERCEL_STAGING --> NEON_STAGING
    VERCEL_STAGING --> UPSTASH_STAGING
    VERCEL_STAGING --> MEXC_TESTNET
    
    %% Production Deployment
    DEPLOY --> VERCEL_PROD
    VERCEL_PROD --> NEON_PROD
    VERCEL_PROD --> UPSTASH_PROD
    VERCEL_PROD --> MEXC_MAINNET
    VERCEL_PROD --> CDN
    
    %% External Service Connections
    VERCEL_PROD --> KINDE_AUTH
    VERCEL_PROD --> INNGEST_PROD
    VERCEL_PROD --> HONEYCOMB_PROD
    VERCEL_PROD --> AI_SERVICES_PROD
    
    %% Environment Promotion
    VERCEL_STAGING -.-> VERCEL_PROD
    NEON_STAGING -.-> NEON_PROD
    
    %% Monitoring Connections
    VERCEL_STAGING -.-> HONEYCOMB_PROD
    NEON_STAGING -.-> HONEYCOMB_PROD
    UPSTASH_STAGING -.-> HONEYCOMB_PROD
```

## 10. Integration Test Strategy Visualization

```mermaid
graph TD
    subgraph "Test Pyramid"
        subgraph "E2E Tests"
            E2E_AUTH[Authentication Flow]
            E2E_TRADING[Trading Workflow]
            E2E_MONITORING[Monitoring Dashboard]
            E2E_STAGEHAND[AI-Powered E2E]
        end
        
        subgraph "Integration Tests"
            INT_API[API Integration]
            INT_DB[Database Integration]
            INT_CACHE[Cache Integration]
            INT_WS[WebSocket Integration]
            INT_AGENTS[Agent Coordination]
        end
        
        subgraph "Unit Tests"
            UNIT_SERVICES[Service Layer]
            UNIT_UTILS[Utilities]
            UNIT_COMPONENTS[Components]
            UNIT_HOOKS[Hooks]
        end
    end
    
    subgraph "Test Environments"
        TEST_LOCAL[Local Test Environment]
        TEST_NEON[Neon Test Branches]
        TEST_REDIS[Redis Test Instance]
        TEST_MOCK[Mock Services]
    end
    
    subgraph "Test Data Management"
        TEST_FIXTURES[Test Fixtures]
        TEST_SEEDS[Database Seeds]
        TEST_MOCKS[Service Mocks]
        TEST_FACTORIES[Data Factories]
    end
    
    subgraph "Continuous Testing"
        CI_UNIT[CI Unit Tests]
        CI_INTEGRATION[CI Integration Tests]
        CI_E2E[CI E2E Tests]
        CI_PERFORMANCE[Performance Tests]
    end
    
    %% Test Layer Connections
    E2E_AUTH --> INT_API
    E2E_TRADING --> INT_AGENTS
    E2E_MONITORING --> INT_WS
    E2E_STAGEHAND --> INT_DB
    
    INT_API --> UNIT_SERVICES
    INT_DB --> UNIT_UTILS
    INT_CACHE --> UNIT_COMPONENTS
    INT_WS --> UNIT_HOOKS
    INT_AGENTS --> UNIT_SERVICES
    
    %% Environment Connections
    E2E_AUTH --> TEST_NEON
    INT_DB --> TEST_NEON
    INT_CACHE --> TEST_REDIS
    UNIT_SERVICES --> TEST_LOCAL
    INT_API --> TEST_MOCK
    
    %% Test Data Connections
    E2E_TRADING --> TEST_FIXTURES
    INT_DB --> TEST_SEEDS
    INT_API --> TEST_MOCKS
    UNIT_SERVICES --> TEST_FACTORIES
    
    %% CI Connections
    UNIT_SERVICES --> CI_UNIT
    INT_API --> CI_INTEGRATION
    E2E_AUTH --> CI_E2E
    E2E_TRADING --> CI_PERFORMANCE
```

## Summary

These architecture diagrams provide a comprehensive visual representation of the MEXC Sniper Bot's integration architecture, covering:

1. **Complete System Overview** - High-level integration between all components
2. **API Integration Flow** - Detailed sequence of API interactions
3. **WebSocket Communication** - Real-time data flow architecture
4. **Multi-Agent Communication** - Agent coordination and communication patterns
5. **Data Flow Pipeline** - Pattern detection and processing workflow
6. **Security Architecture** - Authentication and credential management
7. **Error Handling** - Circuit breaker and resilience patterns
8. **Monitoring Strategy** - Observability and alerting architecture
9. **Deployment Pipeline** - Infrastructure and environment management
10. **Testing Strategy** - Comprehensive testing approach visualization

Each diagram illustrates the clean separation of concerns, proper abstraction of external services, and the robust architecture that supports the platform's trading capabilities while maintaining security and reliability standards.

---

*Document Generated: 2025-06-28*  
*Integration Architecture Diagrams: Complete*  
*All External Integrations Mapped and Visualized*