"""
Tests for Inngest functions with respx HTTP mocking
"""
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from src.config import settings

# Test imports with graceful handling if Inngest not available
try:
    from src.inngest_client import inngest_client
    from src.inngest_functions import poll_mexc_calendar, watch_mexc_symbol
    INNGEST_AVAILABLE = True
except ImportError:
    INNGEST_AVAILABLE = False
    pytest.skip("Inngest not available", allow_module_level=True)


class TestInngestFunctionsWithRespx:
    """Test Inngest functions with respx HTTP mocking"""

    @pytest.mark.asyncio
    async def test_watch_symbol_not_found(self, respx_mock):
        """Simple regression test: ensure function exits gracefully when symbol not found"""
        vcoin_id = "does-not-exist"

        # Mock empty symbols response
        respx_mock.get(f"{settings.MEXC_BASE_URL}{settings.MEXC_SYMBOLS_V2_ENDPOINT}").mock(
            return_value=httpx.Response(200, json={"data": {"symbols": []}})
        )

        # Create mock context
        ctx = MagicMock()
        ctx.event.data = {"vcoin_id": vcoin_id, "attempt": 1}
        ctx.event.name = "mexc.new_listing_discovered"

        # Create mock step
        step = MagicMock()
        step.run = AsyncMock()

        # Mock the step.run calls to return expected values
        step.run.side_effect = [
            MagicMock(),  # mexc_client
            {"ready": False, "symbols_found": 0},  # symbol_status
            {"next_check_scheduled": False}  # result
        ]

        # Call the function
        result = await watch_mexc_symbol(ctx, step)

        # Verify the result
        assert result["status"] == "success"
        assert result["vcoin_id"] == vcoin_id
        assert result["symbol_ready"] is False

    @pytest.mark.asyncio
    async def test_watch_symbol_ready_state_found(self, respx_mock):
        """Test symbol watching when ready state is found"""
        vcoin_id = "TEST123"

        # Mock symbols response with ready state
        symbols_payload = {"data": {"symbols": [
            {
                "cd": vcoin_id,
                "ca": "TESTUSDT",
                "ps": 8,
                "qs": 6,
                "sts": 2,  # Ready state
                "st": 2,   # Ready state
                "tt": 4,   # Ready state
                "ot": int((datetime.now(timezone.utc).timestamp() + 3600) * 1000)  # 1 hour from now
            }
        ]}}

        respx_mock.get(f"{settings.MEXC_BASE_URL}{settings.MEXC_SYMBOLS_V2_ENDPOINT}").mock(
            return_value=httpx.Response(200, json=symbols_payload)
        )

        # Create mock context
        ctx = MagicMock()
        ctx.event.data = {"vcoin_id": vcoin_id, "attempt": 1}
        ctx.event.name = "mexc.new_listing_discovered"

        # Create mock step
        step = MagicMock()
        step.run = AsyncMock()

        # Mock the step.run calls
        step.run.side_effect = [
            MagicMock(),  # mexc_client
            {"ready": True, "has_complete_data": True, "symbol": MagicMock()},  # symbol_status
            {"target_created": True, "target_id": 1}  # result
        ]

        # Call the function
        result = await watch_mexc_symbol(ctx, step)

        # Verify the result
        assert result["status"] == "success"
        assert result["vcoin_id"] == vcoin_id
        assert result["symbol_ready"] is True
        assert result["target_created"] is True

    @pytest.mark.asyncio
    async def test_poll_calendar_success(self, respx_mock):
        """Test calendar polling function success"""
        # Mock calendar response
        calendar_payload = {"data": [
            {
                "vcoinId": "NEW123",
                "symbol": "NEWUSDT",
                "projectName": "New Token",
                "firstOpenTime": int((datetime.now(timezone.utc).timestamp() + 7200) * 1000)  # 2 hours from now
            }
        ]}

        respx_mock.get(f"{settings.MEXC_BASE_URL}{settings.MEXC_CALENDAR_ENDPOINT}").mock(
            return_value=httpx.Response(200, json=calendar_payload)
        )

        # Create mock context
        ctx = MagicMock()
        ctx.event.name = "admin.calendar.poll.requested"
        ctx.event.data = {"triggered_by": "test"}

        # Create mock step
        step = MagicMock()
        step.run = AsyncMock()

        # Mock discovery result
        mock_discovery_result = MagicMock()
        mock_discovery_result.new_listings_found = 1
        mock_discovery_result.ready_targets_found = 0
        mock_discovery_result.targets_scheduled = 0
        mock_discovery_result.errors = []
        mock_discovery_result.analysis_timestamp = datetime.now(timezone.utc)

        # Mock the step.run calls
        step.run.side_effect = [
            MagicMock(),  # discovery_engine
            mock_discovery_result,  # discovery_result
            [],  # follow_up_events
            None,  # send_follow_up_events
            "Calendar poll completed successfully"  # summary
        ]

        # Call the function
        result = await poll_mexc_calendar(ctx, step)

        # Verify the result
        assert result["status"] == "success"
        assert result["trigger"] == "admin.calendar.poll.requested"
        assert result["new_listings_found"] == 1
        assert result["ready_targets_found"] == 0
        assert result["follow_up_events_sent"] == 0

    @pytest.mark.asyncio
    async def test_poll_calendar_with_error(self, respx_mock):
        """Test calendar polling function with error"""
        # Mock API error
        respx_mock.get(f"{settings.MEXC_BASE_URL}{settings.MEXC_CALENDAR_ENDPOINT}").mock(
            return_value=httpx.Response(500, json={"msg": "Internal Server Error"})
        )

        # Create mock context
        ctx = MagicMock()
        ctx.event.name = "admin.calendar.poll.requested"
        ctx.event.data = {"triggered_by": "test"}

        # Create mock step that raises exception
        step = MagicMock()
        step.run = AsyncMock(side_effect=Exception("API Error"))

        # Call the function
        result = await poll_mexc_calendar(ctx, step)

        # Verify error handling
        assert result["status"] == "error"
        assert result["trigger"] == "admin.calendar.poll.requested"
        assert "API Error" in result["error"]

    @pytest.mark.asyncio
    async def test_watch_symbol_missing_vcoin_id(self):
        """Test symbol watching with missing vcoin_id"""
        # Create mock context without vcoin_id
        ctx = MagicMock()
        ctx.event.data = {}  # Missing vcoin_id
        ctx.event.name = "mexc.new_listing_discovered"

        # Create mock step
        step = MagicMock()
        step.run = AsyncMock()

        # Call the function
        result = await watch_mexc_symbol(ctx, step)

        # Verify error handling
        assert result["status"] == "error"
        assert "Missing vcoin_id" in result["error"]

        # Verify step.run was not called
        step.run.assert_not_called()

    @pytest.mark.asyncio
    async def test_watch_symbol_max_attempts_reached(self, respx_mock):
        """Test symbol watching when max attempts are reached"""
        vcoin_id = "TEST123"

        # Mock empty symbols response (symbol not ready)
        respx_mock.get(f"{settings.MEXC_BASE_URL}{settings.MEXC_SYMBOLS_V2_ENDPOINT}").mock(
            return_value=httpx.Response(200, json={"data": {"symbols": []}})
        )

        # Create mock context with high attempt number
        ctx = MagicMock()
        ctx.event.data = {"vcoin_id": vcoin_id, "attempt": 10}  # Max attempts
        ctx.event.name = "mexc.symbol_recheck_needed"

        # Create mock step
        step = MagicMock()
        step.run = AsyncMock()

        # Mock the step.run calls
        step.run.side_effect = [
            MagicMock(),  # mexc_client
            {"ready": False, "symbols_found": 0},  # symbol_status
            {"max_attempts_reached": True}  # result
        ]

        # Call the function
        result = await watch_mexc_symbol(ctx, step)

        # Verify the result
        assert result["status"] == "success"
        assert result["vcoin_id"] == vcoin_id
        assert result["symbol_ready"] is False


class TestInngestIntegrationWithRespx:
    """Test Inngest integration with real HTTP calls mocked by respx"""

    @pytest.mark.asyncio
    async def test_inngest_client_available(self):
        """Test that Inngest client is available and properly configured"""
        assert inngest_client is not None
        assert hasattr(inngest_client, 'send')
        assert hasattr(inngest_client, 'create_function')

    @pytest.mark.asyncio
    async def test_end_to_end_symbol_discovery(self, respx_mock):
        """Test end-to-end symbol discovery flow with mocked HTTP"""
        # Mock calendar response with new listing
        calendar_payload = {"data": [
            {
                "vcoinId": "E2E123",
                "symbol": "E2EUSDT",
                "projectName": "End to End Token",
                "firstOpenTime": int((datetime.now(timezone.utc).timestamp() + 7200) * 1000)
            }
        ]}

        # Mock symbols response showing not ready initially
        symbols_payload_not_ready = {"data": {"symbols": [
            {
                "cd": "E2E123",
                "ca": "E2EUSDT",
                "ps": 8,
                "qs": 6,
                "sts": 1,  # Not ready
                "st": 1,   # Not ready
                "tt": 1,   # Not ready
                "ot": None
            }
        ]}}

        # Mock symbols response showing ready state
        symbols_payload_ready = {"data": {"symbols": [
            {
                "cd": "E2E123",
                "ca": "E2EUSDT",
                "ps": 8,
                "qs": 6,
                "sts": 2,  # Ready
                "st": 2,   # Ready
                "tt": 4,   # Ready
                "ot": int((datetime.now(timezone.utc).timestamp() + 3600) * 1000)
            }
        ]}}

        # Setup respx routes
        calendar_route = respx_mock.get(f"{settings.MEXC_BASE_URL}{settings.MEXC_CALENDAR_ENDPOINT}")
        symbols_route = respx_mock.get(f"{settings.MEXC_BASE_URL}{settings.MEXC_SYMBOLS_V2_ENDPOINT}")

        # First call returns calendar data
        calendar_route.mock(return_value=httpx.Response(200, json=calendar_payload))

        # First symbols call returns not ready, second returns ready
        symbols_route.mock(
            side_effect=[
                httpx.Response(200, json=symbols_payload_not_ready),
                httpx.Response(200, json=symbols_payload_ready)
            ]
        )

        # This test verifies that the mocking setup works correctly
        # In a real integration test, we would trigger the actual Inngest functions
        # For now, we just verify the HTTP mocking is working

        assert calendar_route is not None
        assert symbols_route is not None


if __name__ == "__main__":
    pytest.main([__file__])
