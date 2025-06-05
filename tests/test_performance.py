"""
Performance tests for MEXC sniper bot
Tests critical performance requirements for high-frequency trading
"""

import asyncio
import time
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from src.services.cache_service import CacheService
from src.services.mexc_api import MexcApiClient
from src.services.pattern_discovery import PatternDiscoveryEngine


class TestPerformanceRequirements:
    """Test performance requirements for trading operations"""

    @pytest.mark.asyncio
    async def test_cache_service_performance(self):
        """Test cache service meets performance requirements"""
        cache_service = CacheService(redis_url=None)  # No-op mode for testing

        # Test set/get performance
        start_time = time.time()

        for i in range(100):
            await cache_service.set(f"test_key_{i}", {"data": f"value_{i}"}, cache_type="symbols")
            _result = await cache_service.get(f"test_key_{i}")

        elapsed = time.time() - start_time

        # Should complete 200 operations (100 set + 100 get) in under 1 second
        assert elapsed < 1.0, f"Cache operations took {elapsed:.3f}s, expected < 1.0s"

    @pytest.mark.asyncio
    async def test_mexc_api_response_time(self):
        """Test MEXC API client response times"""
        client = MexcApiClient()

        # Mock the session to avoid real HTTP calls
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json.return_value = {"data": {"symbols": []}}

        with patch.object(client, "session") as mock_session:
            mock_session.request.return_value.__aenter__.return_value = mock_response

            start_time = time.time()
            await client.get_symbols_v2()
            elapsed = time.time() - start_time

            # API call should complete in under 100ms (mocked)
            assert elapsed < 0.1, f"API call took {elapsed:.3f}s, expected < 0.1s"

    @pytest.mark.asyncio
    async def test_pattern_discovery_cycle_performance(self):
        """Test pattern discovery cycle completes within time limits"""
        engine = PatternDiscoveryEngine()

        with patch("src.services.pattern_discovery.get_mexc_client") as mock_client:
            mock_api = AsyncMock()
            mock_api.get_calendar_listings.return_value = []
            mock_client.return_value = mock_api

            with patch("src.services.pattern_discovery.get_async_session") as mock_session:
                mock_session.return_value.__aenter__.return_value = AsyncMock()

                start_time = time.time()
                result = await engine.run_discovery_cycle()
                elapsed = time.time() - start_time

                # Discovery cycle should complete in under 5 seconds
                assert elapsed < 5.0, f"Discovery cycle took {elapsed:.3f}s, expected < 5.0s"
                assert isinstance(result.analysis_timestamp, datetime)

    @pytest.mark.asyncio
    async def test_concurrent_operations_performance(self):
        """Test system handles concurrent operations efficiently"""
        cache_service = CacheService(redis_url=None)

        async def cache_operation(i):
            await cache_service.set(f"concurrent_key_{i}", {"data": i})
            return await cache_service.get(f"concurrent_key_{i}")

        start_time = time.time()

        # Run 50 concurrent cache operations
        tasks = [cache_operation(i) for i in range(50)]
        results = await asyncio.gather(*tasks)

        elapsed = time.time() - start_time

        # Should complete 50 concurrent operations in under 2 seconds
        assert elapsed < 2.0, f"Concurrent operations took {elapsed:.3f}s, expected < 2.0s"
        assert len(results) == 50

    @pytest.mark.asyncio
    async def test_memory_usage_stability(self):
        """Test memory usage remains stable during operations"""
        try:
            import os

            import psutil

            process = psutil.Process(os.getpid())
        except ImportError:
            pytest.skip("psutil not available")  # type: ignore[misc]
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB

        cache_service = CacheService(redis_url=None)

        # Perform many operations
        for i in range(1000):
            await cache_service.set(f"memory_test_{i}", {"large_data": "x" * 1000})
            if i % 100 == 0:
                await cache_service.get(f"memory_test_{i}")

        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory

        # Memory increase should be reasonable (less than 50MB for this test)
        assert memory_increase < 50, f"Memory increased by {memory_increase:.1f}MB, expected < 50MB"


class TestScalabilityRequirements:
    """Test system scalability under load"""

    @pytest.mark.asyncio
    async def test_high_frequency_symbol_monitoring(self):
        """Test monitoring many symbols simultaneously"""
        engine = PatternDiscoveryEngine()

        # Simulate monitoring 100 symbols
        mock_symbols = []
        for i in range(100):
            mock_symbols.append({"cd": f"TEST{i}", "ca": f"TEST{i}USDT", "sts": 1, "st": 1, "tt": 1})

        with patch("src.services.pattern_discovery.get_mexc_client") as mock_client:
            mock_api = AsyncMock()
            mock_api.get_symbols_v2.return_value = mock_symbols
            mock_client.return_value = mock_api

            with patch("src.services.pattern_discovery.get_async_session") as mock_session:
                mock_session.return_value.__aenter__.return_value = AsyncMock()

                with patch("src.database.get_monitoring_listings") as mock_get_listings:
                    # Create mock listings for all symbols
                    mock_listings = []
                    for i in range(100):
                        mock_listing = AsyncMock()
                        mock_listing.vcoin_id = f"TEST{i}"
                        mock_listings.append(mock_listing)
                    mock_get_listings.return_value = mock_listings

                    start_time = time.time()
                    _ready_targets = await engine._monitor_listings_for_ready_state()
                    elapsed = time.time() - start_time

                    # Should process 100 symbols in under 10 seconds
                    assert elapsed < 10.0, f"Processing 100 symbols took {elapsed:.3f}s, expected < 10.0s"

    @pytest.mark.asyncio
    async def test_database_query_performance(self):
        """Test database queries perform within acceptable limits"""
        with patch("src.services.pattern_discovery.get_async_session") as mock_session:
            mock_db_session = AsyncMock()
            mock_session.return_value.__aenter__.return_value = mock_db_session

            # Mock database result
            mock_result = AsyncMock()
            mock_result.scalar.return_value = 42
            mock_db_session.execute.return_value = mock_result

            engine = PatternDiscoveryEngine()

            start_time = time.time()
            status = await engine.get_discovery_status()
            elapsed = time.time() - start_time

            # Database queries should complete in under 1 second
            assert elapsed < 1.0, f"Database queries took {elapsed:.3f}s, expected < 1.0s"
            assert "running" in status


class TestReliabilityRequirements:
    """Test system reliability and error handling"""

    @pytest.mark.asyncio
    async def test_error_recovery_performance(self):
        """Test system recovers quickly from errors"""
        cache_service = CacheService(redis_url="redis://invalid:6379")  # Invalid URL

        start_time = time.time()

        # Should fail gracefully and quickly
        result = await cache_service.start()

        elapsed = time.time() - start_time

        # Error handling should be fast (under 1 second)
        assert elapsed < 1.0, f"Error recovery took {elapsed:.3f}s, expected < 1.0s"
        assert result is False
        assert not cache_service.is_available

    @pytest.mark.asyncio
    async def test_graceful_degradation_performance(self):
        """Test graceful degradation doesn't impact performance"""
        cache_service = CacheService(redis_url=None)  # No cache configured

        start_time = time.time()

        # Operations should still be fast even without cache
        for i in range(100):
            await cache_service.set(f"test_{i}", {"data": i})
            await cache_service.get(f"test_{i}")

        elapsed = time.time() - start_time

        # Should complete quickly even in degraded mode
        assert elapsed < 0.5, f"Degraded operations took {elapsed:.3f}s, expected < 0.5s"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
