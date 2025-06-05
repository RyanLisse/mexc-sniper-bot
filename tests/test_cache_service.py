"""
Tests for cache service functionality
"""
import asyncio
import json
from datetime import timedelta
from unittest.mock import AsyncMock, patch

import pytest

from src.services.cache_service import CacheService, close_cache_service, get_cache_service


@pytest.fixture
def cache_service_no_redis():
    """Create cache service without Redis connection"""
    return CacheService(redis_url=None)


@pytest.fixture
def cache_service_mock_redis():
    """Create cache service with mocked Redis"""
    service = CacheService(redis_url="redis://localhost:6379/0")
    return service


@pytest.fixture
def sample_data():
    """Sample data for caching tests"""
    return {
        "symbols": [
            {"cd": "TEST123", "ca": "TESTUSDT", "sts": 2, "st": 2, "tt": 4},
            {"cd": "TEST456", "ca": "TEST2USDT", "sts": 1, "st": 1, "tt": 1}
        ],
        "calendar": [
            {"vcoinId": "TEST123", "symbol": "TESTUSDT", "projectName": "Test Token"}
        ]
    }


class TestCacheServiceInitialization:
    """Test cache service initialization and configuration"""

    def test_cache_service_no_redis_url(self, cache_service_no_redis):
        """Test cache service initialization without Redis URL"""
        assert cache_service_no_redis.redis_url is None
        assert not cache_service_no_redis.is_available
        assert cache_service_no_redis.redis_client is None

    def test_cache_service_with_redis_url(self, cache_service_mock_redis):
        """Test cache service initialization with Redis URL"""
        assert cache_service_mock_redis.redis_url == "redis://localhost:6379/0"
        assert not cache_service_mock_redis.is_available  # Not connected yet
        assert cache_service_mock_redis.redis_client is None

    def test_key_prefix_configuration(self):
        """Test custom key prefix configuration"""
        service = CacheService(redis_url=None, key_prefix="test")
        assert service.key_prefix == "test"
        assert service._make_key("example") == "test:example"

    def test_ttl_configuration(self, cache_service_no_redis):
        """Test TTL configuration"""
        assert cache_service_no_redis.default_ttl == 5
        assert cache_service_no_redis._get_ttl("symbols") == 5
        assert cache_service_no_redis._get_ttl("calendar") == 30
        assert cache_service_no_redis._get_ttl("unknown") == 5


class TestCacheServiceNoRedis:
    """Test cache service graceful degradation without Redis"""

    @pytest.mark.asyncio
    async def test_start_without_redis(self, cache_service_no_redis):
        """Test starting cache service without Redis"""
        result = await cache_service_no_redis.start()
        assert result is False
        assert not cache_service_no_redis.is_available

    @pytest.mark.asyncio
    async def test_get_without_redis(self, cache_service_no_redis):
        """Test get operation without Redis"""
        result = await cache_service_no_redis.get("test_key")
        assert result is None

    @pytest.mark.asyncio
    async def test_set_without_redis(self, cache_service_no_redis):
        """Test set operation without Redis"""
        result = await cache_service_no_redis.set("test_key", {"data": "value"})
        assert result is False

    @pytest.mark.asyncio
    async def test_delete_without_redis(self, cache_service_no_redis):
        """Test delete operation without Redis"""
        result = await cache_service_no_redis.delete("test_key")
        assert result is False

    @pytest.mark.asyncio
    async def test_exists_without_redis(self, cache_service_no_redis):
        """Test exists operation without Redis"""
        result = await cache_service_no_redis.exists("test_key")
        assert result is False

    @pytest.mark.asyncio
    async def test_clear_pattern_without_redis(self, cache_service_no_redis):
        """Test clear pattern operation without Redis"""
        result = await cache_service_no_redis.clear_pattern("test:*")
        assert result == 0

    @pytest.mark.asyncio
    async def test_get_stats_without_redis(self, cache_service_no_redis):
        """Test get stats operation without Redis"""
        stats = await cache_service_no_redis.get_stats()
        assert stats["available"] is False
        assert "connection_attempts" in stats
        assert "redis_url_configured" in stats


class TestCacheServiceWithMockRedis:
    """Test cache service with mocked Redis"""

    @pytest.mark.asyncio
    async def test_successful_connection(self, cache_service_mock_redis):
        """Test successful Redis connection"""
        with patch('redis.asyncio.from_url') as mock_from_url:
            mock_redis = AsyncMock()
            mock_redis.ping.return_value = True
            mock_from_url.return_value = mock_redis

            result = await cache_service_mock_redis.start()

            assert result is True
            assert cache_service_mock_redis.is_available
            assert cache_service_mock_redis.redis_client == mock_redis

    @pytest.mark.asyncio
    async def test_failed_connection(self, cache_service_mock_redis):
        """Test failed Redis connection"""
        with patch('redis.asyncio.from_url') as mock_from_url:
            mock_redis = AsyncMock()
            mock_redis.ping.side_effect = Exception("Connection failed")
            mock_from_url.return_value = mock_redis

            result = await cache_service_mock_redis.start()

            assert result is False
            assert not cache_service_mock_redis.is_available

    @pytest.mark.asyncio
    async def test_get_operation(self, cache_service_mock_redis, sample_data):
        """Test cache get operation"""
        with patch('redis.asyncio.from_url') as mock_from_url:
            mock_redis = AsyncMock()
            mock_redis.ping.return_value = True
            mock_redis.get.return_value = json.dumps(sample_data["symbols"])
            mock_from_url.return_value = mock_redis

            await cache_service_mock_redis.start()
            result = await cache_service_mock_redis.get("symbols")

            assert result == sample_data["symbols"]
            mock_redis.get.assert_called_once_with("mexc:symbols")

    @pytest.mark.asyncio
    async def test_set_operation(self, cache_service_mock_redis, sample_data):
        """Test cache set operation"""
        with patch('redis.asyncio.from_url') as mock_from_url:
            mock_redis = AsyncMock()
            mock_redis.ping.return_value = True
            mock_redis.setex.return_value = True
            mock_from_url.return_value = mock_redis

            await cache_service_mock_redis.start()
            result = await cache_service_mock_redis.set("symbols", sample_data["symbols"], cache_type="symbols")

            assert result is True
            mock_redis.setex.assert_called_once()

            # Check the call arguments
            call_args = mock_redis.setex.call_args
            assert call_args[0][0] == "mexc:symbols"  # key
            assert call_args[0][1] == 5  # TTL for symbols
            assert json.loads(call_args[0][2]) == sample_data["symbols"]  # value

    @pytest.mark.asyncio
    async def test_delete_operation(self, cache_service_mock_redis):
        """Test cache delete operation"""
        with patch('redis.asyncio.from_url') as mock_from_url:
            mock_redis = AsyncMock()
            mock_redis.ping.return_value = True
            mock_redis.delete.return_value = 1
            mock_from_url.return_value = mock_redis

            await cache_service_mock_redis.start()
            result = await cache_service_mock_redis.delete("test_key")

            assert result is True
            mock_redis.delete.assert_called_once_with("mexc:test_key")

    @pytest.mark.asyncio
    async def test_clear_pattern_operation(self, cache_service_mock_redis):
        """Test cache clear pattern operation"""
        with patch('redis.asyncio.from_url') as mock_from_url:
            mock_redis = AsyncMock()
            mock_redis.ping.return_value = True
            mock_redis.keys.return_value = ["mexc:test:1", "mexc:test:2"]
            mock_redis.delete.return_value = 2
            mock_from_url.return_value = mock_redis

            await cache_service_mock_redis.start()
            result = await cache_service_mock_redis.clear_pattern("test:*")

            assert result == 2
            mock_redis.keys.assert_called_once_with("mexc:test:*")
            mock_redis.delete.assert_called_once_with("mexc:test:1", "mexc:test:2")


class TestCacheServiceSerialization:
    """Test cache service serialization/deserialization"""

    def test_serialize_value(self, cache_service_no_redis):
        """Test value serialization"""
        data = {"key": "value", "number": 123, "list": [1, 2, 3]}
        serialized = cache_service_no_redis._serialize_value(data)

        assert isinstance(serialized, str)
        assert json.loads(serialized) == data

    def test_deserialize_value(self, cache_service_no_redis):
        """Test value deserialization"""
        data = {"key": "value", "number": 123, "list": [1, 2, 3]}
        serialized = json.dumps(data)
        deserialized = cache_service_no_redis._deserialize_value(serialized)

        assert deserialized == data

    def test_deserialize_invalid_json(self, cache_service_no_redis):
        """Test deserialization of invalid JSON"""
        result = cache_service_no_redis._deserialize_value("invalid json")
        assert result is None

    def test_serialize_complex_data(self, cache_service_no_redis):
        """Test serialization of complex data types"""
        from datetime import datetime

        data = {
            "timestamp": datetime.now(),
            "nested": {"deep": {"value": 123}}
        }

        # Should not raise exception due to default=str
        serialized = cache_service_no_redis._serialize_value(data)
        assert isinstance(serialized, str)


class TestCacheServiceTTL:
    """Test cache service TTL functionality"""

    def test_ttl_with_integer(self, cache_service_no_redis):
        """Test TTL with integer value"""
        assert cache_service_no_redis._get_ttl("symbols") == 5

    def test_ttl_with_timedelta(self, cache_service_mock_redis):
        """Test TTL with timedelta value"""
        with patch('redis.asyncio.from_url') as mock_from_url:
            mock_redis = AsyncMock()
            mock_redis.ping.return_value = True
            mock_redis.setex.return_value = True
            mock_from_url.return_value = mock_redis

            async def test_timedelta():
                await cache_service_mock_redis.start()
                await cache_service_mock_redis.set("test", {"data": "value"}, ttl=timedelta(minutes=5))

                # Check that TTL was converted to seconds
                call_args = mock_redis.setex.call_args
                assert call_args[0][1] == 300  # 5 minutes = 300 seconds

            asyncio.run(test_timedelta())


class TestCacheServiceErrorHandling:
    """Test cache service error handling"""

    @pytest.mark.asyncio
    async def test_redis_error_during_get(self, cache_service_mock_redis):
        """Test Redis error during get operation"""
        with patch('redis.asyncio.from_url') as mock_from_url:
            mock_redis = AsyncMock()
            mock_redis.ping.return_value = True
            mock_redis.get.side_effect = Exception("Redis error")
            mock_from_url.return_value = mock_redis

            await cache_service_mock_redis.start()
            result = await cache_service_mock_redis.get("test_key")

            assert result is None  # Should return None on error

    @pytest.mark.asyncio
    async def test_redis_error_during_set(self, cache_service_mock_redis):
        """Test Redis error during set operation"""
        with patch('redis.asyncio.from_url') as mock_from_url:
            mock_redis = AsyncMock()
            mock_redis.ping.return_value = True
            mock_redis.setex.side_effect = Exception("Redis error")
            mock_from_url.return_value = mock_redis

            await cache_service_mock_redis.start()
            result = await cache_service_mock_redis.set("test_key", {"data": "value"})

            assert result is False  # Should return False on error


class TestCacheServiceSingleton:
    """Test cache service singleton pattern"""

    @pytest.mark.asyncio
    async def test_singleton_pattern(self):
        """Test that get_cache_service returns singleton"""
        service1 = await get_cache_service()
        service2 = await get_cache_service()

        assert service1 is service2

    @pytest.mark.asyncio
    async def test_close_cache_service(self):
        """Test closing cache service"""
        await get_cache_service()
        await close_cache_service()

        # Should create new instance after closing
        service1 = await get_cache_service()
        service2 = await get_cache_service()
        assert service1 is service2


if __name__ == "__main__":
    pytest.main([__file__])
