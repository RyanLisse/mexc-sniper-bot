# MEXC Sniper Bot - Enhanced Pattern Discovery System

A sophisticated cryptocurrency sniper bot for MEXC exchange that implements proactive pattern discovery to detect trading opportunities 3.5+ hours before token launches.

## 🚀 Key Features

### Proactive Pattern Discovery
- **Early Detection**: Identifies ready state patterns (sts:2, st:2, tt:4) up to 3.5+ hours before trading begins
- **Continuous Monitoring**: Background monitoring of MEXC calendar and symbol states
- **Database Persistence**: All discoveries and executions stored in database for analysis
- **Real-time Updates**: Live status monitoring and execution tracking

### Enhanced Architecture
- **FastAPI Agents**: Maintains existing AI agent-based architecture with database integration
- **SQLModel Database**: Robust data persistence with PostgreSQL/SQLite support
- **Redis/Valkey Caching**: High-performance caching layer with graceful degradation
- **Async Operations**: High-performance async/await throughout
- **Comprehensive Testing**: Full test suite for reliability

### Trading Capabilities
- **Automated Execution**: Pre-computed orders executed at precise timing
- **Risk Management**: Configurable buy amounts and concurrent snipe limits
- **Performance Tracking**: Detailed execution history and success metrics
- **Error Handling**: Robust error handling with retry logic

## 📋 System Requirements

- Python 3.8+
- PostgreSQL (recommended) or SQLite (development)
- MEXC API credentials
- OpenAI API key

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mexc-sniper-bot
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API credentials
   ```

4. **Initialize database**
   ```bash
   # Database tables are created automatically on first run
   ```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file with the following configuration:

```env
# Required: OpenAI API Key for AI agents
OPENAI_API_KEY=your-openai-api-key-here

# MEXC API Credentials (required for trading)
MEXC_API_KEY=your-mexc-api-key-here
MEXC_SECRET_KEY=your-mexc-secret-key-here

# Database Configuration
DATABASE_URL=postgresql+asyncpg://username:password@host:port/database

# Cache Configuration (Redis/Valkey - optional but recommended)
REDIS_URL=redis://localhost:6379/0
# Alternative: VALKEY_URL=redis://localhost:6379/0

# Cache TTL Settings (seconds)
CACHE_TTL_SYMBOLS=5
CACHE_TTL_CALENDAR=30
CACHE_TTL_ACCOUNT=60

# Application Settings
LOG_LEVEL=INFO
ENVIRONMENT=production
DEBUG=false

# Pattern Discovery Settings
TARGET_ADVANCE_HOURS=3.5
DEFAULT_BUY_AMOUNT_USDT=100.0
MAX_CONCURRENT_SNIPES=3
```

### Key Configuration Options

- **TARGET_ADVANCE_HOURS**: Minimum advance notice required (default: 3.5 hours)
- **DEFAULT_BUY_AMOUNT_USDT**: Default purchase amount per snipe
- **CALENDAR_POLL_INTERVAL_SECONDS**: How often to check for new listings (default: 300s)
- **SYMBOLS_POLL_INTERVAL_SECONDS_DEFAULT**: Symbol monitoring frequency (default: 30s)

## 🚀 Usage

### Starting the Application

```bash
# Development
uvicorn api.agents:app --reload --host 0.0.0.0 --port 8000

# Production
uvicorn api.agents:app --host 0.0.0.0 --port 8000
```

### API Endpoints

#### Pattern Discovery Control
```bash
# Start pattern discovery
curl -X POST "http://localhost:8000/mexc/pattern-discovery" \
  -H "Content-Type: application/json" \
  -d '{"action": "start"}'

# Get status
curl -X POST "http://localhost:8000/mexc/pattern-discovery" \
  -H "Content-Type: application/json" \
  -d '{"action": "status"}'

# Stop monitoring
curl -X POST "http://localhost:8000/mexc/pattern-discovery" \
  -H "Content-Type: application/json" \
  -d '{"action": "stop"}'
```

#### Monitoring Endpoints
```bash
# Get comprehensive status
curl "http://localhost:8000/mexc/status"

# Get monitored listings
curl "http://localhost:8000/mexc/monitored-listings"

# Get snipe targets
curl "http://localhost:8000/mexc/snipe-targets"

# Manually trigger discovery cycle
curl -X POST "http://localhost:8000/mexc/run-discovery"

# Get cache statistics
curl "http://localhost:8000/mexc/cache-stats"

# Clear cache entries
curl -X POST "http://localhost:8000/mexc/cache-clear?pattern=*"
```

## 🏗️ Architecture

### Core Components

1. **Pattern Discovery Engine** (`src/services/pattern_discovery.py`)
   - Continuous monitoring of MEXC calendar and symbols
   - Ready state detection and correlation
   - Proactive target creation and scheduling

2. **MEXC API Client** (`src/services/mexc_api.py`)
   - Authenticated API client with proper signature generation
   - Integrated Redis/Valkey caching for improved performance
   - Rate limiting and error handling
   - Comprehensive retry logic

3. **Database Layer** (`src/database.py`, `src/models.py`)
   - SQLModel-based data persistence
   - Async database operations
   - Comprehensive data models

4. **FastAPI Application** (`api/agents.py`)
   - Enhanced with database integration
   - Maintains existing AI agent architecture
   - New monitoring and status endpoints
   - Cache statistics and management endpoints

5. **Cache Service** (`src/services/cache_service.py`)
   - Redis/Valkey integration with graceful degradation
   - JSON serialization with TTL-based expiration
   - Namespace isolation and error handling
   - Performance monitoring and statistics

6. **Inngest Functions** (`src/inngest_functions.py`)
   - Scheduled calendar polling with cron triggers
   - Manual event triggers for admin control
   - Symbol watching and target creation workflows
   - Error handling and retry logic

7. **Vercel Integration** (`api/vercel_agents.py`, `api/inngest.py`)
   - Serverless deployment configuration
   - FastAPI and Inngest function routing
   - Production-ready ASGI handlers

8. **Next.js Dashboard** (`app/dashboard/page.tsx`)
   - Real-time target monitoring with SWR
   - Manual calendar poll triggers
   - Responsive UI with Tailwind CSS
   - Live status updates and statistics

### Data Flow

1. **Calendar Monitoring**: Polls MEXC calendar every 5 minutes for new listings
2. **Symbol Tracking**: Monitors discovered tokens for ready state pattern
3. **Target Creation**: Creates snipe targets when ready state detected with sufficient advance notice
4. **Execution Scheduling**: Schedules precise execution at launch time
5. **Performance Tracking**: Records execution results and performance metrics

## 🧪 Testing

### Running Tests

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_pattern_discovery.py

# Run with coverage
pytest --cov=src tests/

# Run async tests
pytest -v tests/test_pattern_discovery.py::TestPatternDiscoveryEngine::test_discovery_cycle_structure
```

### Test Coverage

- **Pattern Discovery Engine**: Core logic and monitoring functionality
- **MEXC API Client**: Authentication, error handling, and data parsing with respx HTTP mocking
- **Cache Service**: Redis integration and graceful degradation
- **Inngest Functions**: Workflow orchestration and event handling
- **Database Operations**: CRUD operations and data integrity
- **Integration Tests**: End-to-end discovery flow

## 📊 Monitoring & Analytics

### Discovery Statistics

The system tracks comprehensive metrics:
- Total discoveries made
- Success rate of executions
- Average advance notice achieved
- Performance over time

### Database Schema

- **monitored_listings**: Tracks tokens from calendar discovery
- **snipe_targets**: Stores ready tokens with execution parameters
- **execution_history**: Detailed execution results and performance

## 🔧 Development

### Project Structure

```
mexc-sniper-bot/
├── api/
│   ├── agents.py              # Original FastAPI application
│   ├── vercel_agents.py       # Vercel ASGI entry point
│   └── inngest.py             # Inngest function gateway
├── app/
│   └── dashboard/
│       └── page.tsx           # Next.js dashboard
├── components/
│   └── ui/                    # Reusable UI components
├── src/
│   ├── config.py              # Configuration management
│   ├── models.py              # Database models
│   ├── database.py            # Database operations
│   ├── main.py                # Main FastAPI app
│   ├── inngest_client.py      # Inngest client configuration
│   ├── inngest_functions.py   # Inngest workflow functions
│   ├── inngest_app.py         # Inngest app organization
│   ├── services/
│   │   ├── mexc_api.py        # Enhanced MEXC API client with caching
│   │   ├── cache_service.py   # Redis/Valkey caching service
│   │   └── pattern_discovery.py  # Core discovery engine
│   └── utils/
│       └── helpers.py         # Utility functions
├── tests/                     # Comprehensive test suite with respx
├── requirements.txt           # Python dependencies
├── package.json               # Node.js dependencies
├── vercel.json                # Vercel deployment configuration
└── .env.example              # Configuration template
```

## 🚨 Important Notes

### Real Data Only
- System uses only real MEXC API data
- No mock data in production dashboards
- All monitoring based on live market conditions

### API Credentials
- Ensure MEXC API credentials are correctly configured
- Test connectivity before starting pattern discovery
- Monitor API rate limits and usage

### Database Persistence
- All discoveries and executions are persisted
- Database backup recommended for production
- Monitor database performance under load

## ⚠️ Disclaimer

This software is for educational and research purposes. Cryptocurrency trading involves significant risk. Use at your own discretion and never invest more than you can afford to lose.
