Okay, providing the *entire* codebase for a full-fledged, production-ready MEXC sniper bot AI agent integrated with `serverless-agents`, NeonDB, Inngest, Valkey, and a Next.js frontend is a very extensive task beyond a single response. It involves multiple services, significant boilerplate from the base repository, and detailed error handling and security considerations.

However, I can provide you with the core Python backend components, focusing on how your existing logic integrates into the FastAPI, Pydantic, Inngest, and database structure. You would then integrate these into the `serverless-agents` Vercel function structure and build the Next.js frontend on top.

**Please treat this as a foundational backend template. You will need to:**

1.  **Integrate with `serverless-agents`:** Adapt this code to fit into the Vercel function handlers and project structure of `serverless-agents`.
2.  **Implement Full Error Handling:** Add comprehensive error handling, retries (especially for network requests), and dead-letter queueing where appropriate with Inngest.
3.  **Security Hardening:** Ensure all sensitive data is handled via environment variables, secure API authentication, and proper input validation.
4.  **Thorough Testing:** Test each component and the end-to-end flow rigorously, especially the order placement logic with small amounts.
5.  **Frontend Development:** Build the Next.js frontend to interact with the FastAPI endpoints.
6.  **Database Migrations:** For schema changes, implement a migration tool (like Alembic if using SQLAlchemy/SQLModel).

Here are the key Python backend files:

**Project Structure (Conceptual):**

```
mexc_sniper_project/
├── .env.example
├── requirements.txt
└── src/
    ├── config.py
    ├── models.py
    ├── db.py
    ├── services/
    │   ├── __init__.py
    │   ├── mexc_api.py
    │   └── cache_service.py (Optional Valkey integration)
    ├── inngest_client.py
    ├── inngest_app.py       # To define and serve Inngest functions
    └── main.py              # FastAPI app
```

---

**1. `.env.example`**

```env
# MEXC API Credentials
MEXC_API_KEY="YOUR_MEXC_API_KEY"
MEXC_API_SECRET="YOUR_MEXC_API_SECRET"

# NeonDB Connection String (PostgreSQL)
# Example: postgresql+asyncpg://username:password@host:port/database
NEONDB_URL="YOUR_NEONDB_CONNECTION_STRING"

# Valkey/Redis Connection String (Optional)
# Example: redis://localhost:6379/0
VALKEY_URL=""

# Inngest Keys (Obtain from Inngest Cloud or set for self-hosting)
INNGEST_EVENT_KEY="YOUR_INNGEST_EVENT_KEY" # If using Inngest Cloud with signed events
INNGEST_SIGNING_KEY="YOUR_INNGEST_SIGNING_KEY" # For serving functions locally/self-hosted
# INNGEST_BASE_URL, INNGEST_API_BASE_URL (if not using default Inngest Cloud)

# Application Settings
LOG_LEVEL="INFO"
ENVIRONMENT="development" # or "production"
```

---

**2. `requirements.txt`**

```txt
fastapi
uvicorn[standard] # For local running
pydantic>=2.0.0
pydantic-settings
httpx
sqlmodel # For DB interaction (Pydantic + SQLAlchemy)
asyncpg # PostgreSQL driver for NeonDB
inngest
redis # For Valkey client (if used)
python-dotenv # For loading .env file locally

# For logging and utility
structlog # Optional: for structured logging
```

---

**3. `src/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Tuple, Optional

class AppConfig(BaseSettings):
    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        extra='ignore',
        case_sensitive=False # Environment variables are usually uppercase
    )

    # API Settings
    MEXC_API_KEY: str
    MEXC_API_SECRET: str
    
    NEONDB_URL: str
    VALKEY_URL: Optional[str] = None

    INNGEST_EVENT_KEY: Optional[str] = None
    INNGEST_SIGNING_KEY: Optional[str] = None # Required for serving Inngest functions

    # Endpoints
    MEXC_BASE_URL: str = "https://api.mexc.com"
    MEXC_CALENDAR_ENDPOINT: str = "/api/operation/new_coin_calendar"
    MEXC_SYMBOLS_V2_ENDPOINT: str = "/api/platform/spot/market-v2/web/symbolsV2"
    MEXC_ORDER_ENDPOINT: str = "/api/v3/order"
    
    # Timing Settings
    CALENDAR_POLL_CRON: str = "*/5 * * * *" # Inngest cron: every 5 minutes
    SYMBOLS_POLL_INTERVAL_SECONDS_DEFAULT: int = 30
    SYMBOLS_POLL_INTERVAL_SECONDS_NEAR_LAUNCH: int = 5
    SYMBOLS_POLL_NEAR_LAUNCH_THRESHOLD_MINUTES: int = 60
    
    # Trading Settings
    BUY_AMOUNT_USDT: float = 10.0 # Default, can be overridden
    
    READY_STATE_PATTERN: Tuple[int, int, int] = (2, 2, 4) # sts:2, st:2, tt:4

    LOG_LEVEL: str = "INFO"
    ENVIRONMENT: str = "development"

# Initialize config globally or inject as dependency
settings = AppConfig()
```

---

**4. `src/models.py`** (Combines Pydantic data models and SQLModel table models)

```python
from __future__ import annotations
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, validator
from sqlmodel import SQLModel, Field as SQLField, Relationship # Use SQLField to avoid Pydantic Field conflict

# --- Pydantic Models for API Validation & Business Logic (from your script) ---
class BaseApiModel(BaseModel):
    class Config:
        from_attributes = True # Formerly orm_mode

class CalendarEntryApi(BaseApiModel):
    vcoinId: str
    symbol: str
    projectName: str
    firstOpenTime: int  # Unix ms
    
    @property
    def launch_datetime(self) -> datetime:
        return datetime.fromtimestamp(self.firstOpenTime / 1000, tz=timezone.utc)

class SymbolV2EntryApi(BaseApiModel):
    cd: str  # vcoinId
    ca: Optional[str] = None  # Contract address (symbol like "BTCUSDT")
    ps: Optional[int] = None  # Price scale
    qs: Optional[int] = None  # Quantity scale
    sts: int
    st: int
    tt: int
    ot: Optional[int] = None  # Open time (ms)
    
    def matches_ready_pattern(self, pattern: tuple) -> bool:
        return (self.sts, self.st, self.tt) == pattern
    
    @property
    def has_complete_data(self) -> bool:
        return all([self.ca, self.ps is not None, self.qs is not None, self.ot is not None])

    @property
    def launch_datetime_from_ot(self) -> Optional[datetime]:
        if self.ot:
            return datetime.fromtimestamp(self.ot / 1000, tz=timezone.utc)
        return None

class SnipeTargetApi(BaseApiModel):
    vcoin_id: str
    symbol_contract: str # This is 'ca' from SymbolV2EntryApi
    project_name: str
    price_precision: int
    quantity_precision: int
    launch_time: datetime
    discovered_at: datetime
    hours_advance_notice: float
    order_params: Dict[str, Any] # Store pre-calculated order parameters

    @property
    def time_until_launch(self) -> timedelta:
        return self.launch_time - datetime.now(timezone.utc)

# --- SQLModel Table Models for Database Persistence ---

class MonitoredListing(SQLModel, table=True):
    __tablename__ = "monitored_listings" # Renamed from calendar_listings for clarity
    vcoin_id: str = SQLField(primary_key=True, index=True)
    symbol_name: str # From calendar
    project_name: str
    announced_launch_time_ms: int
    announced_launch_datetime_utc: datetime
    
    status: str = SQLField(default="monitoring", index=True) # e.g., monitoring, ready, scheduled, executed_success, executed_failed, error
    
    created_at: datetime = SQLField(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = SQLField(default_factory=lambda: datetime.now(timezone.utc), sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)})
    
    snipe_target: Optional["SnipeTargetDb"] = Relationship(back_populates="listing")


class SnipeTargetDb(SQLModel, table=True):
    __tablename__ = "snipe_targets"
    id: Optional[int] = SQLField(default=None, primary_key=True, index=True)
    vcoin_id: str = SQLField(foreign_key="monitored_listings.vcoin_id", unique=True) # One target per listing
    
    mexc_symbol_contract: str  # This is 'ca'
    price_precision: int
    quantity_precision: int
    actual_launch_time_ms: int # This is 'ot'
    actual_launch_datetime_utc: datetime
    
    discovered_at_utc: datetime
    hours_advance_notice: float
    
    # Store the buy amount strategy / fixed amount at time of discovery
    intended_buy_amount_usdt: float 
    
    # Store the critical params for execution, not the full pre-signed order if keys are managed by executor
    execution_order_params_json: Dict[str, Any] = SQLField(default={}) # Store as JSON

    execution_status: str = SQLField(default="pending", index=True) # e.g., pending, scheduled, success, failed
    execution_response_json: Optional[Dict[str, Any]] = SQLField(default=None) # Store as JSON
    executed_at_utc: Optional[datetime] = None
    
    created_at: datetime = SQLField(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = SQLField(default_factory=lambda: datetime.now(timezone.utc), sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)})

    listing: MonitoredListing = Relationship(back_populates="snipe_target")

# Pydantic models for API responses, possibly including DB fields
class MonitoredListingResponse(BaseApiModel):
    vcoin_id: str
    symbol_name: str
    project_name: str
    announced_launch_datetime_utc: datetime
    status: str
    updated_at: datetime

class SnipeTargetDetailResponse(SnipeTargetApi): # Reuse if suitable or create specific
    id: int
    listing: MonitoredListingResponse
    execution_status: str
    executed_at_utc: Optional[datetime]
    execution_response_json: Optional[Dict[str, Any]]

```

---

**5. `src/db.py`**

```python
from sqlmodel import create_engine, SQLModel, Session, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from .config import settings
from .models import MonitoredListing, SnipeTargetDb # Import all SQLModels

# Ensure the engine uses the asyncpg driver for PostgreSQL
async_engine = create_async_engine(settings.NEONDB_URL, echo=False, future=True)

async def init_db():
    async with async_engine.begin() as conn:
        # await conn.run_sync(SQLModel.metadata.drop_all) # Use for testing only
        await conn.run_sync(SQLModel.metadata.create_all)

@asynccontextmanager
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async_session = AsyncSession(async_engine, expire_on_commit=False)
    try:
        yield async_session
        await async_session.commit()
    except Exception:
        await async_session.rollback()
        raise
    finally:
        await async_session.close()

# Example CRUD operations (to be expanded in service layers or repositories)
async def get_listing_by_vcoin_id(session: AsyncSession, vcoin_id: str) -> Optional[MonitoredListing]:
    statement = select(MonitoredListing).where(MonitoredListing.vcoin_id == vcoin_id)
    result = await session.execute(statement)
    return result.scalar_one_or_none()

async def create_listing(session: AsyncSession, listing_data: MonitoredListing) -> MonitoredListing:
    session.add(listing_data)
    await session.flush() # Flushes to get ID if needed, commit happens in context manager
    await session.refresh(listing_data)
    return listing_data

async def get_snipe_target_by_id(session: AsyncSession, target_id: int) -> Optional[SnipeTargetDb]:
    statement = select(SnipeTargetDb).where(SnipeTargetDb.id == target_id)
    result = await session.execute(statement)
    return result.scalar_one_or_none()

# ... add more CRUD functions for SnipeTargetDb etc.
```

---

**6. `src/services/mexc_api.py`**

```python
import httpx
import hmac
import hashlib
import time
from urllib.parse import urlencode
from typing import List, Dict, Any, Optional
import logging

from ..config import AppConfig
from ..models import CalendarEntryApi, SymbolV2EntryApi

logger = logging.getLogger(__name__)

class MexcApiClient:
    def __init__(self, config: AppConfig):
        self.config = config
        self.base_url = config.MEXC_BASE_URL
        # Consider managing client lifecycle if this class is instantiated frequently
        # For serverless, creating client per invocation is often safer.
        self.http_client = httpx.AsyncClient(timeout=10.0) 

    async def close(self):
        await self.http_client.aclose()

    async def get_calendar_listings(self) -> List[CalendarEntryApi]:
        try:
            response = await self.http_client.get(f"{self.base_url}{self.config.MEXC_CALENDAR_ENDPOINT}")
            response.raise_for_status()
            data = response.json()
            
            listings_data = data.get("data", [])
            if not isinstance(listings_data, list):
                logger.warning(f"MEXC Calendar API returned non-list data: {listings_data}")
                return []
                
            valid_entries = []
            for item_data in listings_data:
                try:
                    valid_entries.append(CalendarEntryApi(**item_data))
                except Exception as e:
                    logger.error(f"Failed to parse calendar entry {item_data}: {e}")
            return valid_entries
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error fetching calendar: {e.response.status_code} - {e.response.text}")
        except Exception as e:
            logger.error(f"Error fetching calendar: {e}")
        return []

    async def get_symbols_v2(self) -> List[SymbolV2EntryApi]:
        try:
            # TODO: Implement Valkey caching here if VALKEY_URL is set
            response = await self.http_client.get(f"{self.base_url}{self.config.MEXC_SYMBOLS_V2_ENDPOINT}")
            response.raise_for_status()
            data = response.json()
            
            symbols_data = data.get("data", {}).get("symbols", [])
            if not isinstance(symbols_data, list):
                logger.warning(f"MEXC SymbolsV2 API returned non-list data for symbols: {symbols_data}")
                return []

            valid_symbols = []
            for item_data in symbols_data:
                try:
                    valid_symbols.append(SymbolV2EntryApi(**item_data))
                except Exception as e:
                    # This can be noisy if many symbols don't match the model perfectly
                    # logger.debug(f"Failed to parse symbol entry {item_data.get('s')}: {e}") 
                    pass # Or handle more gracefully if some fields are optional
            return valid_symbols
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error fetching symbolsV2: {e.response.status_code} - {e.response.text}")
        except Exception as e:
            logger.error(f"Error fetching symbolsV2: {e}")
        return []

    def _generate_signature(self, params: Dict[str, Any]) -> str:
        query_string = urlencode(sorted(params.items()))
        return hmac.new(
            self.config.MEXC_API_SECRET.encode('utf-8'),
            query_string.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

    async def place_market_buy_order(
        self, 
        symbol_contract: str, 
        quote_order_qty: float
    ) -> Dict[str, Any]:
        timestamp = int(time.time() * 1000)
        params = {
            "symbol": symbol_contract,
            "side": "BUY",
            "type": "MARKET",
            "quoteOrderQty": f"{quote_order_qty:.8f}", # Format to string with sufficient precision
            "timestamp": timestamp,
        }
        params["signature"] = self._generate_signature(params)
        
        headers = {
            "X-MEXC-APIKEY": self.config.MEXC_API_KEY,
            "Content-Type": "application/json" 
        }
        request_url = f"{self.base_url}{self.config.MEXC_ORDER_ENDPOINT}?{urlencode(params)}"
        
        try:
            logger.info(f"Placing MARKET BUY order for {symbol_contract}, qty {quote_order_qty} USDT. URL: {request_url.split('?')[0]} Params: {params}")
            # For MEXC, even for POST, signed params go into query string. Body is empty.
            response = await self.http_client.post(request_url, headers=headers)
            response.raise_for_status()
            order_result = response.json()
            logger.info(f"Order placed for {symbol_contract}: {order_result}")
            return order_result
        except httpx.HTTPStatusError as e:
            error_content = e.response.text
            try:
                error_json = e.response.json()
                error_content = error_json
            except: pass
            logger.error(f"HTTP error placing order for {symbol_contract}: {e.response.status_code} - {error_content}")
            raise # Re-raise to be caught by Inngest function for retry/logging
        except Exception as e:
            logger.error(f"General error placing order for {symbol_contract}: {e}")
            raise

# Example usage (dependency injection pattern)
# async def some_function(mexc_client: MexcApiClient = Depends(get_mexc_client)):
#    await mexc_client.get_calendar_listings()
```

---

**7. `src/services/cache_service.py`** (Optional Valkey/Redis)

```python
import redis.asyncio as redis
import json
from typing import Optional, Any
import logging

from ..config import AppConfig

logger = logging.getLogger(__name__)

class CacheService:
    def __init__(self, config: AppConfig):
        self.config = config
        self.redis_client: Optional[redis.Redis] = None
        if config.VALKEY_URL:
            try:
                self.redis_client = redis.from_url(config.VALKEY_URL, decode_responses=True)
                logger.info("Valkey/Redis client initialized.")
            except Exception as e:
                logger.error(f"Failed to initialize Valkey/Redis client: {e}")
                self.redis_client = None
        else:
            logger.info("Valkey/Redis URL not configured. Cache service disabled.")


    async def connect(self):
        if self.redis_client:
            try:
                await self.redis_client.ping()
                logger.info("Successfully connected to Valkey/Redis.")
            except Exception as e:
                logger.error(f"Could not connect to Valkey/Redis: {e}")
                self.redis_client = None # Disable if connection fails

    async def close(self):
        if self.redis_client:
            await self.redis_client.close()
            logger.info("Valkey/Redis client closed.")

    async def get(self, key: str) -> Optional[Any]:
        if not self.redis_client:
            return None
        try:
            cached_data = await self.redis_client.get(key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logger.error(f"Error getting from cache key {key}: {e}")
        return None

    async def set(self, key: str, value: Any, ttl_seconds: int = 60):
        if not self.redis_client:
            return
        try:
            await self.redis_client.set(key, json.dumps(value), ex=ttl_seconds)
        except Exception as e:
            logger.error(f"Error setting cache for key {key}: {e}")

# Global instance or injected
# cache_service = CacheService(settings)
```

---

**8. `src/inngest_client.py`**

```python
import inngest
import inngest.fast_api

from .config import settings

# Initialize Inngest client
inngest_client = inngest.Inngest(
    app_id="mexc-sniper-agent", # Or your Vercel project name slugified
    event_key=settings.INNGEST_EVENT_KEY,     # For sending events from Inngest Cloud
    signing_key=settings.INNGEST_SIGNING_KEY, # For serving functions locally / self-hosted
    # base_url=settings.INNGEST_BASE_URL, # If self-hosting Inngest dev server/engine
    # api_base_url=settings.INNGEST_API_BASE_URL # If self-hosting Inngest API
    is_production=settings.ENVIRONMENT == "production",
)
```

---

**9. `src/inngest_app.py`** (Defines Inngest functions and serves them)

This file will contain the core logic of your sniper bot, orchestrated by Inngest.

```python
import asyncio
import logging
from datetime import datetime, timezone, timedelta

import inngest

from .config import settings # Use the global settings instance
from .inngest_client import inngest_client
from .models import (
    MonitoredListing, SnipeTargetDb, SymbolV2EntryApi, CalendarEntryApi
)
from .db import get_async_session, get_listing_by_vcoin_id, create_listing, get_snipe_target_by_id
from .services.mexc_api import MexcApiClient
# from .services.cache_service import CacheService # If using cache

logger = logging.getLogger(__name__)
logging.basicConfig(level=settings.LOG_LEVEL.upper())

# Initialize services (could also be done via FastAPI dependency injection if serving via FastAPI)
mexc_api_client = MexcApiClient(settings)
# cache = CacheService(settings) # Initialize if used

# --- Inngest Event Definitions (for clarity, not strictly required by SDK) ---
class MexcNewListingDiscovered(inngest.Event):
    name = "mexc.new_listing_discovered" # data: {"vcoin_id": str}

class MexcSymbolRecheckNeeded(inngest.Event):
    name = "mexc.symbol_recheck_needed" # data: {"vcoin_id": str, "attempt": int}

class MexcTargetReady(inngest.Event):
    name = "mexc.target_ready" # data: {"target_id": int, "launch_time_utc_iso": str}

class MexcScheduleSnipe(inngest.Event): # This might be an internal step rather than a separate event
    name = "mexc.schedule_snipe" # data: {"target_id": int, "launch_datetime_utc": str}

class MexcExecuteSnipe(inngest.Event):
    name = "mexc.execute_snipe" # data: {"target_id": int}


# --- Inngest Functions ---

@inngest_client.create_function(
    fn_id="poll-mexc-calendar",
    trigger=inngest.TriggerCron(cron=settings.CALENDAR_POLL_CRON),
)
async def poll_mexc_calendar(ctx: inngest.Context, step: inngest.Step) -> str:
    logger.info("Polling MEXC calendar for new listings...")
    
    calendar_api_entries = await step.run("fetch-calendar-data", mexc_api_client.get_calendar_listings)
    
    if calendar_api_entries is None: # Should not happen if get_calendar_listings returns [] on error
        calendar_api_entries = []

    new_listings_count = 0
    events_to_send = []

    async with get_async_session() as session:
        for entry_api in calendar_api_entries:
            if entry_api.launch_datetime <= datetime.now(timezone.utc):
                continue # Skip past or current listings

            existing_listing = await step.run(
                f"check-existing-{entry_api.vcoinId}",
                lambda: get_listing_by_vcoin_id(session, entry_api.vcoinId)
            )

            if not existing_listing:
                logger.info(f"New listing found: {entry_api.symbol} ({entry_api.vcoinId}), launching at {entry_api.launch_datetime}")
                new_db_listing = MonitoredListing(
                    vcoin_id=entry_api.vcoinId,
                    symbol_name=entry_api.symbol,
                    project_name=entry_api.projectName,
                    announced_launch_time_ms=entry_api.firstOpenTime,
                    announced_launch_datetime_utc=entry_api.launch_datetime,
                    status="monitoring"
                )
                await step.run(
                    f"create-db-listing-{entry_api.vcoinId}",
                    lambda: create_listing(session, new_db_listing)
                )
                new_listings_count += 1
                events_to_send.append(MexcNewListingDiscovered(data={"vcoin_id": entry_api.vcoinId}))
    
    if events_to_send:
        await step.send_event("dispatch-new-listing-events", events_to_send)
        
    summary = f"Calendar poll complete. Found {new_listings_count} new listings."
    logger.info(summary)
    return summary


@inngest_client.create_function(
    fn_id="watch-mexc-symbol",
    trigger=inngest.TriggerEvent(event=[MexcNewListingDiscovered.name, MexcSymbolRecheckNeeded.name]),
)
async def watch_mexc_symbol(ctx: inngest.Context, step: inngest.Step) -> dict:
    vcoin_id = ctx.event.data.get("vcoin_id")
    attempt = ctx.event.data.get("attempt", 1)
    logger.info(f"Watching symbol for vcoin_id: {vcoin_id}, attempt: {attempt}")

    async with get_async_session() as session:
        listing_in_db = await step.run("get-listing", lambda: get_listing_by_vcoin_id(session, vcoin_id))
        if not listing_in_db:
            logger.warning(f"Listing {vcoin_id} not found in DB. Skipping watch.")
            return {"status": "error", "message": "Listing not found"}
        
        if listing_in_db.status not in ["monitoring", "rechecking"]: # terminal states
             logger.info(f"Listing {vcoin_id} status is '{listing_in_db.status}'. Skipping watch.")
             return {"status": "skipped", "reason": f"Terminal status: {listing_in_db.status}"}


        # Fetch all symbols (potential for caching here)
        # TODO: Use cache_service if implemented
        all_symbols_api = await step.run("fetch-symbols-v2", mexc_api_client.get_symbols_v2)
        if all_symbols_api is None: all_symbols_api = []

        symbol_data_api: Optional[SymbolV2EntryApi] = None
        for s in all_symbols_api:
            if s.cd == vcoin_id:
                symbol_data_api = s
                break
        
        if not symbol_data_api:
            logger.warning(f"vcoin_id {vcoin_id} not found in symbolsV2 response.")
            # Decide on retry strategy, maybe it appears later
            if attempt < 10: # Max 10 attempts for symbol not found
                 await step.send_event("reschedule-symbol-not-found", MexcSymbolRecheckNeeded(
                    data={"vcoin_id": vcoin_id, "attempt": attempt + 1},
                    delay=timedelta(seconds=settings.SYMBOLS_POLL_INTERVAL_SECONDS_DEFAULT * attempt) # Exponential backoff
                ))
            return {"status": "pending_retry", "reason": "Symbol not found in API yet"}

        if symbol_data_api.matches_ready_pattern(settings.READY_STATE_PATTERN) and symbol_data_api.has_complete_data:
            logger.info(f"✅ READY STATE DETECTED for {symbol_data_api.ca} (vcoin_id: {vcoin_id})!")
            
            # Ensure ot (open time) is valid
            if not symbol_data_api.ot or not symbol_data_api.launch_datetime_from_ot:
                 logger.error(f"Critical error: Ready pattern matched for {vcoin_id} but 'ot' is missing or invalid.")
                 listing_in_db.status = "error_missing_ot"
                 await step.run("update-listing-status-error-ot", lambda: session.commit()) # Commit status change
                 return {"status": "error", "message": "Missing 'ot' in ready symbol"}

            # Create SnipeTargetDb
            actual_launch_dt = symbol_data_api.launch_datetime_from_ot
            time_advance_seconds = (actual_launch_dt - datetime.now(timezone.utc)).total_seconds()

            snipe_target_db = SnipeTargetDb(
                vcoin_id=vcoin_id,
                mexc_symbol_contract=symbol_data_api.ca,
                price_precision=symbol_data_api.ps,
                quantity_precision=symbol_data_api.qs,
                actual_launch_time_ms=symbol_data_api.ot,
                actual_launch_datetime_utc=actual_launch_dt,
                discovered_at_utc=datetime.now(timezone.utc),
                hours_advance_notice=time_advance_seconds / 3600,
                intended_buy_amount_usdt=settings.BUY_AMOUNT_USDT, # Or from listing if configurable per token
                execution_order_params_json={ # Params needed for execution
                    "symbol": symbol_data_api.ca,
                    "quoteOrderQty": settings.BUY_AMOUNT_USDT # Store the value at this point
                },
                execution_status="pending_schedule"
            )
            session.add(snipe_target_db)
            listing_in_db.status = "ready" 
            await step.run("save-snipe-target", lambda: session.commit()) # Commit changes

            await step.send_event("dispatch-target-ready", MexcTargetReady(
                data={
                    "target_id": snipe_target_db.id, # SQLModel populates ID after add+flush/commit
                    "launch_time_utc_iso": actual_launch_dt.isoformat()
                }
            ))
            return {"status": "ready", "target_id": snipe_target_db.id}
        else:
            logger.info(f"Symbol {vcoin_id} not yet in ready state. Current: sts={symbol_data_api.sts}, st={symbol_data_api.st}, tt={symbol_data_api.tt}")
            listing_in_db.status = "rechecking"
            await step.run("update-listing-status-rechecking", lambda: session.commit())

            # Reschedule check
            delay_seconds = settings.SYMBOLS_POLL_INTERVAL_SECONDS_DEFAULT
            # Check if announced launch time is close
            time_to_announced_launch = (listing_in_db.announced_launch_datetime_utc - datetime.now(timezone.utc)).total_seconds()
            if time_to_announced_launch < settings.SYMBOLS_POLL_NEAR_LAUNCH_THRESHOLD_MINUTES * 60:
                delay_seconds = settings.SYMBOLS_POLL_INTERVAL_SECONDS_NEAR_LAUNCH
            
            # Prevent infinite recheck if launch time passed
            if listing_in_db.announced_launch_datetime_utc < datetime.now(timezone.utc) + timedelta(minutes=5): # Give 5 min grace
                 logger.warning(f"Announced launch time for {vcoin_id} has passed or is too close. Stopping rechecks.")
                 listing_in_db.status = "missed_pre_launch"
                 await step.run("update-listing-status-missed", lambda: session.commit())
                 return {"status": "missed", "reason": "Launch time passed"}

            await step.send_event("reschedule-watch", MexcSymbolRecheckNeeded(
                data={"vcoin_id": vcoin_id, "attempt": attempt + 1},
                delay=timedelta(seconds=delay_seconds)
            ))
            return {"status": "pending_recheck"}


@inngest_client.create_function(
    fn_id="schedule-snipe-execution", # This function handles the actual scheduling using Inngest's capabilities
    trigger=inngest.TriggerEvent(event=MexcTargetReady.name),
)
async def schedule_snipe_execution(ctx: inngest.Context, step: inngest.Step) -> dict:
    target_id = ctx.event.data.get("target_id")
    launch_time_iso = ctx.event.data.get("launch_time_utc_iso")
    
    if not target_id or not launch_time_iso:
        logger.error("Missing target_id or launch_time_iso in schedule-snipe-execution event.")
        return {"status": "error", "message": "Invalid event data"}

    launch_datetime = datetime.fromisoformat(launch_time_iso)
    
    # Schedule the execute_snipe function to run AT the launch_datetime
    # Inngest `delay_until` is what we need here for the send_event
    # The event `MexcExecuteSnipe` will be picked up by the `execute_mexc_snipe` function.
    
    time_until_launch = launch_datetime - datetime.now(timezone.utc)
    
    # Safety: do not schedule if launch time is in the past or too soon for Inngest to reliably process
    if time_until_launch.total_seconds() < 10: # Minimum 10 seconds lead time for scheduling
        logger.warning(f"Launch time for target {target_id} is too soon or in the past. Skipping execution scheduling.")
        # Update DB status
        async with get_async_session() as session:
            target_db = await step.run("get-target-db", lambda: get_snipe_target_by_id(session, target_id))
            if target_db:
                target_db.execution_status = "error_schedule_too_late"
                await step.run("update-target-status", lambda: session.commit())
        return {"status": "error", "message": "Launch time too soon to schedule"}

    logger.info(f"Scheduling snipe execution for target ID: {target_id} at {launch_datetime.isoformat()}")
    
    await step.send_event(
        "dispatch-execute-event",
        MexcExecuteSnipe(data={"target_id": target_id}),
        delay_until=launch_datetime # Key Inngest feature for precise scheduling
    )

    # Update DB status to "scheduled"
    async with get_async_session() as session:
        target_db = await step.run("get-target-db-for-status-update", lambda: get_snipe_target_by_id(session, target_id))
        if target_db:
            target_db.execution_status = "scheduled"
            await step.run("update-target-status-scheduled", lambda: session.commit())
            
    return {"status": "scheduled", "target_id": target_id, "execute_at": launch_datetime.isoformat()}


@inngest_client.create_function(
    fn_id="execute-mexc-snipe",
    trigger=inngest.TriggerEvent(event=MexcExecuteSnipe.name),
    # Configure retries carefully for execution. Maybe only retry on specific network errors.
    # concurrency=inngest.Concurrency(limit=5) # Limit concurrent executions if needed
)
async def execute_mexc_snipe(ctx: inngest.Context, step: inngest.Step) -> dict:
    target_id = ctx.event.data.get("target_id")
    logger.info(f"🚀 EXECUTING SNIPE for target ID: {target_id} at {datetime.now(timezone.utc).isoformat()}")

    async with get_async_session() as session:
        snipe_target_db = await step.run("get-snipe-target", lambda: get_snipe_target_by_id(session, target_id))

        if not snipe_target_db:
            logger.error(f"Snipe target {target_id} not found in DB for execution.")
            return {"status": "error", "message": "Target not found"}
        
        if snipe_target_db.execution_status not in ["scheduled", "pending_schedule"]: # Avoid re-executing
            logger.warning(f"Snipe target {target_id} already processed or in invalid state: {snipe_target_db.execution_status}")
            return {"status": "skipped", "reason": f"Already processed or invalid state {snipe_target_db.execution_status}"}

        # Extract order parameters from the DB record
        order_params = snipe_target_db.execution_order_params_json
        symbol_contract = order_params.get("symbol")
        quote_order_qty = float(order_params.get("quoteOrderQty", settings.BUY_AMOUNT_USDT))

        if not symbol_contract:
            snipe_target_db.execution_status = "error_missing_params"
            snipe_target_db.execution_response_json = {"error": "Missing symbol in order params"}
            await step.run("save-error-state", lambda: session.commit())
            return {"status": "error", "message": "Missing symbol in order params"}

        try:
            start_time_ns = time.perf_counter_ns()
            # Perform the actual API call to place the order
            # The MexcApiClient should handle HTTPX client lifecycle correctly.
            # For serverless, it might be instantiated per call or managed if the function instance persists.
            order_result = await step.run(
                "place-mexc-order",
                lambda: mexc_api_client.place_market_buy_order(
                    symbol_contract=symbol_contract,
                    quote_order_qty=quote_order_qty
                )
            )
            end_time_ns = time.perf_counter_ns()
            execution_duration_ms = (end_time_ns - start_time_ns) / 1_000_000

            logger.info(f"✅ SNIPE COMPLETE for {symbol_contract}. Result: {order_result}. Duration: {execution_duration_ms:.2f} ms")
            snipe_target_db.execution_status = "executed_success"
            snipe_target_db.execution_response_json = order_result
            snipe_target_db.executed_at_utc = datetime.now(timezone.utc)
        
        except Exception as e:
            logger.error(f"❌ Snipe failed for {symbol_contract} (Target ID: {target_id}): {e}")
            snipe_target_db.execution_status = "executed_failed"
            # Store a serializable error message
            error_info = {"error_type": type(e).__name__, "error_message": str(e)}
            # If e is an httpx.HTTPStatusError, include response details
            if isinstance(e, httpx.HTTPStatusError) and e.response:
                try:
                    error_info["response_body"] = e.response.json()
                except:
                    error_info["response_body"] = e.response.text
                error_info["response_status"] = e.response.status_code
            
            snipe_target_db.execution_response_json = error_info
            snipe_target_db.executed_at_utc = datetime.now(timezone.utc)
            # Do not re-raise here if Inngest default retries are not desired for failed orders.
            # Let the status update be the terminal state.
            # If retries ARE desired for specific failures (e.g. network), re-raise those specific exceptions.

        await step.run("save-final-state", lambda: session.commit())
        return {"status": snipe_target_db.execution_status, "target_id": target_id, "response": snipe_target_db.execution_response_json}

# List of all Inngest functions to be served
inngest_functions = [
    poll_mexc_calendar,
    watch_mexc_symbol,
    schedule_snipe_execution,
    execute_mexc_snipe,
]

# To run locally for development (using Inngest Dev Server):
# inngest serve --framework fastapi src.inngest_app.inngest_client src.inngest_app.inngest_functions

# For Vercel deployment, you'll typically create an API route that uses inngest.fast_api.serve
# Example: pages/api/inngest.py (or equivalent in app router)
# from src.inngest_client import inngest_client
# from src.inngest_app import inngest_functions # Ensure functions are loaded
# handler = inngest.fast_api.serve(inngest_client, inngest_functions)
```

---

**10. `src/main.py`** (FastAPI Application for Admin/Status Endpoints)

```python
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .db import init_db, get_async_session
from .models import MonitoredListing, SnipeTargetDb, MonitoredListingResponse, SnipeTargetDetailResponse
from .inngest_client import inngest_client # To send events manually if needed
from .inngest_app import inngest_functions # To register with Inngest serve if combined
from .services.mexc_api import MexcApiClient
# from .services.cache_service import CacheService

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting application lifespan...")
    await init_db() # Create DB tables if they don't exist
    # if settings.VALKEY_URL: # If using cache
    #     await cache.connect()
    logger.info("Application startup complete.")
    yield
    logger.info("Shutting down application lifespan...")
    # if settings.VALKEY_URL: # If using cache
    #     await cache.close()
    logger.info("Application shutdown complete.")

app = FastAPI(title="MEXC Sniper Agent API", lifespan=lifespan)

# --- Dependency for MexcApiClient ---
def get_mexc_api_client(): # Simple factory
    return MexcApiClient(config=settings)


# --- API Endpoints ---
@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "ok"}

@app.post("/api/admin/trigger-calendar-poll", status_code=202, tags=["Admin"])
async def trigger_calendar_poll_endpoint():
    """Manually triggers the MEXC calendar polling Inngest function."""
    logger.info("Manually triggering calendar poll via API.")
    try:
        await inngest_client.send(inngest.Event(name="admin.calendar.poll.requested", data={}))
        # Note: The above event needs an Inngest function to listen to it and then
        # potentially invoke `poll_mexc_calendar` or send its trigger event.
        # A more direct way if `poll_mexc_calendar` itself could be invoked (less common for cron):
        # Or, you could send an event that `poll_mexc_calendar` is also triggered by, if designed so.
        # For simplicity, this endpoint signals intent; actual Inngest setup determines direct invocation.
        # A common pattern is for an admin event to trigger a "one-off" run of a scheduled job.
        # Simplest might be to have `poll_mexc_calendar` also listen to this admin event.
        # For now, let's assume you will add `admin.calendar.poll.requested` to its triggers or handle it.
        # OR, if Inngest client allows invoking a function by ID (check SDK):
        # await inngest_client.invoke(fn_id="poll-mexc-calendar", data={}) # Hypothetical SDK feature
        return {"message": "Calendar poll trigger signal sent to Inngest. Check Inngest dashboard."}
    except Exception as e:
        logger.error(f"Failed to send trigger event to Inngest: {e}")
        raise HTTPException(status_code=500, detail=f"Inngest communication error: {str(e)}")


@app.get("/api/listings", response_model=List[MonitoredListingResponse], tags=["Listings"])
async def get_all_listings(
    session: AsyncSession = Depends(get_async_session),
    skip: int = 0,
    limit: int = 100
):
    statement = select(MonitoredListing).offset(skip).limit(limit).order_by(MonitoredListing.created_at.desc())
    results = await session.execute(statement)
    db_listings = results.scalars().all()
    return [MonitoredListingResponse.from_orm(l) for l in db_listings]


@app.get("/api/targets", response_model=List[SnipeTargetDetailResponse], tags=["Targets"]) # Assuming a suitable response model
async def get_all_targets(
    session: AsyncSession = Depends(get_async_session),
    skip: int = 0,
    limit: int = 100
):
    statement = (
        select(SnipeTargetDb)
        .offset(skip)
        .limit(limit)
        .order_by(SnipeTargetDb.created_at.desc())
        # .options(selectinload(SnipeTargetDb.listing)) # Eager load related listing if needed by response model
    )
    results = await session.execute(statement)
    db_targets = results.scalars().all()
    
    # Manual construction if SnipeTargetDetailResponse needs data from related MonitoredListing
    response_targets = []
    for t in db_targets:
        # Ensure listing is loaded or fetch it separately if not eager loaded
        # For simplicity, direct attribute access shown; production might need to ensure listing is present
        listing_data = await get_listing_by_vcoin_id(session, t.vcoin_id) # Efficient if not many, else eager load
        
        # Construct the SnipeTargetApi part
        api_part = SnipeTargetApi(
            vcoin_id=t.vcoin_id,
            symbol_contract=t.mexc_symbol_contract,
            project_name=listing_data.project_name if listing_data else "N/A", # Handle missing listing
            price_precision=t.price_precision,
            quantity_precision=t.quantity_precision,
            launch_time=t.actual_launch_datetime_utc,
            discovered_at=t.discovered_at_utc,
            hours_advance_notice=t.hours_advance_notice,
            order_params=t.execution_order_params_json,
        )
        response_targets.append(SnipeTargetDetailResponse(
            **api_part.model_dump(),
            id=t.id,
            listing=MonitoredListingResponse.from_orm(listing_data) if listing_data else None,
            execution_status=t.execution_status,
            executed_at_utc=t.executed_at_utc,
            execution_response_json=t.execution_response_json
        ))
    return response_targets


@app.get("/api/target/{target_id}", response_model=Optional[SnipeTargetDetailResponse], tags=["Targets"])
async def get_target_by_id_endpoint(target_id: int, session: AsyncSession = Depends(get_async_session)):
    db_target = await get_snipe_target_by_id(session, target_id)
    if not db_target:
        raise HTTPException(status_code=404, detail="Snipe target not found")
    
    listing_data = await get_listing_by_vcoin_id(session, db_target.vcoin_id)
    api_part = SnipeTargetApi(
        vcoin_id=db_target.vcoin_id,
        symbol_contract=db_target.mexc_symbol_contract,
        project_name=listing_data.project_name if listing_data else "N/A",
        price_precision=db_target.price_precision,
        quantity_precision=db_target.quantity_precision,
        launch_time=db_target.actual_launch_datetime_utc,
        discovered_at=db_target.discovered_at_utc,
        hours_advance_notice=db_target.hours_advance_notice,
        order_params=db_target.execution_order_params_json,
    )
    return SnipeTargetDetailResponse(
        **api_part.model_dump(),
        id=db_target.id,
        listing=MonitoredListingResponse.from_orm(listing_data) if listing_data else None,
        execution_status=db_target.execution_status,
        executed_at_utc=db_target.executed_at_utc,
        execution_response_json=db_target.execution_response_json
    )

# --- Inngest Serve Route (for Vercel or other ASGI servers) ---
# This allows Inngest to communicate with your functions when deployed.
# In Vercel, you typically have a file like `api/inngest.py` (pages router)
# or `app/api/inngest/route.py` (app router) that does this.
# If `main.py` is your single entry point for Vercel:
from inngest.fast_api import serve_inngest

serve_inngest(
    app, # Your FastAPI app
    inngest_client,
    inngest_functions, # Pass the list of defined Inngest functions
    # serve_host="0.0.0.0", # Not needed for Vercel deployment
    # serve_port=8288, # Not needed for Vercel deployment
    # signing_key=settings.INNGEST_SIGNING_KEY # Already configured in client usually
)

# To run locally for FastAPI dev (without Inngest Dev Server for functions):
# uvicorn src.main:app --reload
# To run WITH Inngest Dev Server (for testing Inngest functions):
# 1. Start Inngest Dev Server: npx inngest-cli dev -u http://localhost:8000/api/inngest (or your FastAPI port)
# 2. Start FastAPI: uvicorn src.main:app --reload --port 8000
# OR use `inngest serve` as shown in inngest_app.py comments for a more integrated flow.
```

---

**To Make This Runnable (Locally for Dev):**

1.  **Save all files** in the structure outlined.
2.  **Create and activate a virtual environment.**
    ```bash
    python -m venv venv
    source venv/bin/activate # or venv\Scripts\activate on Windows
    ```
3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
4.  **Set up your `.env` file** with actual credentials.
5.  **Set up NeonDB:** Get your connection string. Tables will be created by `init_db()`.
6.  **Set up Inngest:**
    * **Option A (Inngest Cloud):** Sign up, create a project, get your Event Key and Signing Key.
    * **Option B (Inngest Dev Server - Recommended for local):**
        ```bash
        npx inngest-cli dev -u http://localhost:8000/api/inngest
        ```
        (Assuming your FastAPI runs on port 8000 and the Inngest handler is at `/api/inngest` as configured by `serve_inngest` in `main.py`).
7.  **Run FastAPI:**
    ```bash
    uvicorn src.main:app --reload --port 8000
    ```
    Your FastAPI app will be available at `http://localhost:8000`. The Inngest functions will be served at `http://localhost:8000/api/inngest` (or whatever path `serve_inngest` uses).

**Important Next Steps:**

* **Vercel Deployment:** Adapt the `main.py` and the Inngest serving part to Vercel's file structure (e.g., `api/inngest.py` for the Inngest handler). The `serverless-agents` repo will be your guide here.
* **Refine Pydantic/SQLModels:** Ensure all fields, relationships, and response models are correctly defined for your needs.
* **Cache Implementation:** Fully implement the Valkey caching in `MexcApiClient` and `CacheService` if you choose to use it.
* **Logging:** Configure more robust structured logging (e.g., using `structlog`).
* **Security:** Double-check all security aspects, especially around API key handling and endpoint protection.
* **Testing, Testing, Testing!**

This provides a substantial backend foundation. Building the complete, production-grade system will require further effort in integration, testing, and frontend development.