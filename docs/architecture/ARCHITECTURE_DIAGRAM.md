# MEXC Sniper Bot Architecture Diagram 🏗️

## System Overview

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[Next.js App<br/>React 19 + TypeScript]
        Auth[Kinde Auth<br/>Authentication]
        Query[TanStack Query<br/>Data Management]
    end

    subgraph "API Layer"
        API[Next.js API Routes]
        Inngest[Inngest Workflows<br/>Event-Driven Processing]
    end

    subgraph "Multi-Agent System"
        Orchestrator[MEXC Orchestrator<br/>Workflow Coordination]
        Calendar[Calendar Agent<br/>New Listing Discovery]
        Pattern[Pattern Discovery Agent<br/>Ready State Detection]
        Symbol[Symbol Analysis Agent<br/>Real-time Assessment]
        MexcAPI[MEXC API Agent<br/>Trading Integration]
    end

    subgraph "Data Layer"
        DB[(TursoDB<br/>Distributed SQLite)]
        Drizzle[Drizzle ORM<br/>Type-Safe Queries]
    end

    subgraph "External Services"
        MEXC[MEXC Exchange API]
        OpenAI[OpenAI GPT-4<br/>AI Intelligence]
    end

    UI --> Query
    Query --> API
    Auth --> API
    API --> Inngest
    API --> Drizzle

    Inngest --> Orchestrator
    Orchestrator --> Calendar
    Orchestrator --> Pattern
    Orchestrator --> Symbol
    Orchestrator --> MexcAPI

    Calendar --> OpenAI
    Pattern --> OpenAI
    Symbol --> OpenAI
    MexcAPI --> OpenAI

    MexcAPI --> MEXC
    Drizzle --> DB
```

## Component Architecture

```mermaid
flowchart LR
    subgraph "User Interface"
        Dashboard[Trading Dashboard]
        Config[User Configuration]
        Monitor[Safety Monitoring]
    end

    subgraph "State Management"
        TanStack[TanStack Query]
        Hooks[Custom React Hooks]
    end

    subgraph "API Routes"
        Auth[/api/auth/*]
        Triggers[/api/triggers/*]
        Schedule[/api/schedule/*]
        MEXC[/api/mexc/*]
    end

    Dashboard --> TanStack
    Config --> Hooks
    Monitor --> TanStack

    TanStack --> Auth
    TanStack --> Triggers
    Hooks --> Schedule
    Hooks --> MEXC
```

## Agent Communication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant Inngest
    participant Orchestrator
    participant Agents
    participant MEXC
    participant OpenAI

    User->>Frontend: Configure Trading
    Frontend->>API: Save Preferences
    API->>Inngest: Trigger Workflow
    Inngest->>Orchestrator: Start Multi-Agent Process
    Orchestrator->>Agents: Distribute Tasks
    Agents->>OpenAI: AI Analysis
    Agents->>MEXC: Fetch Market Data
    MEXC-->>Agents: Return Data
    OpenAI-->>Agents: Return Analysis
    Agents-->>Orchestrator: Aggregate Results
    Orchestrator-->>Inngest: Complete Workflow
    Inngest-->>API: Return Results
    API-->>Frontend: Update UI
    Frontend-->>User: Display Results
```

## Database Schema Overview

```mermaid
erDiagram
    users ||--o{ user_preferences : has
    users ||--o{ api_credentials : owns
    users ||--o{ monitored_listings : tracks
    users ||--o{ snipe_targets : creates
    users ||--o{ execution_history : generates

    user_preferences {
        string id PK
        string userId FK
        json takeProfitLevels
        int defaultBuyAmount
        int maxConcurrentSnipes
        string readyStatePattern
        float stopLossPercent
        string riskTolerance
    }

    api_credentials {
        string id PK
        string userId FK
        string encryptedKey
        string encryptedSecret
        string exchange
    }

    monitored_listings {
        string id PK
        string userId FK
        string vcoinId
        string symbolName
        timestamp launchDate
        string status
        json patternState
    }

    snipe_targets {
        string id PK
        string userId FK
        string monitoredListingId FK
        float entryPrice
        float positionSize
        json takeProfitLevels
        string status
    }

    execution_history {
        string id PK
        string userId FK
        string snipeTargetId FK
        string action
        float price
        float quantity
        timestamp executedAt
    }
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Development"
        Local[Local Development<br/>Node.js + Bun]
        SQLite[SQLite Database]
        InngestDev[Inngest Dev Server]
    end

    subgraph "Production - Vercel"
        Edge[Edge Functions]
        Serverless[Serverless Functions]
        Static[Static Assets CDN]
    end

    subgraph "Production - External"
        Turso[TursoDB<br/>Global Distributed DB]
        InngestCloud[Inngest Cloud<br/>Workflow Engine]
        Railway[Railway<br/>Alternative Deployment]
    end

    Local --> SQLite
    Local --> InngestDev

    Edge --> Turso
    Serverless --> Turso
    Serverless --> InngestCloud
    Static --> Edge

    Railway -.-> Turso
    Railway -.-> InngestCloud
```

## Security Architecture

```mermaid
flowchart TB
    subgraph "Security Layers"
        Auth[Authentication<br/>Kinde Auth]
        CSRF[CSRF Protection]
        RateLimit[Rate Limiting]
        Encryption[AES-256-GCM<br/>Encryption]
    end

    subgraph "Protected Resources"
        API[API Routes]
        DB[Database]
        Creds[API Credentials]
        Trading[Trading Operations]
    end

    Auth --> API
    CSRF --> API
    RateLimit --> API
    API --> Encryption
    Encryption --> DB
    Encryption --> Creds
    API --> Trading
```

## Data Flow Architecture

```mermaid
flowchart LR
    subgraph "Data Sources"
        MEXCData[MEXC Market Data]
        UserInput[User Configuration]
        AIAnalysis[AI Insights]
    end

    subgraph "Processing"
        Agents[Multi-Agent System]
        Workflows[Inngest Workflows]
        Cache[TanStack Cache]
    end

    subgraph "Storage"
        TursoDB[TursoDB]
        LocalState[Local State]
    end

    subgraph "Output"
        UI[User Interface]
        Trades[Trade Execution]
        Logs[Audit Logs]
    end

    MEXCData --> Agents
    UserInput --> Workflows
    AIAnalysis --> Agents

    Agents --> Cache
    Workflows --> TursoDB
    Cache --> LocalState

    LocalState --> UI
    TursoDB --> Trades
    TursoDB --> Logs
```

## Performance Architecture

```mermaid
graph TB
    subgraph "Optimization Layers"
        EdgeCache[Vercel Edge Cache]
        QueryCache[TanStack Query Cache]
        DBIndex[Database Indexes]
    end

    subgraph "Performance Features"
        LazyLoad[Lazy Loading]
        Prefetch[Data Prefetching]
        Debounce[Request Debouncing]
        Batch[Batch Operations]
    end

    EdgeCache --> LazyLoad
    QueryCache --> Prefetch
    DBIndex --> Batch
    QueryCache --> Debounce
```

## Error Handling Architecture

```mermaid
flowchart TD
    subgraph "Error Sources"
        Network[Network Errors]
        API[API Errors]
        Agent[Agent Failures]
        DB[Database Errors]
    end

    subgraph "Error Handling"
        Retry[Retry Logic]
        Fallback[Fallback Strategies]
        Recovery[Error Recovery]
        Logging[Error Logging]
    end

    subgraph "User Experience"
        Toast[Toast Notifications]
        ErrorBoundary[Error Boundaries]
        GracefulDegradation[Graceful Degradation]
    end

    Network --> Retry
    API --> Fallback
    Agent --> Recovery
    DB --> Logging

    Retry --> Toast
    Fallback --> ErrorBoundary
    Recovery --> GracefulDegradation
    Logging --> Toast
```

## Scalability Architecture

```mermaid
graph TB
    subgraph "Horizontal Scaling"
        Vercel[Vercel Auto-Scaling]
        Turso[TursoDB Replicas]
        Inngest[Inngest Workers]
    end

    subgraph "Vertical Scaling"
        EdgeOpt[Edge Optimization]
        QueryOpt[Query Optimization]
        CacheOpt[Cache Strategy]
    end

    subgraph "Load Distribution"
        CDN[Global CDN]
        EdgeFunc[Edge Functions]
        Regional[Regional Deployment]
    end

    Vercel --> EdgeFunc
    Turso --> Regional
    Inngest --> EdgeOpt

    EdgeOpt --> CDN
    QueryOpt --> CacheOpt
```