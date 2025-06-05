# MEXC Pattern Discovery Agent 🤖

## Overview

The MEXC Pattern Discovery Agent is a FastAPI-based intelligent system that leverages AI agents with specialized tools to discover and analyze token launch patterns on the MEXC exchange. This system transforms traditional reactive token sniping into proactive pattern-based discovery.

## 🎯 Key Innovation

**Traditional Approach**: Wait for trading → Scramble for data → Execute orders
**Agent Approach**: AI discovers patterns → Analyzes opportunities → Provides strategies

## 🏗️ Architecture

### Core Components

1. **FastAPI Server** (`api/agents.py`) - Main application with REST endpoints
2. **MEXC Tools** - Specialized tools for MEXC API interaction
3. **AI Agents** - Intelligent agents for pattern discovery and strategy
4. **Pattern Discovery System** - Real-time monitoring and analysis

### AI Agents

#### 1. MEXC Pattern Discovery Agent
- **Model**: GPT-4o
- **Purpose**: Discover and analyze token launch patterns
- **Tools**: Calendar, SymbolsV2, Pattern Analysis
- **Capabilities**: 
  - Detects ready state patterns (sts:2, st:2, tt:4)
  - Correlates calendar data with symbol states
  - Calculates timing and advance notice
  - Assesses data completeness

#### 2. MEXC Trading Strategy Agent
- **Model**: GPT-4o  
- **Purpose**: Generate trading strategies for ready tokens
- **Capabilities**:
  - Entry timing recommendations
  - Risk management parameters
  - Position sizing strategies
  - Execution planning

### MEXC Tools

#### 1. MEXCCalendarTool
```python
# Fetches upcoming token listings
await calendar_tool.run()
```

#### 2. MEXCSymbolsV2Tool
```python
# Analyzes symbol states for ready patterns
await symbols_tool.run(vcoin_id="optional_filter")
```

#### 3. MEXCPatternAnalysisTool
```python
# Comprehensive pattern analysis and correlation
await analysis_tool.run()
```

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Set required environment variables
export OPENAI_API_KEY="your-openai-api-key"
export MEXC_API_KEY="your-mexc-api-key"      # Optional
export MEXC_SECRET_KEY="your-mexc-secret"    # Optional
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Start the Server

```bash
uvicorn api.agents:app --reload --host 0.0.0.0 --port 8000
```

### 4. Test the System

```bash
python test_mexc_agent.py
```

## 📡 API Endpoints

### Health Check
```http
GET /api/agents/ping
```

### Pattern Discovery Control
```http
POST /api/agents/mexc/pattern-discovery
Content-Type: application/json

{
  "action": "start"  // "start", "stop", or "status"
}
```

### Token Analysis
```http
POST /api/agents/mexc/analyze-token
Content-Type: application/json

{
  "symbol": "BTCUSDT"
}
```

### Trading Strategy
```http
POST /api/agents/mexc/trading-strategy
Content-Type: application/json

{
  "buy_amount_usdt": 100,
  "max_concurrent_snipes": 3,
  "pattern_sts": 2,
  "pattern_st": 2,
  "pattern_tt": 4
}
```

### System Status
```http
GET /api/agents/mexc/status
```

## 🔍 Pattern Discovery Process

### 1. Calendar Monitoring
- Fetches upcoming token listings from MEXC calendar API
- Extracts vcoinIds and launch times
- Filters for upcoming opportunities (next 7 days)

### 2. Symbol State Analysis
- Monitors symbolsV2 API for state changes
- Detects ready pattern: `sts:2, st:2, tt:4`
- Analyzes state distribution across all symbols

### 3. Data Correlation
- Correlates calendar vcoinIds with symbol data
- Identifies tokens with complete trading data
- Calculates precise timing and advance notice

### 4. Opportunity Assessment
- Evaluates data completeness (symbol, precision, launch time)
- Calculates hours until launch
- Prioritizes opportunities by timing and quality

## 📊 Example Responses

### Pattern Discovery Response
```json
{
  "status": "started",
  "message": "Pattern discovery system started",
  "analysis": "AI agent analysis of current opportunities...",
  "state": {
    "running": true,
    "ready_tokens": [
      {
        "vcoin_id": "example_123",
        "project_name": "Example Token",
        "symbol": "EXAMPLEUSDT",
        "launch_time": "2024-01-15T10:00:00",
        "hours_until_launch": 3.5,
        "price_precision": 4,
        "quantity_precision": 2,
        "pattern_state": {"sts": 2, "st": 2, "tt": 4},
        "complete_data": true
      }
    ],
    "statistics": {
      "total_detections": 1,
      "successful_snipes": 0,
      "total_profit_usdt": 0.0
    }
  }
}
```

### Trading Strategy Response
```json
{
  "ready_tokens_count": 1,
  "configuration": {
    "buy_amount_usdt": 100,
    "max_concurrent_snipes": 3
  },
  "strategy": "AI-generated trading strategy with entry timing, risk management, and execution plans...",
  "timestamp": "2024-01-15T06:30:00"
}
```

## 🛠️ Development

### Project Structure
```
mexc-sniper-bot/
├── api/
│   └── agents.py          # Main FastAPI application
├── docs/
│   └── new_pattern.md     # Pattern discovery documentation
├── requirements.txt       # Python dependencies
├── test_mexc_agent.py    # Test suite
└── MEXC_AGENT_README.md  # This file
```

### Adding New Tools

```python
class CustomMEXCTool(Tool):
    def __init__(self):
        super().__init__(
            name="custom_tool",
            description="Description of what this tool does"
        )
    
    async def run(self, **kwargs) -> str:
        # Tool implementation
        return "Tool result"
```

### Adding New Agents

```python
custom_agent = Agent(
    name="Custom Agent",
    model="gpt-4o",
    instructions="Agent instructions...",
    tools=[CustomMEXCTool()]
)
```

## 🔧 Configuration

### Environment Variables
- `OPENAI_API_KEY` - Required for AI agents
- `MEXC_API_KEY` - Optional, for authenticated MEXC API calls
- `MEXC_SECRET_KEY` - Optional, for signed MEXC API calls
- `VERCEL_URL` - Automatically set in Vercel deployment

### Pattern Configuration
- Default ready pattern: `sts:2, st:2, tt:4`
- Configurable via API requests
- Timing windows and filters adjustable

## 🚀 Deployment

### Local Development
```bash
uvicorn api.agents:app --reload
```

### Vercel Deployment
The FastAPI app is configured for Vercel serverless deployment:
- Automatic handling via `app` export
- Environment variables via Vercel dashboard
- Serverless function optimization

### Docker Deployment
```dockerfile
FROM python:3.11-slim
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "api.agents:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 📈 Performance Benefits

| Aspect | Traditional | Agent-Based |
|--------|-------------|-------------|
| Data Discovery | Manual/Reactive | AI-Powered/Proactive |
| Pattern Recognition | Rule-Based | Intelligent Analysis |
| Strategy Generation | Static | Dynamic/Adaptive |
| Timing Analysis | Basic | Comprehensive |
| Risk Assessment | Limited | Multi-Factor |

## 🔍 Monitoring

### Health Checks
- API endpoint health
- Agent functionality
- MEXC API connectivity
- Pattern discovery status

### Metrics
- Pattern detection rate
- Ready token count
- Analysis accuracy
- Response times

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Update documentation
5. Submit pull request

## 📄 License

This project follows the same licensing terms as the main MEXC Sniper Bot project.

---

**Ready to discover patterns and snipe tokens with AI? 🎯**

Start the agent system and let AI find the opportunities for you!
