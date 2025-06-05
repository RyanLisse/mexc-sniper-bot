"""
Tests for Inngest functions
"""
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Test imports with graceful handling if Inngest not available
try:
    from src.inngest_client import inngest_client
    from src.inngest_functions import (
        MexcCalendarPollRequested,
        MexcNewListingDiscovered,
        _process_discovery_results,
        _run_calendar_discovery_cycle,
        poll_mexc_calendar,
        watch_mexc_symbol,
    )
    INNGEST_AVAILABLE = True
except ImportError:
    INNGEST_AVAILABLE = False
    pytest.skip("Inngest not available", allow_module_level=True)

from src.services.pattern_discovery import PatternDiscoveryResult


@pytest.fixture
def mock_context():
    """Mock Inngest context"""
    context = MagicMock()
    context.event.name = "admin.calendar.poll.requested"
    context.event.data = {"triggered_by": "test"}
    return context


@pytest.fixture
def mock_step():
    """Mock Inngest step"""
    step = MagicMock()
    step.run = AsyncMock()
    return step


@pytest.fixture
def mock_discovery_result():
    """Mock pattern discovery result"""
    return PatternDiscoveryResult(
        new_listings_found=2,
        ready_targets_found=1,
        targets_scheduled=1,
        errors=[],
        analysis_timestamp=datetime.now(timezone.utc)
    )


@pytest.fixture
def mock_symbol_context():
    """Mock context for symbol watching"""
    context = MagicMock()
    context.event.name = "mexc.new_listing_discovered"
    context.event.data = {
        "vcoin_id": "TEST123",
        "symbol_name": "TESTUSDT",
        "project_name": "Test Token"
    }
    return context


class TestInngestFunctions:
    """Test Inngest function implementations"""

    @pytest.mark.asyncio
    async def test_poll_mexc_calendar_success(self, mock_context, mock_step, mock_discovery_result):
        """Test successful calendar poll execution"""
        # Setup step.run to return expected values
        mock_step.run.side_effect = [
            MagicMock(),  # discovery_engine
            mock_discovery_result,  # discovery_result
            [],  # follow_up_events
            None,  # send_follow_up_events (no events)
            "Calendar poll complete"  # summary
        ]

        result = await poll_mexc_calendar(mock_context, mock_step)

        # Verify result structure
        assert result["status"] == "success"
        assert result["trigger"] == "admin.calendar.poll.requested"
        assert result["new_listings_found"] == 2
        assert result["ready_targets_found"] == 1
        assert result["targets_scheduled"] == 1
        assert result["follow_up_events_sent"] == 0
        assert "timestamp" in result

        # Verify step.run was called correct number of times
        assert mock_step.run.call_count == 5

    @pytest.mark.asyncio
    async def test_poll_mexc_calendar_with_errors(self, mock_context, mock_step):
        """Test calendar poll with errors"""
        # Setup step.run to raise exception
        mock_step.run.side_effect = Exception("Test error")

        result = await poll_mexc_calendar(mock_context, mock_step)

        # Verify error handling
        assert result["status"] == "error"
        assert result["trigger"] == "admin.calendar.poll.requested"
        assert "Test error" in result["error"]
        assert "timestamp" in result

    @pytest.mark.asyncio
    async def test_watch_mexc_symbol_success(self, mock_symbol_context, mock_step):
        """Test successful symbol watching"""
        # Setup step.run to return expected values
        mock_step.run.side_effect = [
            MagicMock(),  # mexc_client
            {"ready": False, "symbols_found": 1},  # symbol_status
            {"next_check_scheduled": True}  # result
        ]

        result = await watch_mexc_symbol(mock_symbol_context, mock_step)

        # Verify result structure
        assert result["status"] == "success"
        assert result["vcoin_id"] == "TEST123"
        assert result["attempt"] == 1
        assert result["symbol_ready"] is False
        assert result["next_check_scheduled"] is True
        assert "timestamp" in result

        # Verify step.run was called correct number of times
        assert mock_step.run.call_count == 3

    @pytest.mark.asyncio
    async def test_watch_mexc_symbol_missing_vcoin_id(self, mock_step):
        """Test symbol watching with missing vcoin_id"""
        context = MagicMock()
        context.event.data = {}  # Missing vcoin_id

        result = await watch_mexc_symbol(context, mock_step)

        # Verify error handling
        assert result["status"] == "error"
        assert "Missing vcoin_id" in result["error"]

        # Verify step.run was not called
        assert mock_step.run.call_count == 0

    @pytest.mark.asyncio
    async def test_watch_mexc_symbol_with_exception(self, mock_symbol_context, mock_step):
        """Test symbol watching with exception"""
        # Setup step.run to raise exception
        mock_step.run.side_effect = Exception("Symbol check failed")

        result = await watch_mexc_symbol(mock_symbol_context, mock_step)

        # Verify error handling
        assert result["status"] == "error"
        assert result["vcoin_id"] == "TEST123"
        assert "Symbol check failed" in result["error"]


class TestInngestHelperFunctions:
    """Test helper functions used by Inngest functions"""

    @pytest.mark.asyncio
    async def test_run_calendar_discovery_cycle(self):
        """Test calendar discovery cycle helper"""
        mock_engine = AsyncMock()
        mock_result = PatternDiscoveryResult(
            new_listings_found=1,
            ready_targets_found=0,
            targets_scheduled=0,
            errors=[],
            analysis_timestamp=datetime.now(timezone.utc)
        )
        mock_engine.run_discovery_cycle.return_value = mock_result

        result = await _run_calendar_discovery_cycle(mock_engine)

        assert result == mock_result
        mock_engine.run_discovery_cycle.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_discovery_results_no_new_listings(self, mock_discovery_result):
        """Test processing discovery results with no new listings"""
        mock_discovery_result.new_listings_found = 0

        events = await _process_discovery_results(mock_discovery_result)

        assert events == []

    @pytest.mark.asyncio
    async def test_process_discovery_results_with_new_listings(self, mock_discovery_result):
        """Test processing discovery results with new listings"""
        mock_discovery_result.new_listings_found = 2

        with patch('src.inngest_functions.get_async_session') as mock_session:
            # Mock database session and listings
            mock_db_session = AsyncMock()
            mock_session.return_value.__aenter__.return_value = mock_db_session

            with patch('src.inngest_functions.get_monitoring_listings') as mock_get_listings:
                # Mock listings data
                mock_listing1 = MagicMock()
                mock_listing1.vcoin_id = "TEST123"
                mock_listing1.symbol_name = "TESTUSDT"
                mock_listing1.project_name = "Test Token"
                mock_listing1.announced_launch_datetime_utc = datetime.now(timezone.utc)

                mock_listing2 = MagicMock()
                mock_listing2.vcoin_id = "TEST456"
                mock_listing2.symbol_name = "TEST2USDT"
                mock_listing2.project_name = "Test Token 2"
                mock_listing2.announced_launch_datetime_utc = datetime.now(timezone.utc)

                mock_get_listings.return_value = [mock_listing1, mock_listing2]

                events = await _process_discovery_results(mock_discovery_result)

                # Verify events were created
                assert len(events) == 2
                assert events[0]["name"] == "mexc.new_listing_discovered"
                assert events[0]["data"]["vcoin_id"] == "TEST456"  # Last 2 listings
                assert events[1]["name"] == "mexc.new_listing_discovered"
                assert events[1]["data"]["vcoin_id"] == "TEST456"


class TestInngestEventDefinitions:
    """Test Inngest event definitions"""

    def test_event_names(self):
        """Test event name constants"""
        assert MexcCalendarPollRequested.name == "admin.calendar.poll.requested"
        assert MexcNewListingDiscovered.name == "mexc.new_listing_discovered"


class TestInngestIntegration:
    """Test Inngest client integration"""

    def test_inngest_client_available(self):
        """Test that Inngest client is properly initialized"""
        assert inngest_client is not None
        assert hasattr(inngest_client, 'send')
        assert hasattr(inngest_client, 'create_function')

    @pytest.mark.asyncio
    async def test_inngest_client_send_event(self):
        """Test sending events through Inngest client"""
        with patch.object(inngest_client, 'send') as mock_send:
            mock_send.return_value = {"id": "test-event-id"}

            event = {
                "name": "test.event",
                "data": {"test": "data"}
            }

            result = await inngest_client.send(event)

            mock_send.assert_called_once_with(event)
            assert result["id"] == "test-event-id"


if __name__ == "__main__":
    pytest.main([__file__])
