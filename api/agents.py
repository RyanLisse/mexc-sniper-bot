import json
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from agents import Agent, Runner, WebSearchTool, function_tool

# Import new components
from src.config import settings
from src.models import (
    ApiCredentialsRequest,
    ApiCredentialsResponse,
    MonitoredListingResponse,
    SnipeTargetResponse,
    UserPreferencesRequest,
    UserPreferencesResponse,
)

# Dynamic database import based on configuration
if settings.USE_TURSO_DB:
    from src.turso_database import (
        create_api_credentials,
        create_user_preferences,
        delete_api_credentials,
        get_all_user_credentials,
        get_api_credentials,
        get_async_session,
        get_user_preferences,
        shutdown_database,
        startup_database,
        update_user_preferences,
    )
else:
    from src.database import (
        create_api_credentials,
        create_user_preferences,
        delete_api_credentials,
        get_all_user_credentials,
        get_api_credentials,
        get_async_session,
        get_user_preferences,
        shutdown_database,
        startup_database,
        update_user_preferences,
    )
from src.services.cache_service import close_cache_service, get_cache_service
from src.services.encryption_service import decrypt_api_credentials, encrypt_api_credentials
from src.services.mexc_api import close_mexc_client, get_mexc_client
from src.services.pattern_discovery import PatternDiscoveryEngine, get_discovery_engine

# Configure logging
logger = logging.getLogger(__name__)

# Import Inngest components
try:
    from inngest.fast_api import serve as inngest_serve
    from src.inngest_client import inngest_client
    from src.inngest_functions import inngest_functions
    INNGEST_AVAILABLE = True
    logger.info("Inngest integration available")
except ImportError as e:
    INNGEST_AVAILABLE = False
    logger.warning(f"Inngest not available: {e}")
    inngest_client = None
    inngest_functions = []

# Load API keys from environment
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MEXC_API_KEY = os.getenv("MEXC_API_KEY")
MEXC_SECRET_KEY = os.getenv("MEXC_SECRET_KEY")

if not OPENAI_API_KEY:
    print("OPENAI_API_KEY not found in environment variables", file=sys.stderr)
    raise ValueError("OPENAI_API_KEY must be set")

# MEXC API constants
MEXC_BASE_URL = "https://api.mexc.com"
MEXC_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9"
}

# Define request schemas
class TopicsRequest(BaseModel):
    topics: list[str]

class FormatRequest(BaseModel):
    raw_content: str
    topics: list[str]

# MEXC-specific request schemas
class PatternDiscoveryRequest(BaseModel):
    action: str = Field(..., description="Action to perform: 'start', 'stop', 'status'")

class TokenAnalysisRequest(BaseModel):
    symbol: str = Field(..., description="Token symbol to analyze (e.g., 'BTCUSDT')")

class SnipeConfigRequest(BaseModel):
    buy_amount_usdt: float = Field(default=100, description="Amount in USDT to invest")
    max_concurrent_snipes: int = Field(default=3, description="Maximum concurrent snipes")
    pattern_sts: int = Field(default=2, description="Target STS value for ready pattern")
    pattern_st: int = Field(default=2, description="Target ST value for ready pattern")
    pattern_tt: int = Field(default=4, description="Target TT value for ready pattern")

# Application lifecycle management
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown"""
    # Startup
    try:
        # Initialize database
        await startup_database()

        # Initialize cache service
        cache_service = await get_cache_service()

        # Initialize MEXC API client with cache
        await get_mexc_client(cache_service=cache_service)

        logger.info("Application startup completed with cache integration")
    except Exception as e:
        logger.error(f"Application startup failed: {e}")
        raise

    yield

    # Shutdown
    try:
        await close_mexc_client()
        await close_cache_service()
        await shutdown_database()
        logger.info("Application shutdown completed")
    except Exception as e:
        logger.error(f"Application shutdown error: {e}")

# Initialize FastAPI app with lifecycle management
app = FastAPI(
    title="MEXC Pattern Discovery Agents",
    root_path="/api/agents",
    lifespan=lifespan
)

# Integrate Inngest if available
if INNGEST_AVAILABLE and settings.inngest_configured:
    try:
        inngest_serve(app, inngest_client, inngest_functions)
        logger.info("Inngest functions registered with FastAPI")
    except Exception as e:
        logger.error(f"Failed to register Inngest functions: {e}")
        INNGEST_AVAILABLE = False
elif not settings.inngest_configured:
    logger.info("Inngest not configured - skipping function registration")
else:
    logger.warning("Inngest not available - functions will not be served")

# Global state for pattern discovery
pattern_discovery_state = {
    "running": False,
    "ready_tokens": [],
    "pattern_states": {},
    "last_update": None,
    "statistics": {
        "total_detections": 0,
        "successful_snipes": 0,
        "total_profit_usdt": 0.0
    }
}

# MEXC API Tools using function_tool decorator
@function_tool
async def mexc_calendar() -> str:
    """Fetch upcoming token listings from MEXC calendar API.
    
    Returns calendar data for upcoming token listings on MEXC exchange.
    """
    try:
        mexc_client = await get_mexc_client()
        calendar_entries = await mexc_client.get_calendar_listings()

        # Filter for upcoming listings (next 7 days)
        now = time.time() * 1000  # Convert to milliseconds
        week_from_now = now + (7 * 24 * 60 * 60 * 1000)

        upcoming = [
            entry for entry in calendar_entries
            if entry.firstOpenTime > now and entry.firstOpenTime < week_from_now
        ]

        return json.dumps({
            "status": "success",
            "total_entries": len(calendar_entries),
            "upcoming_count": len(upcoming),
            "upcoming_listings": [entry.dict() for entry in upcoming[:10]]  # Limit to 10 for readability
        }, indent=2)
    except Exception as e:
        return f"Error: {e!s}"

@function_tool
async def mexc_symbols_v2(vcoin_id: str = None) -> str:
    """Fetch symbol data from MEXC symbolsV2 API to detect ready state patterns.
    
    Args:
        vcoin_id: Optional filter for specific vcoin ID
        
    Returns symbol data with pattern detection analysis.
    """
    try:
        mexc_client = await get_mexc_client()
        symbols = await mexc_client.get_symbols_v2(vcoin_id=vcoin_id)

        # Look for ready pattern (sts:2, st:2, tt:4)
        ready_pattern_symbols = [
            s for s in symbols
            if s.matches_ready_pattern(settings.READY_STATE_PATTERN)
        ]

        # Analyze state distribution
        state_distribution = {}
        for symbol in symbols:
            state_key = f"sts:{symbol.sts},st:{symbol.st},tt:{symbol.tt}"
            state_distribution[state_key] = state_distribution.get(state_key, 0) + 1

        return json.dumps({
            "status": "success",
            "total_symbols": len(symbols),
            "ready_pattern_count": len(ready_pattern_symbols),
            "ready_pattern_symbols": [s.dict() for s in ready_pattern_symbols[:5]],  # Limit for readability
            "state_distribution": dict(sorted(state_distribution.items(), key=lambda x: x[1], reverse=True)[:10]),
            "vcoin_id_filter": vcoin_id
        }, indent=2)
    except Exception as e:
        return f"Error: {e!s}"

@function_tool
async def mexc_pattern_analysis() -> str:
    """Analyze patterns by correlating calendar data with symbols data to find ready tokens.
    
    Performs comprehensive pattern analysis using centralized service.
    """
    try:
        # Use the pattern discovery engine for analysis
        engine = PatternDiscoveryEngine()
        analysis_results = await engine.analyze_current_opportunities()

        # Convert to JSON-serializable format
        return json.dumps({
            "status": "success",
            "analysis": analysis_results,
            "timestamp": datetime.now().isoformat()
        }, indent=2)
    except Exception as e:
        return f"Error in pattern analysis: {e!s}"

# MEXC Pattern Discovery Agent
mexc_pattern_agent = Agent(
    name="MEXC Pattern Discovery Agent",
    model="gpt-4o",
    instructions=(
        "You are an expert MEXC token sniper bot agent specializing in pattern discovery for new token listings.\n\n"
        "Your expertise:\n"
        "1. **Pattern Recognition**: You understand the MEXC ready state pattern (sts:2, st:2, tt:4) that appears ~3.5 hours before trading begins\n"
        "2. **Data Correlation**: You can correlate calendar data (vcoinIds) with symbolsV2 data to find ready tokens\n"
        "3. **Timing Analysis**: You calculate precise launch times and advance notice periods\n"
        "4. **Risk Assessment**: You evaluate token readiness and data completeness\n\n"
        "Your tools:\n"
        "- mexc_calendar: Fetch upcoming token listings\n"
        "- mexc_symbols_v2: Check symbol states and detect ready patterns\n"
        "- mexc_pattern_analysis: Comprehensive analysis correlating all data\n\n"
        "Your responses should:\n"
        "- Provide clear, actionable insights about token opportunities\n"
        "- Highlight ready tokens with complete trading data\n"
        "- Calculate precise timing and advance notice\n"
        "- Assess data quality and completeness\n"
        "- Recommend next actions for the sniper bot\n\n"
        "Always use your tools to get real-time data before making recommendations."
    ),
    tools=[mexc_calendar, mexc_symbols_v2, mexc_pattern_analysis]
)

# MEXC Trading Strategy Agent
mexc_strategy_agent = Agent(
    name="MEXC Trading Strategy Agent",
    model="gpt-4o",
    instructions=(
        "You are a professional cryptocurrency trading strategist specializing in MEXC token launch sniping.\n\n"
        "Your expertise:\n"
        "1. **Entry Strategy**: Optimal timing and order types for token launches\n"
        "2. **Risk Management**: Position sizing, stop losses, and profit targets\n"
        "3. **Market Analysis**: Understanding launch dynamics and price action\n"
        "4. **Execution Planning**: Pre-computation strategies and order preparation\n\n"
        "Given ready token data, you provide:\n"
        "- Recommended buy amounts and order types\n"
        "- Entry timing strategies (market vs limit orders)\n"
        "- Risk management parameters (stop loss, take profit levels)\n"
        "- Position sizing based on token characteristics\n"
        "- Execution sequence and backup plans\n\n"
        "Your recommendations should be:\n"
        "- Conservative and risk-aware\n"
        "- Based on proven sniper bot strategies\n"
        "- Adaptable to different market conditions\n"
        "- Clear and actionable for automated execution"
    ),
    tools=[]
)

@app.get("/ping")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "openai_api_key_set": bool(OPENAI_API_KEY),
        "mexc_api_key_set": bool(MEXC_API_KEY),
        "mexc_secret_key_set": bool(MEXC_SECRET_KEY),
        "vercel_url": os.getenv("VERCEL_URL", "not set"),
        "python_version": sys.version,
        "agents_imported": "agents" in sys.modules,
        "pattern_discovery_running": pattern_discovery_state["running"],
        "ready_tokens_count": len(pattern_discovery_state["ready_tokens"]),
    }

# Research Agent: Searches web and generates newsletter content
research_agent = Agent(
    name="Research Agent",
    model="gpt-4.1",
    instructions=(
        "You are an AI assistant that creates insightful, well-connected newsletters on a set of given topics.\n\n"
        "Your process:\n"
        "1. Search the web comprehensively for the latest news and information on each one of the given topics individually:\n"
        "   - Perform multiple searches with different query variations to ensure broad coverage\n"
        "   - Look for recent articles (prioritize content from the last 7-30 days)\n"
        "   - Search for both general news and specific expert analysis\n"
        "   - If initial results are insufficient, refine your search queries and search again\n"
        "2. Repeat the same approach to search for the other topics given\n"
        "3. For each topic, analyze the articles to identify connections, patterns, and relationships between them.\n"
        "4. Create a cohesive narrative that explains how these articles relate to each other.\n\n"
        "Your output structure:\n"
        "**[Create a compelling title that captures the essence of how all topics connect]**\n\n"
        "*[Write one impactful sentence that summarizes the key relationship or theme connecting all the topics]*\n\n"
        "**Executive Summary**\n"
        "Start with a compelling 2-3 paragraph summary that:\n"
        "- Identifies the main themes across all articles\n"
        "- Explains the connections and relationships between different pieces of information\n"
        "- Highlights why these connections matter\n"
        "- Provides context for how these topics intersect\n\n"
        "**Key Insights**\n"
        "- List 3-5 major insights that emerge from analyzing these articles together\n"
        "- Explain how different sources complement or contradict each other\n\n"
        "**Detailed Analysis**\n"
        "For each major theme or connection:\n"
        "- Provide specific examples from the articles\n"
        "- Include relevant facts, figures, and quotes\n"
        "- Cite sources properly\n\n"
        "**Conclusion**\n"
        "Synthesize everything into a forward-looking paragraph about implications and trends.\n\n"
        "Use clear, engaging language throughout.\n"
        "Focus on creating a narrative that shows how these topics interconnect rather than just listing summaries."
    ),
    tools=[ WebSearchTool() ]
)

# Formatting Agent: Transforms content into polished markdown
formatting_agent = Agent(
    name="Formatting Agent",
    model="o3",
    instructions=(
        "You are an expert editor and markdown formatter who transforms research content into beautiful, readable newsletters.\n\n"
        "Your task:\n"
        "1. Take the provided research content and transform it into a polished newsletter\n"
        "2. Apply professional markdown formatting:\n"
        "   - Use **bold** for the main title\n"
        "   - Use *italics* for the one-sentence summary\n"
        "   - Structure content with clear hierarchical headers (##, ###)\n"
        "   - Create visually appealing lists with bullet points or numbers\n"
        "   - Add pull quotes using > blockquote syntax for key insights\n"
        "   - Use horizontal rules (---) to separate major sections\n"
        "   - Format links properly: [text](url)\n"
        "   - Add emphasis with **bold** and *italic* text strategically\n"
        "3. Enhance readability:\n"
        "   - Break up long paragraphs\n"
        "   - Add spacing between sections\n"
        "   - Create clear visual hierarchy\n"
        "   - Ensure smooth flow between sections\n"
        "4. Maintain all the original content and insights\n"
        "5. The output should be publication-ready markdown that looks professional when rendered\n\n"
        "Transform the content into an engaging, visually appealing newsletter while preserving all information."
    ),
    tools=[]
)

@app.post("/research")
async def generate_research(request: TopicsRequest):
    topics = request.topics
    if not topics:
        return {"error": "No topics provided."}

    # Get current date and yesterday for fresh news focus
    from datetime import timedelta
    today = datetime.now()
    yesterday = today - timedelta(days=1)
    today_str = today.strftime("%B %d, %Y")
    yesterday_str = yesterday.strftime("%B %d, %Y")

    # Compose a prompt by joining the topics
    topics_list = ", ".join(topics)
    user_prompt = (
        f"Today is {today_str}. I need you to research and analyze these topics comprehensively: {topics_list}. "
        f"IMPORTANT: Focus specifically on news and events from the last 24 hours (since {yesterday_str}). "
        f"When searching, please include date filters like 'today', 'yesterday', 'last 24 hours', or specific dates like '{today_str}' and '{yesterday_str}' in your search queries. "
        f"Find the most recent developments, breaking news, and current events related to these topics. "
        f"Look for connections between them and create a detailed report emphasizing what's happening RIGHT NOW."
    )

    # Run the research agent
    result = await Runner.run(research_agent, user_prompt)
    raw_content = result.final_output

    return {"content": raw_content}

@app.post("/format")
async def format_newsletter(request: FormatRequest):
    raw_content = request.raw_content
    topics = request.topics

    if not raw_content:
        return {"error": "No content provided."}

    # Create formatting prompt
    topics_list = ", ".join(topics)
    user_prompt = f"Transform this research content into a beautifully formatted newsletter about {topics_list}. Apply professional markdown formatting:\n\n{raw_content}"

    # Run the formatting agent
    result = await Runner.run(formatting_agent, user_prompt)
    formatted_content = result.final_output

    return {"content": formatted_content}

# MEXC Pattern Discovery Endpoints

@app.post("/mexc/pattern-discovery")
async def mexc_pattern_discovery(request: PatternDiscoveryRequest):
    """Enhanced MEXC pattern discovery system with database persistence"""
    action = request.action.lower()
    discovery_engine = get_discovery_engine()

    if action == "start":
        try:
            # Start the enhanced pattern discovery system
            result = await discovery_engine.start_monitoring()

            # Update legacy state for backward compatibility
            pattern_discovery_state["running"] = True
            pattern_discovery_state["last_update"] = datetime.now().isoformat()

            return {
                "status": "started",
                "message": "Enhanced pattern discovery system started with database persistence",
                "discovery_result": {
                    "new_listings_found": result.new_listings_found,
                    "ready_targets_found": result.ready_targets_found,
                    "targets_scheduled": result.targets_scheduled,
                    "errors": result.errors,
                    "analysis_timestamp": result.analysis_timestamp.isoformat()
                },
                "state": pattern_discovery_state
            }
        except Exception as e:
            logger.error(f"Failed to start pattern discovery: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to start pattern discovery: {e!s}")

    elif action == "stop":
        discovery_engine.stop_monitoring()
        pattern_discovery_state["running"] = False
        return {
            "status": "stopped",
            "message": "Pattern discovery system stopped",
            "state": pattern_discovery_state
        }

    elif action == "status":
        try:
            # Get enhanced status from discovery engine
            enhanced_status = await discovery_engine.get_discovery_status()

            # Update legacy state
            pattern_discovery_state["running"] = enhanced_status["running"]
            pattern_discovery_state["last_update"] = datetime.now().isoformat()

            return {
                "status": "running" if enhanced_status["running"] else "stopped",
                "enhanced_status": enhanced_status,
                "state": pattern_discovery_state
            }
        except Exception as e:
            logger.error(f"Failed to get discovery status: {e}")
            return {
                "status": "error",
                "error": str(e),
                "state": pattern_discovery_state
            }

    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'start', 'stop', or 'status'")

@app.post("/mexc/analyze-token")
async def mexc_analyze_token(request: TokenAnalysisRequest):
    """Analyze a specific token for trading opportunities"""
    symbol = request.symbol

    user_prompt = (
        f"Analyze the token {symbol} for trading opportunities. Check if it appears in the calendar data, "
        f"examine its current state in symbolsV2, determine if it matches the ready pattern, and assess "
        f"the completeness of trading data. Provide timing analysis and trading recommendations."
    )

    result = await Runner.run(mexc_pattern_agent, user_prompt)

    return {
        "symbol": symbol,
        "analysis": result.final_output,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/mexc/trading-strategy")
async def mexc_trading_strategy(request: SnipeConfigRequest):
    """Get trading strategy recommendations for ready tokens"""

    ready_tokens = pattern_discovery_state.get("ready_tokens", [])

    if not ready_tokens:
        return {
            "error": "No ready tokens found. Run pattern discovery first.",
            "suggestion": "Use /mexc/pattern-discovery with action='start' to find ready tokens"
        }

    user_prompt = (
        f"Based on these ready tokens: {json.dumps(ready_tokens, indent=2)}\n\n"
        f"Configuration:\n"
        f"- Buy amount: {request.buy_amount_usdt} USDT\n"
        f"- Max concurrent snipes: {request.max_concurrent_snipes}\n"
        f"- Target pattern: sts:{request.pattern_sts}, st:{request.pattern_st}, tt:{request.pattern_tt}\n\n"
        f"Provide detailed trading strategies for each ready token including:\n"
        f"1. Entry timing and order types\n"
        f"2. Position sizing recommendations\n"
        f"3. Risk management parameters\n"
        f"4. Execution sequence and priorities\n"
        f"5. Backup plans and contingencies"
    )

    result = await Runner.run(mexc_strategy_agent, user_prompt)

    return {
        "ready_tokens_count": len(ready_tokens),
        "configuration": request.dict(),
        "strategy": result.final_output,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/mexc/status")
async def mexc_status():
    """Get comprehensive status of MEXC pattern discovery system"""
    try:
        discovery_engine = get_discovery_engine()
        enhanced_status = await discovery_engine.get_discovery_status()

        # Get fresh AI analysis
        user_prompt = (
            "Provide a comprehensive status update of the MEXC pattern discovery system. "
            "Check current calendar data, analyze symbol states, and provide an overview "
            "of opportunities, timing, and system health."
        )

        result = await Runner.run(mexc_pattern_agent, user_prompt)

        return {
            "system_status": "running" if enhanced_status["running"] else "stopped",
            "enhanced_status": enhanced_status,
            "state": pattern_discovery_state,
            "live_analysis": result.final_output,
            "timestamp": datetime.now().isoformat(),
            "api_status": {
                "mexc_api_configured": settings.mexc_api_configured,
                "database_configured": settings.database_configured,
                "redis_configured": settings.redis_configured,
                "openai_configured": bool(OPENAI_API_KEY)
            },
            "cache_stats": await _get_cache_stats()
        }
    except Exception as e:
        logger.error(f"Error getting MEXC status: {e}")
        return {
            "system_status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

# New enhanced endpoints for database-backed functionality

@app.get("/mexc/monitored-listings")
async def get_monitored_listings():
    """Get all monitored token listings from database"""
    try:
        async with get_async_session() as session:
            from src.database import get_monitoring_listings
            listings = await get_monitoring_listings(session)

            return {
                "status": "success",
                "count": len(listings),
                "listings": [
                    MonitoredListingResponse(
                        vcoin_id=listing.vcoin_id,
                        symbol_name=listing.symbol_name,
                        project_name=listing.project_name,
                        announced_launch_datetime_utc=listing.announced_launch_datetime_utc,
                        status=listing.status,
                        created_at=listing.created_at,
                        updated_at=listing.updated_at
                    ) for listing in listings
                ],
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        logger.error(f"Error getting monitored listings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/mexc/snipe-targets")
async def get_snipe_targets():
    """Get all snipe targets from database"""
    try:
        async with get_async_session() as session:
            from src.database import get_pending_snipe_targets
            targets = await get_pending_snipe_targets(session)

            return {
                "status": "success",
                "count": len(targets),
                "targets": [
                    SnipeTargetResponse(
                        id=target.id,
                        vcoin_id=target.vcoin_id,
                        mexc_symbol_contract=target.mexc_symbol_contract,
                        price_precision=target.price_precision,
                        quantity_precision=target.quantity_precision,
                        actual_launch_datetime_utc=target.actual_launch_datetime_utc,
                        discovered_at_utc=target.discovered_at_utc,
                        hours_advance_notice=target.hours_advance_notice,
                        intended_buy_amount_usdt=target.intended_buy_amount_usdt,
                        execution_status=target.execution_status,
                        executed_at_utc=target.executed_at_utc
                    ) for target in targets
                ],
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        logger.error(f"Error getting snipe targets: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/mexc/run-discovery")
async def run_discovery_cycle():
    """Manually trigger a discovery cycle"""
    try:
        discovery_engine = get_discovery_engine()
        result = await discovery_engine.run_discovery_cycle()

        return {
            "status": "success",
            "result": {
                "new_listings_found": result.new_listings_found,
                "ready_targets_found": result.ready_targets_found,
                "targets_scheduled": result.targets_scheduled,
                "errors": result.errors,
                "analysis_timestamp": result.analysis_timestamp.isoformat()
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error running discovery cycle: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Helper functions

async def _get_cache_stats():
    """Get cache statistics"""
    try:
        cache_service = await get_cache_service()
        return await cache_service.get_stats()
    except Exception as e:
        logger.warning(f"Failed to get cache stats: {e}")
        return {"available": False, "error": str(e)}

@app.get("/mexc/cache-stats")
async def get_cache_stats():
    """Get cache service statistics and performance metrics"""
    try:
        stats = await _get_cache_stats()
        return {
            "status": "success",
            "cache_stats": stats,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting cache stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/mexc/cache-clear")
async def clear_cache(pattern: str = "*"):
    """Clear cache entries matching pattern"""
    try:
        cache_service = await get_cache_service()
        cleared_count = await cache_service.clear_pattern(pattern)

        return {
            "status": "success",
            "message": f"Cleared {cleared_count} cache entries matching pattern: {pattern}",
            "cleared_count": cleared_count,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error clearing cache: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/mexc/inngest-trigger-calendar-poll")
async def trigger_calendar_poll():
    """Manually trigger Inngest calendar poll function"""
    if not INNGEST_AVAILABLE:
        raise HTTPException(status_code=503, detail="Inngest not available")

    try:
        # Send manual trigger event
        await inngest_client.send({
            "name": "admin.calendar.poll.requested",
            "data": {
                "triggered_by": "api",
                "timestamp": datetime.now().isoformat()
            }
        })

        return {
            "status": "success",
            "message": "Calendar poll triggered successfully",
            "event_sent": "admin.calendar.poll.requested",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error triggering calendar poll: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/mexc/inngest-status")
async def get_inngest_status():
    """Get Inngest integration status"""
    return {
        "inngest_available": INNGEST_AVAILABLE,
        "inngest_configured": settings.inngest_configured,
        "functions_registered": len(inngest_functions) if INNGEST_AVAILABLE else 0,
        "calendar_poll_cron": settings.CALENDAR_POLL_CRON,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now().isoformat()
    }

# User Preferences Management Endpoints

@app.get("/user/preferences/{user_id}")
async def get_user_preferences_endpoint(user_id: str) -> UserPreferencesResponse:
    """Get user preferences"""
    try:
        async with get_async_session() as session:
            preferences = await get_user_preferences(session, user_id)
            
            if not preferences:
                # Create default preferences if they don't exist
                preferences = await create_user_preferences(session, user_id)
            
            return UserPreferencesResponse.model_validate(preferences)
    except Exception as e:
        logger.error(f"Error getting user preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/user/preferences/{user_id}")
async def update_user_preferences_endpoint(
    user_id: str,
    request: UserPreferencesRequest
) -> UserPreferencesResponse:
    """Update user preferences"""
    try:
        async with get_async_session() as session:
            # Convert request to dict and filter out None values
            update_data = request.model_dump(exclude_unset=True, exclude_none=True)
            
            preferences = await update_user_preferences(session, user_id, update_data)
            return UserPreferencesResponse.model_validate(preferences)
    except Exception as e:
        logger.error(f"Error updating user preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# API Credentials Management Endpoints

@app.get("/user/credentials/{user_id}")
async def get_user_credentials_endpoint(user_id: str) -> list[ApiCredentialsResponse]:
    """Get all API credentials for a user (without sensitive data)"""
    try:
        async with get_async_session() as session:
            credentials_list = await get_all_user_credentials(session, user_id)
            
            # Convert to response format without sensitive data
            response_list = []
            for cred in credentials_list:
                response_list.append(ApiCredentialsResponse(
                    id=cred.id,
                    user_id=cred.user_id,
                    provider=cred.provider,
                    is_active=cred.is_active,
                    is_testnet=cred.is_testnet,
                    nickname=cred.nickname,
                    permissions=cred.permissions,
                    has_api_key=bool(cred.api_key_encrypted),
                    has_secret_key=bool(cred.secret_key_encrypted),
                    created_at=cred.created_at,
                    updated_at=cred.updated_at,
                    last_used_at=cred.last_used_at
                ))
            
            return response_list
    except Exception as e:
        logger.error(f"Error getting user credentials: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/user/credentials/{user_id}")
async def create_api_credentials_endpoint(
    user_id: str,
    request: ApiCredentialsRequest
) -> ApiCredentialsResponse:
    """Create or update API credentials for a user"""
    try:
        # Encrypt the credentials
        encrypted_data = encrypt_api_credentials(
            request.api_key,
            request.secret_key,
            request.passphrase
        )
        
        async with get_async_session() as session:
            credentials = await create_api_credentials(
                session=session,
                user_id=user_id,
                provider=request.provider,
                api_key_encrypted=encrypted_data["api_key_encrypted"],
                secret_key_encrypted=encrypted_data["secret_key_encrypted"],
                passphrase_encrypted=encrypted_data["passphrase_encrypted"],
                is_testnet=request.is_testnet,
                nickname=request.nickname,
                permissions_json=json.dumps(request.permissions)
            )
            
            # Return response without sensitive data
            return ApiCredentialsResponse(
                id=credentials.id,
                user_id=credentials.user_id,
                provider=credentials.provider,
                is_active=credentials.is_active,
                is_testnet=credentials.is_testnet,
                nickname=credentials.nickname,
                permissions=credentials.permissions,
                has_api_key=bool(credentials.api_key_encrypted),
                has_secret_key=bool(credentials.secret_key_encrypted),
                created_at=credentials.created_at,
                updated_at=credentials.updated_at,
                last_used_at=credentials.last_used_at
            )
    except Exception as e:
        logger.error(f"Error creating API credentials: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/user/credentials/{user_id}/{provider}")
async def delete_api_credentials_endpoint(user_id: str, provider: str):
    """Delete API credentials for a user and provider"""
    try:
        async with get_async_session() as session:
            deleted = await delete_api_credentials(session, user_id, provider)
            
            if not deleted:
                raise HTTPException(status_code=404, detail="Credentials not found")
            
            return {
                "status": "success",
                "message": f"API credentials for {provider} deleted successfully",
                "timestamp": datetime.now().isoformat()
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting API credentials: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/user/credentials/{user_id}/{provider}/decrypt")
async def get_decrypted_credentials(user_id: str, provider: str):
    """Get decrypted API credentials for use (admin/internal use only)"""
    try:
        async with get_async_session() as session:
            credentials = await get_api_credentials(session, user_id, provider)
            
            if not credentials:
                raise HTTPException(status_code=404, detail="Credentials not found")
            
            # Decrypt the credentials
            decrypted_data = decrypt_api_credentials({
                "api_key_encrypted": credentials.api_key_encrypted,
                "secret_key_encrypted": credentials.secret_key_encrypted,
                "passphrase_encrypted": credentials.passphrase_encrypted,
            })
            
            return {
                "provider": credentials.provider,
                "api_key": decrypted_data["api_key"],
                "secret_key": decrypted_data["secret_key"],
                "passphrase": decrypted_data["passphrase"],
                "is_testnet": credentials.is_testnet,
                "permissions": credentials.permissions,
                "last_used_at": credentials.last_used_at
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error decrypting API credentials: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# IMPORTANT: Handler for Vercel serverless functions
# Vercel's Python runtime will automatically handle FastAPI apps
# No additional configuration needed - just export the 'app' variable
