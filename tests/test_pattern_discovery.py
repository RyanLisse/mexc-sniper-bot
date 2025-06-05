"""
Tests for pattern discovery engine
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.config import settings
from src.models import CalendarEntryApi, SymbolV2EntryApi
from src.services.pattern_discovery import PatternDiscoveryEngine, get_discovery_engine


@pytest.fixture
def discovery_engine():
    """Create a fresh discovery engine for testing"""
    return PatternDiscoveryEngine()


@pytest.fixture
def mock_calendar_entry():
    """Mock calendar entry for testing"""
    future_time = int((datetime.now(timezone.utc) + timedelta(hours=6)).timestamp() * 1000)
    return CalendarEntryApi(vcoinId="TEST123", symbol="TESTUSDT", projectName="Test Token", firstOpenTime=future_time)


@pytest.fixture
def mock_symbol_ready():
    """Mock symbol in ready state for testing"""
    future_time = int((datetime.now(timezone.utc) + timedelta(hours=4)).timestamp() * 1000)
    return SymbolV2EntryApi(cd="TEST123", ca="TESTUSDT", ps=8, qs=6, sts=2, st=2, tt=4, ot=future_time)


@pytest.fixture
def mock_symbol_not_ready():
    """Mock symbol not in ready state for testing"""
    return SymbolV2EntryApi(cd="TEST123", ca="TESTUSDT", ps=8, qs=6, sts=1, st=1, tt=1, ot=None)


class TestPatternDiscoveryEngine:
    """Test cases for PatternDiscoveryEngine"""

    def test_engine_initialization(self, discovery_engine):
        """Test engine initializes correctly"""
        assert not discovery_engine.running
        assert discovery_engine.last_calendar_check is None
        assert len(discovery_engine.monitored_vcoin_ids) == 0
        assert discovery_engine.discovery_stats["total_discoveries"] == 0

    def test_ready_state_pattern_detection(self, mock_symbol_ready, mock_symbol_not_ready):
        """Test ready state pattern detection"""
        # Test ready symbol
        assert mock_symbol_ready.matches_ready_pattern(settings.READY_STATE_PATTERN)
        assert mock_symbol_ready.has_complete_data

        # Test not ready symbol
        assert not mock_symbol_not_ready.matches_ready_pattern(settings.READY_STATE_PATTERN)
        assert not mock_symbol_not_ready.has_complete_data

    def test_advance_notice_calculation(self, mock_symbol_ready):
        """Test advance notice calculation"""
        launch_time = mock_symbol_ready.launch_datetime_from_ot
        current_time = datetime.now(timezone.utc)

        advance_notice_hours = (launch_time - current_time).total_seconds() / 3600

        # Should be approximately 4 hours (from fixture)
        assert 3.5 <= advance_notice_hours <= 4.5

    @pytest.mark.asyncio
    async def test_discovery_cycle_structure(self, discovery_engine):
        """Test discovery cycle runs without errors"""
        with patch("src.services.pattern_discovery.get_mexc_client") as mock_client:
            # Mock MEXC client
            mock_api = AsyncMock()
            mock_api.get_calendar_listings.return_value = []
            mock_client.return_value = mock_api

            with patch("src.services.pattern_discovery.get_async_session") as mock_session:
                # Mock database session
                mock_session.return_value.__aenter__.return_value = AsyncMock()

                result = await discovery_engine.run_discovery_cycle()

                assert result.new_listings_found == 0
                assert result.ready_targets_found == 0
                assert result.targets_scheduled == 0
                assert isinstance(result.analysis_timestamp, datetime)

    @pytest.mark.asyncio
    async def test_calendar_monitoring(self, discovery_engine, mock_calendar_entry):
        """Test calendar monitoring functionality"""
        with patch("src.services.pattern_discovery.get_mexc_client") as mock_client:
            # Mock MEXC client with calendar data
            mock_api = AsyncMock()
            mock_api.get_calendar_listings.return_value = [mock_calendar_entry]
            mock_client.return_value = mock_api

            with patch("src.services.pattern_discovery.get_async_session") as mock_session:
                # Mock database operations
                mock_db_session = AsyncMock()
                mock_session.return_value.__aenter__.return_value = mock_db_session

                # Mock get_monitored_listing to return None (new listing)
                with (
                    patch("src.services.pattern_discovery.get_monitored_listing") as mock_get,
                    patch("src.services.pattern_discovery.create_monitored_listing") as mock_create,
                ):
                    # Configure async mocks properly
                    mock_get.return_value = None
                    mock_listing = MagicMock()
                    mock_listing.vcoin_id = mock_calendar_entry.vcoinId
                    mock_create.return_value = mock_listing

                    new_listings = await discovery_engine._check_calendar_for_new_listings()

                    assert new_listings == 1
                    assert mock_calendar_entry.vcoinId in discovery_engine.monitored_vcoin_ids

    @pytest.mark.asyncio
    async def test_ready_state_detection(self, discovery_engine, mock_symbol_ready):
        """Test ready state detection and target creation"""
        with patch("src.services.pattern_discovery.get_mexc_client") as mock_client:
            # Mock MEXC client with ready symbol
            mock_api = AsyncMock()
            mock_api.get_symbols_v2.return_value = [mock_symbol_ready]
            mock_client.return_value = mock_api

            with patch("src.services.pattern_discovery.get_async_session") as mock_session:
                mock_db_session = AsyncMock()
                mock_session.return_value.__aenter__.return_value = mock_db_session

                # Mock database operations - get_monitoring_listings is imported locally
                with patch("src.database.get_monitoring_listings") as mock_get_listings:
                    # Create mock listing
                    mock_listing = MagicMock()
                    mock_listing.vcoin_id = mock_symbol_ready.cd
                    mock_get_listings.return_value = [mock_listing]

                    with (
                        patch("src.services.pattern_discovery.get_snipe_target", return_value=None),
                        patch("src.services.pattern_discovery.create_snipe_target") as mock_create_target,
                    ):
                        mock_target = MagicMock()
                        mock_target.hours_advance_notice = 4.0
                        mock_create_target.return_value = mock_target

                        ready_targets = await discovery_engine._monitor_listings_for_ready_state()

                        assert ready_targets == 1
                        mock_create_target.assert_called_once()

    def test_singleton_pattern(self):
        """Test that get_discovery_engine returns singleton"""
        engine1 = get_discovery_engine()
        engine2 = get_discovery_engine()

        assert engine1 is engine2


class TestPatternDiscoveryConfiguration:
    """Test configuration and settings"""

    def test_ready_state_pattern_configuration(self):
        """Test ready state pattern is correctly configured"""
        assert settings.READY_STATE_PATTERN == (2, 2, 4)
        assert settings.TARGET_ADVANCE_HOURS == 3.5

    def test_polling_intervals_configuration(self):
        """Test polling intervals are reasonable"""
        assert settings.CALENDAR_POLL_INTERVAL_SECONDS >= 60  # At least 1 minute
        assert settings.SYMBOLS_POLL_INTERVAL_SECONDS_DEFAULT >= 10  # At least 10 seconds
        assert settings.SYMBOLS_POLL_INTERVAL_SECONDS_NEAR_LAUNCH >= 1  # At least 1 second


class TestPatternDiscoveryIntegration:
    """Integration tests for pattern discovery"""

    @pytest.mark.asyncio
    async def test_full_discovery_flow(self, discovery_engine, mock_calendar_entry, mock_symbol_ready):
        """Test complete discovery flow from calendar to ready target"""
        with patch("src.services.pattern_discovery.get_mexc_client") as mock_client:
            mock_api = AsyncMock()

            # First call returns calendar entry, second returns ready symbol
            mock_api.get_calendar_listings.return_value = [mock_calendar_entry]
            mock_api.get_symbols_v2.return_value = [mock_symbol_ready]
            mock_client.return_value = mock_api

            with patch("src.services.pattern_discovery.get_async_session") as mock_session:
                mock_db_session = AsyncMock()
                mock_session.return_value.__aenter__.return_value = mock_db_session

                # Mock all database operations - use correct namespaces
                with (
                    patch("src.services.pattern_discovery.get_monitored_listing", return_value=None),
                    patch("src.services.pattern_discovery.create_monitored_listing") as mock_create_listing,
                    patch("src.database.get_monitoring_listings") as mock_get_listings,  # imported locally
                    patch("src.services.pattern_discovery.get_snipe_target", return_value=None),
                    patch("src.services.pattern_discovery.create_snipe_target") as mock_create_target,
                    patch("src.database.get_pending_snipe_targets", return_value=[]),  # imported locally
                    patch("src.services.pattern_discovery.update_snipe_target_status"),
                ):
                    # Setup mocks
                    mock_listing = MagicMock()
                    mock_listing.vcoin_id = mock_calendar_entry.vcoinId
                    mock_create_listing.return_value = mock_listing
                    mock_get_listings.return_value = [mock_listing]

                    mock_target = MagicMock()
                    mock_target.id = 1
                    mock_target.hours_advance_notice = 4.0
                    mock_create_target.return_value = mock_target

                    # Run discovery cycle
                    result = await discovery_engine.run_discovery_cycle()

                    # Verify results
                    assert result.new_listings_found == 1
                    assert result.ready_targets_found == 1
                    assert len(result.errors) == 0

                    # Verify database calls
                    mock_create_listing.assert_called_once()
                    mock_create_target.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__])
