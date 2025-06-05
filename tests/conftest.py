import pytest
import respx

from src.config import settings
from src.services.cache_service import CacheService
from src.services.mexc_api import MexcApiClient


@pytest.fixture
def cache(monkeypatch):
    """Disable real Redis for tests"""
    monkeypatch.setenv("VALKEY_URL", "")
    monkeypatch.setenv("REDIS_URL", "")
    return CacheService()


@pytest.fixture
def mexc_client(cache):
    """Create MEXC API client with disabled cache for testing"""
    return MexcApiClient(cache_service=cache)


@pytest.fixture
def respx_mock():
    """Create respx mock context"""
    with respx.mock(assert_all_called=False) as rs:
        yield rs


@pytest.fixture
def mock_settings(monkeypatch):
    """Mock settings for testing"""
    monkeypatch.setenv("MEXC_BASE_URL", "https://api.mexc.com")
    monkeypatch.setenv("MEXC_CALENDAR_ENDPOINT", "/api/operation/new_coin_calendar")
    monkeypatch.setenv("MEXC_SYMBOLS_V2_ENDPOINT", "/api/platform/spot/market-v2/web/symbolsV2")
    return settings
