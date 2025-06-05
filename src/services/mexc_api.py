"""
Enhanced MEXC API client with authentication and comprehensive error handling
"""
import asyncio
import hashlib
import hmac
import logging
import time
from typing import Any, Optional
from urllib.parse import urlencode

import aiohttp

from src.config import settings
from src.models import CalendarEntryApi, SymbolV2EntryApi

from .cache_service import CacheService

logger = logging.getLogger(__name__)


class MexcApiError(Exception):
    """Custom exception for MEXC API errors"""
    def __init__(self, message: str, status_code: Optional[int] = None, response_data: Optional[dict] = None):
        self.message = message
        self.status_code = status_code
        self.response_data = response_data
        super().__init__(message)


class MexcApiClient:
    """Enhanced MEXC API client with authentication, error handling, and caching"""

    def __init__(self, cache_service: Optional[CacheService] = None):
        self.base_url = settings.MEXC_BASE_URL
        self.api_key = settings.MEXC_API_KEY
        self.secret_key = settings.MEXC_SECRET_KEY
        self.session: Optional[aiohttp.ClientSession] = None
        self.cache_service = cache_service

        # Rate limiting
        self.last_request_time = 0
        self.min_request_interval = 0.1  # 100ms between requests

        # Request timeout
        self.timeout = aiohttp.ClientTimeout(total=10.0)

        # Cache configuration
        self.cache_enabled = cache_service is not None
        self.cache_ttl = {
            "symbols": settings.CACHE_TTL_SYMBOLS,
            "calendar": settings.CACHE_TTL_CALENDAR,
            "account": settings.CACHE_TTL_ACCOUNT
        }

    async def __aenter__(self):
        """Async context manager entry"""
        await self.start_session()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close_session()

    async def start_session(self):
        """Start HTTP session"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(timeout=self.timeout)

    async def close_session(self):
        """Close HTTP session"""
        if self.session and not self.session.closed:
            await self.session.close()

    def _generate_signature(self, params: dict[str, Any]) -> str:
        """Generate MEXC API signature"""
        if not self.secret_key:
            raise MexcApiError("MEXC secret key not configured")

        query_string = urlencode(sorted(params.items()))
        return hmac.new(
            self.secret_key.encode('utf-8'),
            query_string.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()

    def _get_headers(self, include_api_key: bool = False) -> dict[str, str]:
        """Get request headers"""
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "MEXC-Sniper-Bot/1.0"
        }

        if include_api_key and self.api_key:
            headers["X-MEXC-APIKEY"] = self.api_key

        return headers

    async def _rate_limit(self):
        """Implement rate limiting"""
        current_time = time.time()
        time_since_last_request = current_time - self.last_request_time

        if time_since_last_request < self.min_request_interval:
            sleep_time = self.min_request_interval - time_since_last_request
            await asyncio.sleep(sleep_time)

        self.last_request_time = time.time()

    async def _get_from_cache(self, cache_key: str) -> Optional[Any]:
        """Get data from cache if available"""
        if not self.cache_enabled or not self.cache_service:
            return None

        try:
            return await self.cache_service.get(cache_key)
        except Exception as e:
            logger.debug(f"Cache get error for key {cache_key}: {e}")
            return None

    async def _set_cache(self, cache_key: str, data: Any, cache_type: str = "default") -> bool:
        """Set data in cache if available"""
        if not self.cache_enabled or not self.cache_service:
            return False

        try:
            ttl = self.cache_ttl.get(cache_type, 5)
            return await self.cache_service.set(cache_key, data, ttl=ttl, cache_type=cache_type)
        except Exception as e:
            logger.debug(f"Cache set error for key {cache_key}: {e}")
            return False

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[dict[str, Any]] = None,
        data: Optional[dict[str, Any]] = None,
        authenticated: bool = False,
        retries: int = 3
    ) -> dict[str, Any]:
        """Make HTTP request with error handling and retries"""
        if self.session is None:
            await self.start_session()

        url = f"{self.base_url}{endpoint}"
        headers = self._get_headers(include_api_key=authenticated)

        # Add signature for authenticated requests
        if authenticated:
            if params is None:
                params = {}
            params["timestamp"] = int(time.time() * 1000)
            params["signature"] = self._generate_signature(params)

        for attempt in range(retries + 1):
            try:
                await self._rate_limit()

                async with self.session.request(
                    method=method,
                    url=url,
                    params=params,
                    json=data,
                    headers=headers
                ) as response:
                    response_data = await response.json()

                    if response.status == 200:
                        return response_data
                    else:
                        error_msg = f"MEXC API error: {response.status}"
                        if isinstance(response_data, dict):
                            error_msg += f" - {response_data.get('msg', 'Unknown error')}"

                        raise MexcApiError(
                            message=error_msg,
                            status_code=response.status,
                            response_data=response_data
                        )

            except aiohttp.ClientError as e:
                if attempt == retries:
                    raise MexcApiError(f"Network error after {retries + 1} attempts: {e!s}")

                # Exponential backoff
                wait_time = (2 ** attempt) * 0.5
                logger.warning(f"Request failed (attempt {attempt + 1}), retrying in {wait_time}s: {e!s}")
                await asyncio.sleep(wait_time)

            except Exception as e:
                if attempt == retries:
                    raise MexcApiError(f"Unexpected error: {e!s}")

                wait_time = (2 ** attempt) * 0.5
                logger.warning(f"Unexpected error (attempt {attempt + 1}), retrying in {wait_time}s: {e!s}")
                await asyncio.sleep(wait_time)

        raise MexcApiError("Max retries exceeded")

    async def get_calendar_listings(self) -> list[CalendarEntryApi]:
        """Fetch upcoming token listings from MEXC calendar with caching"""
        cache_key = "calendar"

        # Try cache first
        cached_data = await self._get_from_cache(cache_key)
        if cached_data is not None:
            try:
                # Reconstruct CalendarEntryApi objects from cached data
                valid_entries = []
                for item_data in cached_data:
                    try:
                        entry = CalendarEntryApi(**item_data)
                        valid_entries.append(entry)
                    except Exception as e:
                        logger.debug(f"Failed to parse cached calendar entry: {e}")

                logger.debug(f"Retrieved {len(valid_entries)} calendar entries from cache")
                return valid_entries
            except Exception as e:
                logger.warning(f"Failed to process cached calendar data: {e}")
                # Continue to fetch from API

        try:
            response_data = await self._make_request("GET", settings.MEXC_CALENDAR_ENDPOINT)

            listings_data = response_data.get("data", [])
            if not isinstance(listings_data, list):
                logger.warning(f"Unexpected calendar data format: {type(listings_data)}")
                return []

            valid_entries = []
            cache_data = []

            for item_data in listings_data:
                try:
                    entry = CalendarEntryApi(**item_data)
                    valid_entries.append(entry)
                    # Store raw data for caching (serializable)
                    cache_data.append(item_data)
                except Exception as e:
                    logger.debug(f"Failed to parse calendar entry {item_data}: {e}")

            # Cache the raw data
            if cache_data:
                await self._set_cache(cache_key, cache_data, "calendar")

            logger.info(f"Retrieved {len(valid_entries)} valid calendar entries from API")
            return valid_entries

        except MexcApiError:
            raise
        except Exception as e:
            raise MexcApiError(f"Error fetching calendar listings: {e!s}")

    async def get_symbols_v2(self, vcoin_id: Optional[str] = None) -> list[SymbolV2EntryApi]:
        """Fetch symbol data from MEXC symbolsV2 API with caching"""
        # Create cache key - include vcoin_id filter if specified
        cache_key = f"symbolsV2:{vcoin_id}" if vcoin_id else "symbolsV2"

        # Try cache first
        cached_data = await self._get_from_cache(cache_key)
        if cached_data is not None:
            try:
                # Reconstruct SymbolV2EntryApi objects from cached data
                valid_symbols = []
                for item_data in cached_data:
                    try:
                        symbol = SymbolV2EntryApi(**item_data)
                        valid_symbols.append(symbol)
                    except Exception as e:
                        logger.debug(f"Failed to parse cached symbol entry: {e}")

                logger.debug(f"Retrieved {len(valid_symbols)} symbols from cache")
                return valid_symbols
            except Exception as e:
                logger.warning(f"Failed to process cached symbols data: {e}")
                # Continue to fetch from API

        try:
            response_data = await self._make_request("GET", settings.MEXC_SYMBOLS_V2_ENDPOINT)

            symbols_data = response_data.get("data", {}).get("symbols", [])
            if not isinstance(symbols_data, list):
                logger.warning(f"Unexpected symbols data format: {type(symbols_data)}")
                return []

            valid_symbols = []
            cache_data = []

            for item_data in symbols_data:
                try:
                    symbol = SymbolV2EntryApi(**item_data)

                    # Filter by vcoin_id if specified
                    if vcoin_id is None or symbol.cd == vcoin_id:
                        valid_symbols.append(symbol)
                        # Store raw data for caching (serializable)
                        cache_data.append(item_data)

                except Exception as e:
                    logger.debug(f"Failed to parse symbol entry: {e}")

            # Cache the filtered data
            if cache_data:
                await self._set_cache(cache_key, cache_data, "symbols")

            if vcoin_id:
                logger.info(f"Retrieved {len(valid_symbols)} symbols for vcoin_id {vcoin_id} from API")
            else:
                logger.info(f"Retrieved {len(valid_symbols)} valid symbols from API")

            return valid_symbols

        except MexcApiError:
            raise
        except Exception as e:
            raise MexcApiError(f"Error fetching symbols data: {e!s}")

    async def place_market_buy_order(
        self,
        symbol: str,
        quote_order_qty: float
    ) -> dict[str, Any]:
        """Place a market buy order"""
        if not settings.mexc_api_configured:
            raise MexcApiError("MEXC API credentials not configured")

        params = {
            "symbol": symbol,
            "side": "BUY",
            "type": "MARKET",
            "quoteOrderQty": f"{quote_order_qty:.8f}"
        }

        try:
            logger.info(f"Placing market buy order: {symbol}, amount: {quote_order_qty} USDT")
            response_data = await self._make_request(
                method="POST",
                endpoint=settings.MEXC_ORDER_ENDPOINT,
                params=params,
                authenticated=True
            )

            logger.info(f"Order placed successfully: {response_data}")
            return response_data

        except MexcApiError:
            raise
        except Exception as e:
            raise MexcApiError(f"Error placing order: {e!s}")

    async def get_account_info(self) -> dict[str, Any]:
        """Get account information"""
        if not settings.mexc_api_configured:
            raise MexcApiError("MEXC API credentials not configured")

        try:
            return await self._make_request(
                method="GET",
                endpoint="/api/v3/account",
                authenticated=True
            )

        except MexcApiError:
            raise
        except Exception as e:
            raise MexcApiError(f"Error fetching account info: {e!s}")

    async def test_connectivity(self) -> bool:
        """Test API connectivity"""
        try:
            await self._make_request("GET", "/api/v3/ping")
            return True
        except Exception as e:
            logger.error(f"MEXC API connectivity test failed: {e}")
            return False

    async def get_server_time(self) -> int:
        """Get MEXC server time"""
        try:
            response_data = await self._make_request("GET", "/api/v3/time")
            return response_data.get("serverTime", 0)
        except Exception as e:
            logger.error(f"Failed to get server time: {e}")
            return int(time.time() * 1000)


# Global API client instance
_api_client: Optional[MexcApiClient] = None


async def get_mexc_client(cache_service: Optional[CacheService] = None) -> MexcApiClient:
    """Get global MEXC API client instance with optional cache service"""
    global _api_client

    if _api_client is None:
        _api_client = MexcApiClient(cache_service=cache_service)
        await _api_client.start_session()

    return _api_client


async def close_mexc_client():
    """Close global MEXC API client"""
    global _api_client

    if _api_client:
        await _api_client.close_session()
        _api_client = None


def set_mexc_client_cache(cache_service: CacheService):
    """Set cache service for existing MEXC client"""
    global _api_client

    if _api_client:
        _api_client.cache_service = cache_service
        _api_client.cache_enabled = True
        logger.info("Cache service attached to existing MEXC API client")
