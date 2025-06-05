"""
Core pattern discovery engine for MEXC sniper bot
Implements proactive monitoring and 3.5+ hour advance detection
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

from src.config import settings
from src.database import (
    create_monitored_listing,
    create_snipe_target,
    get_async_session,
    get_monitored_listing,
    get_snipe_target,
    update_snipe_target_status,
)
from src.models import MonitoredListing, SnipeTarget, SymbolV2EntryApi

from .mexc_api import get_mexc_client

logger = logging.getLogger(__name__)


@dataclass
class PatternDiscoveryResult:
    """Result of pattern discovery analysis"""

    new_listings_found: int
    ready_targets_found: int
    targets_scheduled: int
    errors: list[str]
    analysis_timestamp: datetime


class PatternDiscoveryEngine:
    """Core engine for proactive pattern discovery"""

    def __init__(self):
        self.running = False
        self.last_calendar_check = None
        self.monitored_vcoin_ids: set[str] = set()
        self.discovery_stats = {
            "total_discoveries": 0,
            "successful_snipes": 0,
            "average_advance_hours": 0.0,
            "error_count": 0,
            "last_error": None,
            "uptime_start": None,
        }
        self._background_task: Optional[asyncio.Task] = None

    async def start_monitoring(self) -> PatternDiscoveryResult:
        """Start the pattern discovery monitoring system"""
        logger.info("Starting pattern discovery monitoring system")
        self.running = True

        try:
            # Initial discovery run
            result = await self.run_discovery_cycle()

            # Start background monitoring
            self._background_task = asyncio.create_task(self._background_monitoring_loop())

            logger.info(f"Pattern discovery started successfully: {result}")
            return result

        except Exception as e:
            logger.error(f"Failed to start pattern discovery: {e}")
            self.running = False
            raise

    def stop_monitoring(self):
        """Stop the pattern discovery monitoring system"""
        logger.info("Stopping pattern discovery monitoring system")
        self.running = False

    async def run_discovery_cycle(self) -> PatternDiscoveryResult:
        """Run a complete discovery cycle"""
        start_time = datetime.now(timezone.utc)
        errors = []
        new_listings = 0
        ready_targets = 0
        scheduled_targets = 0

        try:
            # Step 1: Check calendar for new listings
            new_listings = await self._check_calendar_for_new_listings()

            # Step 2: Monitor existing listings for ready state
            ready_targets = await self._monitor_listings_for_ready_state()

            # Step 3: Schedule execution for ready targets
            scheduled_targets = await self._schedule_ready_targets()

        except Exception as e:
            error_msg = f"Discovery cycle error: {e!s}"
            logger.error(error_msg)
            errors.append(error_msg)

        return PatternDiscoveryResult(
            new_listings_found=new_listings,
            ready_targets_found=ready_targets,
            targets_scheduled=scheduled_targets,
            errors=errors,
            analysis_timestamp=start_time,
        )

    async def _background_monitoring_loop(self):
        """Background loop for continuous monitoring"""
        logger.info("Starting background monitoring loop")

        while self.running:
            try:
                # Run discovery cycle
                await self.run_discovery_cycle()

                # Wait for next cycle
                await asyncio.sleep(settings.CALENDAR_POLL_INTERVAL_SECONDS)

            except asyncio.CancelledError:
                logger.info("Background monitoring loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in background monitoring loop: {e}")
                # Continue running even if there's an error
                await asyncio.sleep(60)  # Wait 1 minute before retrying

        logger.info("Background monitoring loop stopped")

    async def _check_calendar_for_new_listings(self) -> int:
        """Check MEXC calendar for new token listings"""
        logger.debug("Checking calendar for new listings")

        try:
            mexc_client = await get_mexc_client()
            calendar_entries = await mexc_client.get_calendar_listings()

            new_listings_count = 0
            current_time = datetime.now(timezone.utc)

            async with get_async_session() as session:
                for entry in calendar_entries:
                    # Skip past listings
                    if entry.launch_datetime <= current_time:
                        continue

                    # Check if already monitoring
                    existing = await get_monitored_listing(session, entry.vcoinId)
                    if existing:
                        continue

                    # Create new monitored listing
                    await create_monitored_listing(
                        session=session,
                        vcoin_id=entry.vcoinId,
                        symbol_name=entry.symbol,
                        project_name=entry.projectName,
                        announced_launch_time_ms=entry.firstOpenTime,
                        announced_launch_datetime_utc=entry.launch_datetime,
                    )

                    self.monitored_vcoin_ids.add(entry.vcoinId)
                    new_listings_count += 1

                    logger.info(
                        f"New listing discovered: {entry.symbol} ({entry.vcoinId}) - Launch: {entry.launch_datetime}"
                    )

            logger.info(f"Found {new_listings_count} new listings to monitor")
            return new_listings_count

        except Exception as e:
            logger.error(f"Error checking calendar: {e}")
            raise

    async def _monitor_listings_for_ready_state(self) -> int:
        """Monitor existing listings for ready state pattern"""
        logger.debug("Monitoring listings for ready state")

        try:
            mexc_client = await get_mexc_client()
            ready_targets_count = 0

            async with get_async_session() as session:
                # Get all monitoring listings
                from src.database import get_monitoring_listings

                monitoring_listings = await get_monitoring_listings(session)

                for listing in monitoring_listings:
                    try:
                        # Check symbol state
                        symbols = await mexc_client.get_symbols_v2(vcoin_id=listing.vcoin_id)

                        for symbol in symbols:
                            if symbol.matches_ready_pattern(settings.READY_STATE_PATTERN):
                                if symbol.has_complete_data:
                                    # Ready state detected!
                                    ready_target = await self._create_ready_target(session, listing, symbol)
                                    if ready_target:
                                        ready_targets_count += 1
                                        logger.info(
                                            f"Ready state detected: {symbol.ca} ({listing.vcoin_id}) - {ready_target.hours_advance_notice:.1f}h advance"
                                        )
                                else:
                                    logger.warning(f"Ready pattern detected but incomplete data: {listing.vcoin_id}")

                    except Exception as e:
                        logger.error(f"Error monitoring listing {listing.vcoin_id}: {e}")
                        continue

            logger.info(f"Found {ready_targets_count} ready targets")
            return ready_targets_count

        except Exception as e:
            logger.error(f"Error monitoring listings: {e}")
            raise

    async def _create_ready_target(
        self, session, listing: MonitoredListing, symbol: SymbolV2EntryApi
    ) -> Optional[SnipeTarget]:
        """Create a snipe target from ready symbol"""
        try:
            # Check if target already exists
            existing_target = await get_snipe_target(session, listing.vcoin_id)
            if existing_target:
                return None

            # Calculate advance notice
            actual_launch_time = symbol.launch_datetime_from_ot
            if not actual_launch_time:
                logger.error(f"No launch time available for {listing.vcoin_id}")
                return None

            discovered_at = datetime.now(timezone.utc)
            advance_notice_seconds = (actual_launch_time - discovered_at).total_seconds()
            advance_notice_hours = advance_notice_seconds / 3600

            # Check if advance notice meets minimum requirement
            if advance_notice_hours < settings.TARGET_ADVANCE_HOURS:
                logger.warning(
                    f"Advance notice too short: {advance_notice_hours:.1f}h < {settings.TARGET_ADVANCE_HOURS}h"
                )
                return None

            # Validate required fields
            if not symbol.ca or symbol.ps is None or symbol.qs is None or symbol.ot is None:
                logger.error(f"Missing required symbol data for {listing.vcoin_id}")
                return None

            # Prepare order parameters
            order_params = {
                "symbol": symbol.ca,
                "side": "BUY",
                "type": "MARKET",
                "quoteOrderQty": settings.DEFAULT_BUY_AMOUNT_USDT,
            }

            # Create snipe target
            target = await create_snipe_target(
                session=session,
                vcoin_id=listing.vcoin_id,
                mexc_symbol_contract=symbol.ca or "UNKNOWN",
                price_precision=symbol.ps or 8,
                quantity_precision=symbol.qs or 6,
                actual_launch_time_ms=symbol.ot or 0,
                actual_launch_datetime_utc=actual_launch_time,
                discovered_at_utc=discovered_at,
                hours_advance_notice=advance_notice_hours,
                intended_buy_amount_usdt=settings.DEFAULT_BUY_AMOUNT_USDT,
                execution_order_params=order_params,
            )

            # Update listing status
            listing.status = "ready"
            session.add(listing)

            # Update stats
            self.discovery_stats["total_discoveries"] += 1

            return target

        except Exception as e:
            logger.error(f"Error creating ready target for {listing.vcoin_id}: {e}")
            return None

    async def _schedule_ready_targets(self) -> int:
        """Schedule execution for ready targets"""
        logger.debug("Scheduling ready targets for execution")

        try:
            scheduled_count = 0

            async with get_async_session() as session:
                from src.database import get_pending_snipe_targets

                pending_targets = await get_pending_snipe_targets(session)

                for target in pending_targets:
                    if target.execution_status == "pending" and target.id is not None:
                        # Calculate time until execution
                        time_until_launch = (
                            target.actual_launch_datetime_utc - datetime.now(timezone.utc)
                        ).total_seconds()

                        if time_until_launch > 10:  # At least 10 seconds lead time
                            # Schedule execution (for now, just mark as scheduled)
                            await update_snipe_target_status(session=session, target_id=target.id, status="scheduled")
                            scheduled_count += 1
                            logger.info(f"Scheduled target {target.id} for execution in {time_until_launch:.0f}s")
                        else:
                            # Too late to schedule
                            await update_snipe_target_status(session=session, target_id=target.id, status="missed")
                            logger.warning(f"Target {target.id} missed - too late to schedule")

            return scheduled_count

        except Exception as e:
            logger.error(f"Error scheduling targets: {e}")
            raise

    async def get_discovery_status(self) -> dict[str, Any]:
        """Get current discovery system status"""
        async with get_async_session() as session:
            from sqlmodel import func, select

            # Count monitored listings
            monitored_result = await session.execute(
                select(func.count()).select_from(MonitoredListing).where(MonitoredListing.status == "monitoring")
            )
            monitored_count = monitored_result.scalar() or 0

            # Count ready targets
            ready_result = await session.execute(
                select(func.count())
                .select_from(SnipeTarget)
                .where((SnipeTarget.execution_status == "pending") | (SnipeTarget.execution_status == "scheduled"))
            )
            ready_count = ready_result.scalar() or 0

            return {
                "running": self.running,
                "last_calendar_check": self.last_calendar_check,
                "monitored_listings": monitored_count,
                "ready_targets": ready_count,
                "discovery_stats": self.discovery_stats,
                "configuration": {
                    "ready_state_pattern": settings.READY_STATE_PATTERN,
                    "target_advance_hours": settings.TARGET_ADVANCE_HOURS,
                    "calendar_poll_interval": settings.CALENDAR_POLL_INTERVAL_SECONDS,
                    "default_buy_amount": settings.DEFAULT_BUY_AMOUNT_USDT,
                },
            }


# Global pattern discovery engine instance
_discovery_engine: Optional[PatternDiscoveryEngine] = None


def get_discovery_engine() -> PatternDiscoveryEngine:
    """Get global pattern discovery engine instance"""
    global _discovery_engine

    if _discovery_engine is None:
        _discovery_engine = PatternDiscoveryEngine()

    # Type narrowing: after the if block, _discovery_engine is guaranteed to be PatternDiscoveryEngine
    from typing import cast

    return cast(PatternDiscoveryEngine, _discovery_engine)
