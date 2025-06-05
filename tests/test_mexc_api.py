"""
Tests for MEXC API client with respx HTTP mocking
"""
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import aiohttp
import httpx
import pytest

from src.config import settings
from src.models import CalendarEntryApi, SymbolV2EntryApi
from src.services.cache_service import CacheService
from src.services.mexc_api import MexcApiClient, MexcApiError, get_mexc_client


@pytest.fixture
def api_client():
    """Create MEXC API client for testing"""
    return MexcApiClient()

@pytest.fixture
def mock_cache_service():
    """Create mock cache service for testing"""
    cache_service = AsyncMock(spec=CacheService)
    cache_service.get.return_value = None  # Default to cache miss
    cache_service.set.return_value = True
    return cache_service

@pytest.fixture
def api_client_with_cache(mock_cache_service):
    """Create MEXC API client with cache service for testing"""
    return MexcApiClient(cache_service=mock_cache_service)


@pytest.fixture
def mock_calendar_response():
    """Mock calendar API response"""
    return {
        "data": [
            {
                "vcoinId": "TEST123",
                "symbol": "TESTUSDT",
                "projectName": "Test Token",
                "firstOpenTime": int((datetime.now(timezone.utc).timestamp() + 3600) * 1000)
            }
        ]
    }


@pytest.fixture
def mock_symbols_response():
    """Mock symbols API response"""
    return {
        "data": {
            "symbols": [
                {
                    "cd": "TEST123",
                    "ca": "TESTUSDT",
                    "ps": 8,
                    "qs": 6,
                    "sts": 2,
                    "st": 2,
                    "tt": 4,
                    "ot": int((datetime.now(timezone.utc).timestamp() + 3600) * 1000)
                }
            ]
        }
    }


class TestMexcApiClient:
    """Test cases for MexcApiClient"""

    def test_client_initialization(self, api_client):
        """Test client initializes correctly"""
        assert api_client.base_url == settings.MEXC_BASE_URL
        assert api_client.api_key == settings.MEXC_API_KEY
        assert api_client.secret_key == settings.MEXC_SECRET_KEY
        assert api_client.session is None

    @pytest.mark.asyncio
    async def test_session_management(self, api_client):
        """Test session lifecycle management"""
        # Test session creation
        await api_client.start_session()
        assert api_client.session is not None
        assert not api_client.session.closed

        # Test session closure
        await api_client.close_session()
        assert api_client.session.closed

    @pytest.mark.asyncio
    async def test_context_manager(self, api_client):
        """Test async context manager"""
        async with api_client as client:
            assert client.session is not None
            assert not client.session.closed

        # Session should be closed after context
        assert client.session.closed

    def test_signature_generation(self, api_client):
        """Test MEXC API signature generation"""
        if not settings.mexc_api_configured:
            pytest.skip("MEXC API not configured")

        params = {
            "symbol": "BTCUSDT",
            "side": "BUY",
            "type": "MARKET",
            "timestamp": 1234567890
        }

        signature = api_client._generate_signature(params)
        assert isinstance(signature, str)
        assert len(signature) == 64  # SHA256 hex digest length

    def test_signature_generation_without_secret(self):
        """Test signature generation fails without secret key"""
        client = MexcApiClient()
        client.secret_key = None

        with pytest.raises(MexcApiError, match="MEXC secret key not configured"):
            client._generate_signature({"test": "value"})

    def test_headers_generation(self, api_client):
        """Test request headers generation"""
        # Without API key
        headers = api_client._get_headers(include_api_key=False)
        assert "Content-Type" in headers
        assert "User-Agent" in headers
        assert "X-MEXC-APIKEY" not in headers

        # With API key
        if settings.MEXC_API_KEY:
            headers = api_client._get_headers(include_api_key=True)
            assert "X-MEXC-APIKEY" in headers
            assert headers["X-MEXC-APIKEY"] == settings.MEXC_API_KEY

    @pytest.mark.asyncio
    async def test_rate_limiting(self, api_client):
        """Test rate limiting functionality"""
        import time

        start_time = time.time()
        await api_client._rate_limit()
        await api_client._rate_limit()
        end_time = time.time()

        # Should have some delay due to rate limiting
        assert end_time - start_time >= api_client.min_request_interval

    @pytest.mark.asyncio
    async def test_get_calendar_listings_success(self, api_client, mock_calendar_response):
        """Test successful calendar listings retrieval"""
        with patch.object(api_client, '_make_request', return_value=mock_calendar_response):
            listings = await api_client.get_calendar_listings()

            assert len(listings) == 1
            assert isinstance(listings[0], CalendarEntryApi)
            assert listings[0].vcoinId == "TEST123"
            assert listings[0].symbol == "TESTUSDT"

    @pytest.mark.asyncio
    async def test_get_calendar_listings_empty(self, api_client):
        """Test calendar listings with empty response"""
        with patch.object(api_client, '_make_request', return_value={"data": []}):
            listings = await api_client.get_calendar_listings()
            assert len(listings) == 0

    @pytest.mark.asyncio
    async def test_get_calendar_listings_invalid_data(self, api_client):
        """Test calendar listings with invalid data"""
        with patch.object(api_client, '_make_request', return_value={"data": "invalid"}):
            listings = await api_client.get_calendar_listings()
            assert len(listings) == 0

    @pytest.mark.asyncio
    async def test_get_symbols_v2_success(self, api_client, mock_symbols_response):
        """Test successful symbols retrieval"""
        with patch.object(api_client, '_make_request', return_value=mock_symbols_response):
            symbols = await api_client.get_symbols_v2()

            assert len(symbols) == 1
            assert isinstance(symbols[0], SymbolV2EntryApi)
            assert symbols[0].cd == "TEST123"
            assert symbols[0].ca == "TESTUSDT"

    @pytest.mark.asyncio
    async def test_get_symbols_v2_filtered(self, api_client, mock_symbols_response):
        """Test symbols retrieval with vcoin_id filter"""
        with patch.object(api_client, '_make_request', return_value=mock_symbols_response):
            # Test with matching vcoin_id
            symbols = await api_client.get_symbols_v2(vcoin_id="TEST123")
            assert len(symbols) == 1

            # Test with non-matching vcoin_id
            symbols = await api_client.get_symbols_v2(vcoin_id="NONEXISTENT")
            assert len(symbols) == 0

    @pytest.mark.asyncio
    async def test_connectivity_test(self, api_client):
        """Test API connectivity check"""
        # Test successful connectivity
        with patch.object(api_client, '_make_request', return_value={}):
            result = await api_client.test_connectivity()
            assert result is True

        # Test failed connectivity
        with patch.object(api_client, '_make_request', side_effect=Exception("Network error")):
            result = await api_client.test_connectivity()
            assert result is False

    @pytest.mark.asyncio
    async def test_get_server_time(self, api_client):
        """Test server time retrieval"""
        mock_time = 1234567890000
        with patch.object(api_client, '_make_request', return_value={"serverTime": mock_time}):
            server_time = await api_client.get_server_time()
            assert server_time == mock_time

        # Test fallback to local time
        with patch.object(api_client, '_make_request', side_effect=Exception("Error")):
            server_time = await api_client.get_server_time()
            assert isinstance(server_time, int)
            assert server_time > 0


class TestMexcApiErrorHandling:
    """Test error handling in MEXC API client"""

    @pytest.mark.asyncio
    async def test_http_error_handling(self, api_client):
        """Test HTTP error handling"""
        mock_response = MagicMock()
        mock_response.status = 400
        mock_response.json.return_value = {"msg": "Bad Request"}

        with patch.object(api_client, 'session') as mock_session:
            mock_session.request.return_value.__aenter__.return_value = mock_response

            with pytest.raises(MexcApiError) as exc_info:
                await api_client._make_request("GET", "/test")

            assert "400" in str(exc_info.value)
            assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_network_error_retry(self, api_client):
        """Test network error retry logic"""
        with patch.object(api_client, 'session') as mock_session:
            # First two attempts fail, third succeeds
            mock_session.request.side_effect = [
                aiohttp.ClientError("Network error"),
                aiohttp.ClientError("Network error"),
                MagicMock()
            ]

            # Mock successful response for third attempt
            mock_response = MagicMock()
            mock_response.status = 200
            mock_response.json.return_value = {"success": True}
            mock_session.request.return_value.__aenter__.return_value = mock_response

            # Should succeed after retries
            result = await api_client._make_request("GET", "/test", retries=2)
            assert result == {"success": True}

    @pytest.mark.asyncio
    async def test_max_retries_exceeded(self, api_client):
        """Test max retries exceeded"""
        with patch.object(api_client, 'session') as mock_session:
            mock_session.request.side_effect = aiohttp.ClientError("Persistent error")

            with pytest.raises(MexcApiError, match="Network error after"):
                await api_client._make_request("GET", "/test", retries=1)


class TestMexcApiCaching:
    """Test caching functionality in MEXC API client"""

    def test_cache_initialization(self, api_client_with_cache, mock_cache_service):
        """Test API client initialization with cache service"""
        assert api_client_with_cache.cache_service == mock_cache_service
        assert api_client_with_cache.cache_enabled is True
        assert "symbols" in api_client_with_cache.cache_ttl
        assert "calendar" in api_client_with_cache.cache_ttl

    def test_cache_initialization_without_cache(self, api_client):
        """Test API client initialization without cache service"""
        assert api_client.cache_service is None
        assert api_client.cache_enabled is False

    @pytest.mark.asyncio
    async def test_get_calendar_listings_cache_miss(self, api_client_with_cache, mock_cache_service, mock_calendar_response):
        """Test calendar listings with cache miss"""
        # Setup cache miss
        mock_cache_service.get.return_value = None

        with patch.object(api_client_with_cache, '_make_request', return_value=mock_calendar_response):
            listings = await api_client_with_cache.get_calendar_listings()

            # Should call cache get and set
            mock_cache_service.get.assert_called_once_with("calendar")
            mock_cache_service.set.assert_called_once()

            # Verify set call arguments
            set_call_args = mock_cache_service.set.call_args
            assert set_call_args[0][0] == "calendar"  # key
            assert isinstance(set_call_args[0][1], list)  # cached data

            assert len(listings) == 1
            assert isinstance(listings[0], CalendarEntryApi)

    @pytest.mark.asyncio
    async def test_get_calendar_listings_cache_hit(self, api_client_with_cache, mock_cache_service, mock_calendar_response):
        """Test calendar listings with cache hit"""
        # Setup cache hit
        cached_data = mock_calendar_response["data"]
        mock_cache_service.get.return_value = cached_data

        with patch.object(api_client_with_cache, '_make_request') as mock_request:
            listings = await api_client_with_cache.get_calendar_listings()

            # Should call cache get but not make API request
            mock_cache_service.get.assert_called_once_with("calendar")
            mock_request.assert_not_called()

            assert len(listings) == 1
            assert isinstance(listings[0], CalendarEntryApi)

    @pytest.mark.asyncio
    async def test_get_symbols_v2_cache_miss(self, api_client_with_cache, mock_cache_service, mock_symbols_response):
        """Test symbols v2 with cache miss"""
        # Setup cache miss
        mock_cache_service.get.return_value = None

        with patch.object(api_client_with_cache, '_make_request', return_value=mock_symbols_response):
            symbols = await api_client_with_cache.get_symbols_v2()

            # Should call cache get and set
            mock_cache_service.get.assert_called_once_with("symbolsV2")
            mock_cache_service.set.assert_called_once()

            assert len(symbols) == 1
            assert isinstance(symbols[0], SymbolV2EntryApi)

    @pytest.mark.asyncio
    async def test_get_symbols_v2_with_vcoin_id_cache(self, api_client_with_cache, mock_cache_service, mock_symbols_response):
        """Test symbols v2 with vcoin_id filter and caching"""
        # Setup cache miss
        mock_cache_service.get.return_value = None

        with patch.object(api_client_with_cache, '_make_request', return_value=mock_symbols_response):
            symbols = await api_client_with_cache.get_symbols_v2(vcoin_id="TEST123")

            # Should use filtered cache key
            mock_cache_service.get.assert_called_once_with("symbolsV2:TEST123")
            mock_cache_service.set.assert_called_once()

            # Verify set call uses filtered key
            set_call_args = mock_cache_service.set.call_args
            assert set_call_args[0][0] == "symbolsV2:TEST123"

    @pytest.mark.asyncio
    async def test_cache_error_handling(self, api_client_with_cache, mock_cache_service, mock_calendar_response):
        """Test cache error handling"""
        # Setup cache service to raise exception
        mock_cache_service.get.side_effect = Exception("Cache error")
        mock_cache_service.set.side_effect = Exception("Cache error")

        with patch.object(api_client_with_cache, '_make_request', return_value=mock_calendar_response):
            # Should not raise exception, should fall back to API
            listings = await api_client_with_cache.get_calendar_listings()

            assert len(listings) == 1
            assert isinstance(listings[0], CalendarEntryApi)

    @pytest.mark.asyncio
    async def test_cache_corrupted_data_handling(self, api_client_with_cache, mock_cache_service, mock_calendar_response):
        """Test handling of corrupted cache data"""
        # Setup cache to return corrupted data
        mock_cache_service.get.return_value = [{"invalid": "data"}]

        with patch.object(api_client_with_cache, '_make_request', return_value=mock_calendar_response):
            # Should fall back to API when cache data is corrupted
            listings = await api_client_with_cache.get_calendar_listings()

            assert len(listings) == 1
            assert isinstance(listings[0], CalendarEntryApi)


class TestMexcApiSingleton:
    """Test singleton pattern for API client"""

    @pytest.mark.asyncio
    async def test_singleton_pattern(self):
        """Test that get_mexc_client returns singleton"""
        client1 = await get_mexc_client()
        client2 = await get_mexc_client()

        assert client1 is client2

    @pytest.mark.asyncio
    async def test_singleton_with_cache_service(self, mock_cache_service):
        """Test singleton pattern with cache service"""
        client = await get_mexc_client(cache_service=mock_cache_service)

        # Should have cache service attached
        assert client.cache_service == mock_cache_service
        assert client.cache_enabled is True


class TestMexcApiWithRespx:
    """Test MEXC API client with respx HTTP mocking"""

    @pytest.mark.asyncio
    async def test_get_calendar_listings_respx(self, mexc_client, respx_mock):
        """Test calendar listings with respx HTTP mocking"""
        fake_payload = {"data": [
            {
                "vcoinId": "123",
                "symbol": "TESTUSDT",
                "projectName": "Test Token",
                "firstOpenTime": 9999999999999
            }
        ]}

        route = respx_mock.get(f"{settings.MEXC_BASE_URL}{settings.MEXC_CALENDAR_ENDPOINT}").mock(
            return_value=httpx.Response(200, json=fake_payload)
        )

        listings = await mexc_client.get_calendar_listings()

        assert route.called
        assert len(listings) == 1
        assert listings[0].symbol == "TESTUSDT"
        assert listings[0].vcoinId == "123"
        assert listings[0].projectName == "Test Token"

    @pytest.mark.asyncio
    async def test_get_symbols_v2_respx(self, mexc_client, respx_mock):
        """Test symbols v2 with respx HTTP mocking"""
        fake_payload = {"data": {"symbols": [
            {
                "cd": "TEST123",
                "ca": "TESTUSDT",
                "ps": 8,
                "qs": 6,
                "sts": 2,
                "st": 2,
                "tt": 4,
                "ot": 9999999999999
            }
        ]}}

        route = respx_mock.get(f"{settings.MEXC_BASE_URL}{settings.MEXC_SYMBOLS_V2_ENDPOINT}").mock(
            return_value=httpx.Response(200, json=fake_payload)
        )

        symbols = await mexc_client.get_symbols_v2()

        assert route.called
        assert len(symbols) == 1
        assert symbols[0].cd == "TEST123"
        assert symbols[0].ca == "TESTUSDT"
        assert symbols[0].matches_ready_pattern((2, 2, 4))

    @pytest.mark.asyncio
    async def test_get_symbols_v2_filtered_respx(self, mexc_client, respx_mock):
        """Test symbols v2 with vcoin_id filter using respx"""
        fake_payload = {"data": {"symbols": [
            {
                "cd": "TEST123",
                "ca": "TESTUSDT",
                "ps": 8,
                "qs": 6,
                "sts": 2,
                "st": 2,
                "tt": 4,
                "ot": 9999999999999
            },
            {
                "cd": "OTHER456",
                "ca": "OTHERUSDT",
                "ps": 8,
                "qs": 6,
                "sts": 1,
                "st": 1,
                "tt": 1,
                "ot": None
            }
        ]}}

        route = respx_mock.get(f"{settings.MEXC_BASE_URL}{settings.MEXC_SYMBOLS_V2_ENDPOINT}").mock(
            return_value=httpx.Response(200, json=fake_payload)
        )

        # Test filtering by vcoin_id
        symbols = await mexc_client.get_symbols_v2(vcoin_id="TEST123")

        assert route.called
        assert len(symbols) == 1
        assert symbols[0].cd == "TEST123"

    @pytest.mark.asyncio
    async def test_api_error_handling_respx(self, mexc_client, respx_mock):
        """Test API error handling with respx"""
        error_payload = {"msg": "API Error", "code": 400}

        route = respx_mock.get(f"{settings.MEXC_BASE_URL}{settings.MEXC_CALENDAR_ENDPOINT}").mock(
            return_value=httpx.Response(400, json=error_payload)
        )

        with pytest.raises(MexcApiError) as exc_info:
            await mexc_client.get_calendar_listings()

        assert route.called
        assert "400" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_network_timeout_respx(self, mexc_client, respx_mock):
        """Test network timeout handling with respx"""
        import httpx

        route = respx_mock.get(f"{settings.MEXC_BASE_URL}{settings.MEXC_CALENDAR_ENDPOINT}").mock(
            side_effect=httpx.TimeoutException("Request timeout")
        )

        with pytest.raises(MexcApiError) as exc_info:
            await mexc_client.get_calendar_listings()

        assert route.called
        assert "timeout" in str(exc_info.value).lower()


if __name__ == "__main__":
    pytest.main([__file__])
