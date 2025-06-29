# MEXC Sniper Bot - Comprehensive Data Flow Diagrams

This document contains detailed mermaid diagrams mapping all data flows in the MEXC Sniper Bot system.

## 1. System Overview Data Flow

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[React UI Components]
        Dashboard[Trading Dashboard]
        Config[Trading Configuration]
        Monitor[Real-time Monitoring]
    end

    subgraph "API Layer"
        REST[REST API Routes]
        WS_API[WebSocket API]
        Auth[Authentication]
        Validation[Request Validation]
    end

    subgraph "Business Logic Layer"
        PatternEngine[Pattern Detection Engine]
        TradingService[Trading Services]
        RiskManager[Risk Management]
        ConfigService[Configuration Service]
    end

    subgraph "Data Layer"
        DB[(Database)]
        Cache[Redis Cache]
        FileSystem[File Storage]
    end

    subgraph "External Services"
        MEXC[MEXC Exchange]
        WS_MEXC[MEXC WebSocket]
    end

    %% Frontend to API
    UI --> REST
    Dashboard --> WS_API
    Config --> REST
    Monitor --> WS_API

    %% API to Business Logic
    REST --> TradingService
    REST --> ConfigService
    WS_API --> PatternEngine
    Auth --> Validation

    %% Business Logic interactions
    TradingService --> RiskManager
    PatternEngine --> TradingService
    ConfigService --> RiskManager

    %% Data persistence
    TradingService --> DB
    ConfigService --> DB
    PatternEngine --> Cache
    RiskManager --> DB

    %% External integrations
    TradingService --> MEXC
    PatternEngine --> WS_MEXC
    WS_MEXC --> WS_API

    %% Real-time updates
    WS_MEXC -.->|Live Data| PatternEngine
    PatternEngine -.->|Signals| WS_API
    WS_API -.->|Updates| Dashboard
```

## 2. WebSocket Data Streams Flow

```mermaid
sequenceDiagram
    participant Client as Frontend Client
    participant WSServer as WebSocket Server
    participant StreamProcessor as Stream Processor
    participant ConnectionMgr as Connection Manager
    participant MarketDataMgr as Market Data Manager
    participant PatternEngine as Pattern Detection
    participant MEXC as MEXC WebSocket

    %% Connection establishment
    Client->>WSServer: Connect to /ws
    WSServer->>StreamProcessor: Initialize stream
    StreamProcessor->>ConnectionMgr: Create connection
    ConnectionMgr->>MEXC: Connect WebSocket
    MEXC-->>ConnectionMgr: Connection established

    %% Data subscription
    StreamProcessor->>MEXC: Subscribe to ticker, depth, status
    MEXC-->>StreamProcessor: Subscription confirmed

    %% Real-time data flow
    loop Live Market Data
        MEXC->>ConnectionMgr: Raw market data
        ConnectionMgr->>StreamProcessor: Parsed message
        StreamProcessor->>MarketDataMgr: Process ticker/depth/status
        
        alt Price Update
            MarketDataMgr->>MarketDataMgr: Cache price data
            MarketDataMgr->>PatternEngine: Check for patterns
            PatternEngine-->>MarketDataMgr: Pattern analysis result
            MarketDataMgr->>StreamProcessor: Price update event
            StreamProcessor->>WSServer: Broadcast price
            WSServer->>Client: Real-time price update
        end

        alt Pattern Detection
            MarketDataMgr->>PatternEngine: Symbol status change
            PatternEngine->>PatternEngine: Analyze ready state pattern
            PatternEngine-->>MarketDataMgr: Trading signal
            MarketDataMgr->>StreamProcessor: Trading signal event
            StreamProcessor->>WSServer: Broadcast signal
            WSServer->>Client: Trading opportunity notification
        end
    end

    %% Error handling
    MEXC->>ConnectionMgr: Connection error
    ConnectionMgr->>ConnectionMgr: Reconnection logic
    ConnectionMgr->>MEXC: Reconnect attempt
```

## 3. API Request/Response Flows

```mermaid
graph LR
    subgraph "Frontend Layer"
        Component[React Component]
        Hook[Custom Hook]
        Query[TanStack Query]
    end

    subgraph "API Routes"
        MarketAPI[/api/market-data/klines]
        TuningAPI[/api/tuning/optimization-history]
        AuthAPI[/api/auth/session]
        ConfigAPI[/api/trading-settings]
    end

    subgraph "Services Layer"
        MexcService[Unified MEXC Service]
        DBService[Database Service]
        CacheService[Cache Service]
        ValidationService[Validation Service]
    end

    subgraph "Data Sources"
        MexcExchange[MEXC Exchange API]
        Database[(PostgreSQL)]
        RedisCache[(Redis Cache)]
    end

    %% Frontend request flow
    Component --> Hook
    Hook --> Query
    Query -->|HTTP Request| MarketAPI
    Query -->|HTTP Request| TuningAPI
    Query -->|HTTP Request| AuthAPI
    Query -->|HTTP Request| ConfigAPI

    %% API processing flow
    MarketAPI --> ValidationService
    ValidationService --> MexcService
    MexcService --> MexcExchange
    MexcExchange -->|Market Data| MexcService
    MexcService --> CacheService
    CacheService --> RedisCache
    MexcService -->|Response| MarketAPI
    MarketAPI -->|JSON Response| Query

    %% Tuning API flow
    TuningAPI --> ValidationService
    ValidationService --> DBService
    DBService --> Database
    Database -->|Query Results| DBService
    DBService -->|Response| TuningAPI
    TuningAPI -->|JSON Response| Query

    %% Configuration flow
    ConfigAPI --> ValidationService
    ValidationService --> DBService
    DBService --> Database
    Database -->|Config Data| DBService
    DBService --> CacheService
    CacheService -->|Response| ConfigAPI
    ConfigAPI -->|JSON Response| Query

    %% Response handling
    Query -->|Data| Hook
    Hook -->|State Update| Component
    Component -->|Re-render| Component
```

## 4. Pattern Detection Data Flow

```mermaid
flowchart TD
    subgraph "Data Ingestion"
        WSData[WebSocket Market Data]
        APIData[API Market Data]
        StatusData[Symbol Status Data]
    end

    subgraph "Pattern Detection Core"
        DataProcessor[Data Processor]
        PatternAnalyzer[Pattern Analyzer]
        ConfidenceCalc[Confidence Calculator]
        PatternValidator[Pattern Validator]
    end

    subgraph "Pattern Storage"
        PatternCache[Pattern Cache]
        PatternDB[(Pattern Database)]
        PatternHistory[Pattern History]
    end

    subgraph "Signal Generation"
        SignalEngine[Signal Engine]
        RiskFilter[Risk Filter]
        NotificationMgr[Notification Manager]
    end

    subgraph "Output Channels"
        TradingSignals[Trading Signals]
        UINotifications[UI Notifications]
        AutoSniping[Auto-Sniping Engine]
    end

    %% Data flow
    WSData --> DataProcessor
    APIData --> DataProcessor
    StatusData --> DataProcessor

    DataProcessor --> PatternAnalyzer
    PatternAnalyzer --> ConfidenceCalc
    ConfidenceCalc --> PatternValidator

    PatternValidator --> PatternCache
    PatternValidator --> PatternDB
    PatternAnalyzer --> PatternHistory

    PatternValidator -->|Valid Patterns| SignalEngine
    SignalEngine --> RiskFilter
    RiskFilter --> NotificationMgr

    NotificationMgr --> TradingSignals
    NotificationMgr --> UINotifications
    TradingSignals --> AutoSniping

    %% Pattern types and conditions
    DataProcessor -.->|sts:2, st:2, tt:4| PatternAnalyzer
    PatternAnalyzer -.->|Ready State Pattern| ConfidenceCalc
    ConfidenceCalc -.->|Confidence: 85%| PatternValidator
    PatternValidator -.->|Validated Pattern| SignalEngine

    %% Feedback loops
    PatternHistory -.->|Historical Data| PatternAnalyzer
    PatternCache -.->|Cached Patterns| ConfidenceCalc
    RiskFilter -.->|Risk Assessment| SignalEngine
```

## 5. Frontend-Backend Data Mapping

```mermaid
graph TB
    subgraph "React Components"
        PDashboard[Parameter Optimization Dashboard]
        TradingConfig[Trading Configuration]
        Monitoring[Safety Monitoring]
        AccountBalance[Account Balance]
    end

    subgraph "Custom Hooks"
        useOptimization[useOptimization]
        usePatternMonitoring[usePatternMonitoring]
        useAccountBalance[useAccountBalance]
        useTradingSettings[useTradingSettings]
    end

    subgraph "API Endpoints"
        OptimizationAPI[/api/tuning/optimizations]
        PatternAPI[/api/pattern-detection]
        BalanceAPI[/api/account/balance]
        SettingsAPI[/api/trading-settings]
    end

    subgraph "Backend Services"
        OptimizationEngine[Parameter Optimization Engine]
        PatternDetectionService[Pattern Detection Service]
        MexcAccountService[MEXC Account Service]
        UserPreferencesService[User Preferences Service]
    end

    subgraph "Data Flow Types"
        OptimizationData[OptimizationRunData]
        PatternData[PatternAnalysisResult]
        BalanceData[AccountBalanceData]
        PreferencesData[UserTradingPreferences]
    end

    %% Component to hook connections
    PDashboard --> useOptimization
    TradingConfig --> useTradingSettings
    Monitoring --> usePatternMonitoring
    AccountBalance --> useAccountBalance

    %% Hook to API connections
    useOptimization --> OptimizationAPI
    usePatternMonitoring --> PatternAPI
    useAccountBalance --> BalanceAPI
    useTradingSettings --> SettingsAPI

    %% API to service connections
    OptimizationAPI --> OptimizationEngine
    PatternAPI --> PatternDetectionService
    BalanceAPI --> MexcAccountService
    SettingsAPI --> UserPreferencesService

    %% Data type flows
    OptimizationEngine --> OptimizationData
    PatternDetectionService --> PatternData
    MexcAccountService --> BalanceData
    UserPreferencesService --> PreferencesData

    %% Response flow back to frontend
    OptimizationData -.->|Real-time Updates| PDashboard
    PatternData -.->|Pattern Notifications| Monitoring
    BalanceData -.->|Balance Updates| AccountBalance
    PreferencesData -.->|Config Updates| TradingConfig
```

## 6. Auto-Sniping Execution Flow

```mermaid
sequenceDiagram
    participant UI as User Interface
    participant Config as Configuration Service
    participant PatternDetector as Pattern Detector
    participant AutoSniping as Auto-Sniping Engine
    participant RiskManager as Risk Manager
    participant OrderExecution as Order Execution
    participant MEXC as MEXC Exchange

    %% Configuration setup
    UI->>Config: Set auto-sniping parameters
    Config->>Config: Validate settings
    Config->>AutoSniping: Update configuration
    AutoSniping->>RiskManager: Configure risk limits

    %% Pattern detection and execution
    loop Pattern Monitoring
        PatternDetector->>PatternDetector: Analyze market data
        
        alt Ready State Pattern Detected
            PatternDetector->>AutoSniping: Ready state signal
            AutoSniping->>RiskManager: Check risk constraints
            
            alt Risk Check Passed
                RiskManager-->>AutoSniping: Risk approved
                AutoSniping->>OrderExecution: Execute buy order
                OrderExecution->>MEXC: Place market order
                MEXC-->>OrderExecution: Order confirmation
                OrderExecution-->>AutoSniping: Execution result
                AutoSniping->>UI: Notify execution
                
                %% Set up exit strategy
                AutoSniping->>OrderExecution: Configure take-profit/stop-loss
                OrderExecution->>MEXC: Place exit orders
                MEXC-->>OrderExecution: Exit orders placed
            else Risk Check Failed
                RiskManager-->>AutoSniping: Risk violation
                AutoSniping->>UI: Risk alert notification
            end
        end
    end

    %% Error handling
    MEXC->>OrderExecution: Order failed
    OrderExecution->>AutoSniping: Execution error
    AutoSniping->>RiskManager: Log error
    RiskManager->>UI: Error notification
```

## 7. Real-time Data Broadcasting Architecture

```mermaid
graph TB
    subgraph "Data Sources"
        MexcWS[MEXC WebSocket]
        InternalEvents[Internal Events]
        DBChanges[Database Changes]
    end

    subgraph "Message Processing"
        StreamProcessor[Stream Processor]
        EventAggregator[Event Aggregator]
        MessageRouter[Message Router]
    end

    subgraph "Broadcasting Layer"
        WSServer[WebSocket Server]
        ChannelManager[Channel Manager]
        ClientManager[Client Manager]
    end

    subgraph "Client Connections"
        Dashboard[Dashboard Client]
        Mobile[Mobile Client]
        Admin[Admin Client]
    end

    subgraph "Message Types"
        PriceUpdates[Price Updates]
        PatternSignals[Pattern Signals]
        TradingNotifications[Trading Notifications]
        SystemAlerts[System Alerts]
    end

    %% Data ingestion
    MexcWS --> StreamProcessor
    InternalEvents --> EventAggregator
    DBChanges --> EventAggregator

    %% Message processing
    StreamProcessor --> MessageRouter
    EventAggregator --> MessageRouter
    MessageRouter --> WSServer

    %% Broadcasting
    WSServer --> ChannelManager
    ChannelManager --> ClientManager
    ClientManager --> Dashboard
    ClientManager --> Mobile
    ClientManager --> Admin

    %% Message type routing
    MessageRouter --> PriceUpdates
    MessageRouter --> PatternSignals
    MessageRouter --> TradingNotifications
    MessageRouter --> SystemAlerts

    PriceUpdates --> ChannelManager
    PatternSignals --> ChannelManager
    TradingNotifications --> ChannelManager
    SystemAlerts --> ChannelManager

    %% Channel subscriptions
    Dashboard -.->|Subscribe: trading:prices| ChannelManager
    Dashboard -.->|Subscribe: trading:signals| ChannelManager
    Mobile -.->|Subscribe: notifications:global| ChannelManager
    Admin -.->|Subscribe: system:alerts| ChannelManager
```

## Data Flow Summary

### Key Data Paths:
1. **Market Data Ingestion**: MEXC WebSocket → Stream Processor → Market Data Manager → Pattern Detection
2. **Pattern Detection**: Symbol Status → Pattern Analyzer → Confidence Calculator → Trading Signals
3. **Auto-Sniping**: Trading Signals → Risk Manager → Order Execution → MEXC Exchange
4. **Real-time Updates**: WebSocket Server → Channel Manager → Frontend Clients
5. **Configuration**: Frontend → API Routes → Database → Cache → Services
6. **Monitoring**: Backend Services → Database → API Routes → Frontend Dashboard

### Critical Integration Points:
- **WebSocket Bridge**: Connects MEXC data streams to internal pattern detection
- **Risk Manager**: Validates all trading decisions before execution
- **Pattern Detection Core**: Central hub for market analysis and signal generation
- **Configuration Service**: Manages user preferences and system settings
- **Real-time Broadcasting**: Distributes live updates to all connected clients

### Performance Considerations:
- **Caching Strategy**: Redis cache for frequent data access
- **Connection Pooling**: Optimized database connections
- **Circuit Breakers**: Automatic fallback for external service failures
- **Rate Limiting**: Prevents API overload and ensures compliance
- **Data Compression**: Efficient WebSocket message serialization