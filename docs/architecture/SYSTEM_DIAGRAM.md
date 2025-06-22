# MEXC Trading Bot - System Architecture Diagrams

## System Overview Diagram

```mermaid
graph TB
    %% External Systems
    subgraph "External Systems"
        MEXC[MEXC Exchange API]
        KINDE[Kinde Auth]
        AI[AI Services<br/>OpenAI/Perplexity]
        NEON[Neon PostgreSQL]
        VERCEL[Vercel Deployment]
    end

    %% Frontend Layer
    subgraph "Frontend Layer"
        UI[React Dashboard]
        WS[WebSocket Client]
        AUTH_UI[Auth Components]
        DASH[Trading Dashboard]
        CHARTS[Real-time Charts]
    end

    %% API Gateway Layer
    subgraph "API Gateway Layer"
        API_ROUTER[Next.js App Router]
        MIDDLEWARE[API Middleware]
        RATE_LIMIT[Rate Limiter]
        AUTH_MW[Auth Middleware]
    end

    %% Core Services Layer
    subgraph "Core Services Layer"
        %% Trading Services
        subgraph "Trading Services"
            UNIFIED_MEXC[Unified MEXC Service]
            AUTO_SNIPE[Auto-Sniping Execution]
            PATTERN_DET[Pattern Detection Engine]
            RISK_MGR[Risk Management]
            MULTI_PHASE[Multi-Phase Trading]
        end

        %% Monitoring Services  
        subgraph "Monitoring Services"
            SAFETY_MON[Safety Monitoring]
            PERF_MON[Performance Monitoring]
            ALERT_SYS[Alert System]
            HEALTH_CHECK[Health Checks]
        end

        %% Infrastructure Services
        subgraph "Infrastructure Services"
            CACHE_MGR[Cache Manager]
            WS_SERVER[WebSocket Server]
            ENCRYPTION[Encryption Service]
            CONFIG_MGR[Config Management]
        end
    end

    %% Data Layer
    subgraph "Data Layer"
        POSTGRES[(PostgreSQL<br/>Neon)]
        REDIS[(Redis Cache)]
        VECTOR_DB[(Vector Embeddings)]
        LOGS[Structured Logs]
    end

    %% Data Flow Connections
    UI --> API_ROUTER
    API_ROUTER --> MIDDLEWARE
    MIDDLEWARE --> RATE_LIMIT
    MIDDLEWARE --> AUTH_MW
    
    API_ROUTER --> UNIFIED_MEXC
    API_ROUTER --> AUTO_SNIPE
    API_ROUTER --> PATTERN_DET
    API_ROUTER --> SAFETY_MON
    
    UNIFIED_MEXC --> MEXC
    UNIFIED_MEXC --> CACHE_MGR
    AUTO_SNIPE --> RISK_MGR
    PATTERN_DET --> AI
    
    CACHE_MGR --> REDIS
    UNIFIED_MEXC --> POSTGRES
    PATTERN_DET --> VECTOR_DB
    
    AUTH_MW --> KINDE
    WS --> WS_SERVER
    HEALTH_CHECK --> VERCEL
    
    SAFETY_MON --> ALERT_SYS
    PERF_MON --> LOGS

    classDef external fill:#ff9999
    classDef frontend fill:#99ccff  
    classDef api fill:#99ff99
    classDef service fill:#ffcc99
    classDef data fill:#cc99ff

    class MEXC,KINDE,AI,NEON,VERCEL external
    class UI,WS,AUTH_UI,DASH,CHARTS frontend
    class API_ROUTER,MIDDLEWARE,RATE_LIMIT,AUTH_MW api
    class UNIFIED_MEXC,AUTO_SNIPE,PATTERN_DET,RISK_MGR,MULTI_PHASE,SAFETY_MON,PERF_MON,ALERT_SYS,HEALTH_CHECK,CACHE_MGR,WS_SERVER,ENCRYPTION,CONFIG_MGR service
    class POSTGRES,REDIS,VECTOR_DB,LOGS data
```

## Data Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant Dashboard
    participant API
    participant PatternEngine
    participant AutoSniper
    participant RiskMgr
    participant MEXC
    participant Database

    User->>Dashboard: Configure Trading Strategy
    Dashboard->>API: POST /auto-sniping/config
    API->>Database: Store Configuration
    
    Note over PatternEngine: Continuous Pattern Detection
    PatternEngine->>MEXC: Fetch Market Data
    MEXC-->>PatternEngine: Symbol Data
    PatternEngine->>Database: Store Pattern Analysis
    
    PatternEngine->>AutoSniper: Pattern Match Found
    AutoSniper->>RiskMgr: Validate Risk Parameters
    RiskMgr-->>AutoSniper: Risk Approved
    
    AutoSniper->>MEXC: Place Order
    MEXC-->>AutoSniper: Order Confirmation
    AutoSniper->>Database: Store Trade Record
    
    AutoSniper->>Dashboard: Real-time Update
    Dashboard->>User: Position Notification
```

## Service Dependencies Diagram

```mermaid
graph LR
    %% Core Dependencies
    AUTO_SNIPE[Auto-Sniping<br/>Execution Service] --> PATTERN_DET[Pattern Detection<br/>Engine]
    AUTO_SNIPE --> RISK_MGR[Risk Management<br/>Service]
    AUTO_SNIPE --> UNIFIED_MEXC[Unified MEXC<br/>Service]
    
    PATTERN_DET --> AI_INTEL[AI Intelligence<br/>Service]
    PATTERN_DET --> PATTERN_MON[Pattern Monitoring<br/>Service]
    
    UNIFIED_MEXC --> MEXC_API[MEXC API<br/>Client]
    UNIFIED_MEXC --> CACHE_MGR[Cache Manager]
    UNIFIED_MEXC --> CIRCUIT_BREAK[Circuit Breaker]
    
    RISK_MGR --> SAFETY_COORD[Safety Coordinator]
    RISK_MGR --> EMERGENCY_SYS[Emergency Safety<br/>System]
    
    %% Support Services
    CACHE_MGR --> REDIS_SVC[Redis Cache<br/>Service]
    CACHE_MGR --> ENHANCED_CACHE[Enhanced Unified<br/>Cache]
    
    SAFETY_COORD --> REAL_TIME_MON[Real-time Safety<br/>Monitoring]
    SAFETY_COORD --> ALERT_ENGINE[Alert Correlation<br/>Engine]
    
    %% Infrastructure
    MEXC_API --> RATE_LIMITER[Adaptive Rate<br/>Limiter]
    MEXC_API --> PERF_MON[Performance<br/>Monitoring]
    
    ALERT_ENGINE --> NOTIFICATION[Notification<br/>Providers]
    PERF_MON --> METRICS[System Performance<br/>Snapshots]

    classDef core fill:#ff9999
    classDef support fill:#99ccff
    classDef infra fill:#99ff99

    class AUTO_SNIPE,PATTERN_DET,UNIFIED_MEXC,RISK_MGR core
    class AI_INTEL,PATTERN_MON,CACHE_MGR,SAFETY_COORD,EMERGENCY_SYS support  
    class MEXC_API,CIRCUIT_BREAK,REDIS_SVC,ENHANCED_CACHE,REAL_TIME_MON,ALERT_ENGINE,RATE_LIMITER,PERF_MON,NOTIFICATION,METRICS infra
```

## Database Schema Relationships

```mermaid
erDiagram
    %% Auth Schema
    users ||--o{ sessions : has
    users ||--o{ accounts : has
    users ||--o{ user_preferences : has

    %% Trading Schema
    users ||--o{ api_credentials : owns
    users ||--o{ snipe_targets : creates
    snipe_targets ||--o{ execution_history : generates
    execution_history ||--o{ transactions : creates
    transactions ||--o{ transaction_locks : has

    %% Pattern Schema
    coin_activities ||--o{ pattern_embeddings : analyzed_by
    pattern_embeddings ||--o{ pattern_similarity_cache : cached_in
    monitored_listings ||--o{ coin_activities : tracks

    %% Safety Schema
    users ||--o{ simulation_sessions : runs
    simulation_sessions ||--o{ simulation_trades : contains
    risk_events ||--o{ position_snapshots : triggers
    system_health_metrics ||--o{ error_incidents : monitors

    %% Strategy Schema
    strategy_templates ||--o{ trading_strategies : instantiates
    trading_strategies ||--o{ strategy_phase_executions : executes
    strategy_phase_executions ||--o{ strategy_performance_metrics : measures

    %% Performance Schema
    agent_performance_metrics ||--o{ performance_alerts : triggers
    workflow_performance_metrics ||--o{ system_performance_snapshots : aggregates

    %% Alert Schema
    alert_rules ||--o{ alert_instances : creates
    notification_channels ||--o{ alert_notifications : sends
    escalation_policies ||--o{ alert_correlations : manages
```

## Component Architecture Diagram

```mermaid
graph TB
    %% UI Layer
    subgraph "UI Components"
        DASH_LAYOUT[Dashboard Layout]
        AUTO_SNIPE_UI[Auto-Sniping Dashboard]
        PATTERN_UI[Pattern Monitoring]
        SAFETY_UI[Safety Dashboard]
        SETTINGS_UI[Settings & Config]
    end

    %% Business Logic Layer
    subgraph "Custom Hooks"
        USE_AUTO_SNIPE[useAutoSnipingExecution]
        USE_PATTERNS[usePatternMonitoring]
        USE_SAFETY[useSafetyMonitoring]
        USE_MEXC[useMexcData]
        USE_PORTFOLIO[usePortfolio]
    end

    %% State Management
    subgraph "State Management"
        QUERY_CLIENT[TanStack Query]
        WS_CONTEXT[WebSocket Context]
        AUTH_CONTEXT[Auth Context]
        CONFIG_CONTEXT[Config Context]
    end

    %% API Integration
    subgraph "API Clients"
        API_CLIENT[API Client]
        WS_CLIENT[WebSocket Client]
        MEXC_CLIENT[MEXC Client]
    end

    %% Component Relationships
    DASH_LAYOUT --> AUTO_SNIPE_UI
    DASH_LAYOUT --> PATTERN_UI
    DASH_LAYOUT --> SAFETY_UI
    DASH_LAYOUT --> SETTINGS_UI

    AUTO_SNIPE_UI --> USE_AUTO_SNIPE
    PATTERN_UI --> USE_PATTERNS
    SAFETY_UI --> USE_SAFETY
    SETTINGS_UI --> USE_MEXC
    SETTINGS_UI --> USE_PORTFOLIO

    USE_AUTO_SNIPE --> QUERY_CLIENT
    USE_PATTERNS --> WS_CONTEXT
    USE_SAFETY --> WS_CONTEXT
    USE_MEXC --> AUTH_CONTEXT
    USE_PORTFOLIO --> CONFIG_CONTEXT

    QUERY_CLIENT --> API_CLIENT
    WS_CONTEXT --> WS_CLIENT
    AUTH_CONTEXT --> MEXC_CLIENT

    classDef ui fill:#99ccff
    classDef hooks fill:#ffcc99
    classDef state fill:#cc99ff
    classDef client fill:#99ff99

    class DASH_LAYOUT,AUTO_SNIPE_UI,PATTERN_UI,SAFETY_UI,SETTINGS_UI ui
    class USE_AUTO_SNIPE,USE_PATTERNS,USE_SAFETY,USE_MEXC,USE_PORTFOLIO hooks
    class QUERY_CLIENT,WS_CONTEXT,AUTH_CONTEXT,CONFIG_CONTEXT state
    class API_CLIENT,WS_CLIENT,MEXC_CLIENT client
```

## Deployment Architecture

```mermaid
graph TB
    %% External Infrastructure
    subgraph "External Services"
        VERCEL_EDGE[Vercel Edge Network]
        NEON_DB[Neon PostgreSQL]
        REDIS_CLOUD[Redis Cloud]
        KINDE_AUTH[Kinde Authentication]
    end

    %% Vercel Deployment
    subgraph "Vercel Platform"
        EDGE_FUNCTIONS[Edge Functions]
        API_ROUTES[API Routes]
        STATIC_ASSETS[Static Assets]
        WS_HANDLERS[WebSocket Handlers]
    end

    %% Application Runtime
    subgraph "Application Runtime"
        NEXT_APP[Next.js Application]
        SERVICE_LAYER[Service Layer]
        ORM_LAYER[Drizzle ORM]
        CACHE_LAYER[Cache Layer]
    end

    %% Monitoring & Observability
    subgraph "Monitoring"
        OTEL[OpenTelemetry]
        LOGS[Structured Logging]
        METRICS[Performance Metrics]
        ALERTS[Alert System]
    end

    %% Traffic Flow
    VERCEL_EDGE --> EDGE_FUNCTIONS
    EDGE_FUNCTIONS --> API_ROUTES
    API_ROUTES --> NEXT_APP
    NEXT_APP --> SERVICE_LAYER
    SERVICE_LAYER --> ORM_LAYER
    ORM_LAYER --> NEON_DB

    CACHE_LAYER --> REDIS_CLOUD
    SERVICE_LAYER --> CACHE_LAYER
    
    NEXT_APP --> KINDE_AUTH
    WS_HANDLERS --> SERVICE_LAYER

    SERVICE_LAYER --> OTEL
    OTEL --> LOGS
    OTEL --> METRICS
    METRICS --> ALERTS

    classDef external fill:#ff9999
    classDef vercel fill:#99ccff
    classDef runtime fill:#99ff99
    classDef monitoring fill:#ffcc99

    class VERCEL_EDGE,NEON_DB,REDIS_CLOUD,KINDE_AUTH external
    class EDGE_FUNCTIONS,API_ROUTES,STATIC_ASSETS,WS_HANDLERS vercel
    class NEXT_APP,SERVICE_LAYER,ORM_LAYER,CACHE_LAYER runtime
    class OTEL,LOGS,METRICS,ALERTS monitoring
```

These diagrams provide a comprehensive view of the MEXC Trading Bot architecture, showing the relationships between components, data flow, and deployment structure. The modular design ensures maintainability, scalability, and clear separation of concerns throughout the system.