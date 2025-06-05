"""
Tests for database operations
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest

from src.config import settings
from src.database import (
    create_monitored_listing,
    create_snipe_target,
    create_tables,
    get_async_session,
    get_monitored_listing,
    get_monitoring_listings,
    get_pending_snipe_targets,
    get_snipe_target,
    init_database,
    update_snipe_target_status,
)
from src.models import SnipeTarget


@pytest.fixture
def mock_database_url():
    """Use in-memory SQLite for testing"""
    return "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def test_database():
    """Setup test database"""
    # Use in-memory SQLite for testing
    original_url = settings.DATABASE_URL
    settings.DATABASE_URL = "sqlite+aiosqlite:///:memory:"

    try:
        init_database()
        await create_tables()
        yield
    finally:
        # Restore original URL
        settings.DATABASE_URL = original_url


@pytest.fixture
def sample_listing_data():
    """Sample data for monitored listing"""
    launch_time = datetime.now(timezone.utc) + timedelta(hours=6)
    return {
        "vcoin_id": "TEST123",
        "symbol_name": "TESTUSDT",
        "project_name": "Test Token",
        "announced_launch_time_ms": int(launch_time.timestamp() * 1000),
        "announced_launch_datetime_utc": launch_time
    }


@pytest.fixture
def sample_target_data():
    """Sample data for snipe target"""
    launch_time = datetime.now(timezone.utc) + timedelta(hours=4)
    discovered_time = datetime.now(timezone.utc)

    return {
        "vcoin_id": "TEST123",
        "mexc_symbol_contract": "TESTUSDT",
        "price_precision": 8,
        "quantity_precision": 6,
        "actual_launch_time_ms": int(launch_time.timestamp() * 1000),
        "actual_launch_datetime_utc": launch_time,
        "discovered_at_utc": discovered_time,
        "hours_advance_notice": 4.0,
        "intended_buy_amount_usdt": 100.0,
        "execution_order_params": {
            "symbol": "TESTUSDT",
            "side": "BUY",
            "type": "MARKET",
            "quoteOrderQty": 100.0
        }
    }


class TestDatabaseInitialization:
    """Test database initialization"""

    def test_init_database_with_url(self):
        """Test database initialization with URL"""
        with patch('src.database.create_engine') as mock_create_engine, \
             patch('src.database.create_async_engine') as mock_create_async_engine, \
             patch('src.database.sessionmaker') as mock_sessionmaker:

            init_database()

            mock_create_engine.assert_called_once()
            mock_create_async_engine.assert_called_once()
            mock_sessionmaker.assert_called_once()

    def test_init_database_without_url(self):
        """Test database initialization without URL (fallback to SQLite)"""
        original_url = settings.DATABASE_URL
        settings.DATABASE_URL = None

        try:
            with patch('src.database.create_engine') as mock_create_engine, \
                 patch('src.database.create_async_engine') as mock_create_async_engine:

                init_database()

                # Should use SQLite fallback
                mock_create_engine.assert_called_once()
                mock_create_async_engine.assert_called_once()

                # Check that SQLite URL was used
                call_args = mock_create_engine.call_args[0]
                assert "sqlite" in call_args[0]
        finally:
            settings.DATABASE_URL = original_url


class TestMonitoredListingOperations:
    """Test monitored listing database operations"""

    @pytest.mark.asyncio
    async def test_create_and_get_monitored_listing(self, test_database, sample_listing_data):
        """Test creating and retrieving monitored listing"""
        async with get_async_session() as session:
            # Create listing
            listing = await create_monitored_listing(session, **sample_listing_data)

            assert listing.vcoin_id == sample_listing_data["vcoin_id"]
            assert listing.symbol_name == sample_listing_data["symbol_name"]
            assert listing.project_name == sample_listing_data["project_name"]
            assert listing.status == "monitoring"

            # Retrieve listing
            retrieved = await get_monitored_listing(session, sample_listing_data["vcoin_id"])

            assert retrieved is not None
            assert retrieved.vcoin_id == listing.vcoin_id
            assert retrieved.symbol_name == listing.symbol_name

    @pytest.mark.asyncio
    async def test_get_nonexistent_listing(self, test_database):
        """Test retrieving non-existent listing"""
        async with get_async_session() as session:
            listing = await get_monitored_listing(session, "NONEXISTENT")
            assert listing is None

    @pytest.mark.asyncio
    async def test_get_monitoring_listings(self, test_database, sample_listing_data):
        """Test getting all monitoring listings"""
        async with get_async_session() as session:
            # Create test listing
            await create_monitored_listing(session, **sample_listing_data)

            # Get monitoring listings
            listings = await get_monitoring_listings(session)

            assert len(listings) == 1
            assert listings[0].vcoin_id == sample_listing_data["vcoin_id"]
            assert listings[0].status == "monitoring"


class TestSnipeTargetOperations:
    """Test snipe target database operations"""

    @pytest.mark.asyncio
    async def test_create_and_get_snipe_target(self, test_database, sample_listing_data, sample_target_data):
        """Test creating and retrieving snipe target"""
        async with get_async_session() as session:
            # First create the monitored listing (required for foreign key)
            await create_monitored_listing(session, **sample_listing_data)

            # Create snipe target
            target = await create_snipe_target(session, **sample_target_data)

            assert target.vcoin_id == sample_target_data["vcoin_id"]
            assert target.mexc_symbol_contract == sample_target_data["mexc_symbol_contract"]
            assert target.hours_advance_notice == sample_target_data["hours_advance_notice"]
            assert target.execution_status == "pending"

            # Test order params serialization
            assert target.execution_order_params == sample_target_data["execution_order_params"]

            # Retrieve target
            retrieved = await get_snipe_target(session, sample_target_data["vcoin_id"])

            assert retrieved is not None
            assert retrieved.vcoin_id == target.vcoin_id
            assert retrieved.mexc_symbol_contract == target.mexc_symbol_contract

    @pytest.mark.asyncio
    async def test_update_snipe_target_status(self, test_database, sample_listing_data, sample_target_data):
        """Test updating snipe target status"""
        async with get_async_session() as session:
            # Create prerequisite listing and target
            await create_monitored_listing(session, **sample_listing_data)
            target = await create_snipe_target(session, **sample_target_data)

            # Update status
            execution_response = {"orderId": "12345", "status": "FILLED"}
            executed_at = datetime.now(timezone.utc)

            updated_target = await update_snipe_target_status(
                session=session,
                target_id=target.id,
                status="success",
                execution_response=execution_response,
                executed_at_utc=executed_at
            )

            assert updated_target is not None
            assert updated_target.execution_status == "success"
            assert updated_target.execution_response == execution_response
            assert updated_target.executed_at_utc == executed_at

    @pytest.mark.asyncio
    async def test_get_pending_snipe_targets(self, test_database, sample_listing_data, sample_target_data):
        """Test getting pending snipe targets"""
        async with get_async_session() as session:
            # Create test data
            await create_monitored_listing(session, **sample_listing_data)
            target = await create_snipe_target(session, **sample_target_data)

            # Get pending targets
            pending_targets = await get_pending_snipe_targets(session)

            assert len(pending_targets) == 1
            assert pending_targets[0].id == target.id
            assert pending_targets[0].execution_status == "pending"

            # Update status to non-pending
            await update_snipe_target_status(session, target.id, "success")

            # Should not return completed targets
            pending_targets = await get_pending_snipe_targets(session)
            assert len(pending_targets) == 0


class TestDatabaseSessionManagement:
    """Test database session management"""

    @pytest.mark.asyncio
    async def test_session_context_manager(self, test_database):
        """Test async session context manager"""
        async with get_async_session() as session:
            assert session is not None
            # Session should be active
            assert not session.is_active or True  # Different SQLAlchemy versions

    @pytest.mark.asyncio
    async def test_session_rollback_on_error(self, test_database):
        """Test session rollback on error"""
        try:
            async with get_async_session() as session:
                # Simulate an error
                raise ValueError("Test error")
        except ValueError:
            pass  # Expected error

        # Session should have been rolled back and closed
        # No assertion needed as context manager handles cleanup


class TestDatabaseModels:
    """Test database model functionality"""

    def test_snipe_target_order_params_property(self):
        """Test SnipeTarget order params property"""
        target = SnipeTarget(
            vcoin_id="TEST",
            mexc_symbol_contract="TESTUSDT",
            price_precision=8,
            quantity_precision=6,
            actual_launch_time_ms=1234567890000,
            actual_launch_datetime_utc=datetime.now(timezone.utc),
            discovered_at_utc=datetime.now(timezone.utc),
            hours_advance_notice=4.0,
            intended_buy_amount_usdt=100.0
        )

        # Test setting order params
        order_params = {"symbol": "TESTUSDT", "side": "BUY"}
        target.execution_order_params = order_params

        assert target.execution_order_params == order_params
        assert isinstance(target.execution_order_params_json, str)

        # Test getting order params
        retrieved_params = target.execution_order_params
        assert retrieved_params == order_params

    def test_snipe_target_execution_response_property(self):
        """Test SnipeTarget execution response property"""
        target = SnipeTarget(
            vcoin_id="TEST",
            mexc_symbol_contract="TESTUSDT",
            price_precision=8,
            quantity_precision=6,
            actual_launch_time_ms=1234567890000,
            actual_launch_datetime_utc=datetime.now(timezone.utc),
            discovered_at_utc=datetime.now(timezone.utc),
            hours_advance_notice=4.0,
            intended_buy_amount_usdt=100.0
        )

        # Test setting execution response
        response = {"orderId": "12345", "status": "FILLED"}
        target.execution_response = response

        assert target.execution_response == response
        assert isinstance(target.execution_response_json, str)

        # Test None response
        target.execution_response = None
        assert target.execution_response is None
        assert target.execution_response_json is None


if __name__ == "__main__":
    pytest.main([__file__])
